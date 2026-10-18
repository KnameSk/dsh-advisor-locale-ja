/**
 * Verification for the Japanese Advisor add-on.
 *
 * The shipped artifact (`dsh/client.js`) is the thing under test, not a source
 * copy of it: the suite loads the emitted bundle the way dsh-client-modules
 * does and drives it through a locale service that mirrors the observable
 * `LocaleRuntime` contract from `@deepseek-ai/dsh-client-locale`, including the
 * duplicate-registration errors that the coexistence guard exists to survive.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

/** The Advisor's canonical English key set, mirrored here to prove key coverage. */
const ADVISOR_KEYS = JSON.parse(await readFile(join(root, "test", "fixtures", "advisor-keys.json"), "utf8"));

/** A locale service double matching the parts of `LocaleRuntime` this add-on uses. */
function createLocaleService(locales = [{ id: "en", label: "English" }, { id: "zh", label: "中文" }], options = {}) {
  const { transparentForDuplicates = false } = options;
  const catalog = new Map(locales.map((language) => [language.id.toLowerCase(), language]));
  const dicts = new Map();
  const listeners = new Set();
  const state = { active: "en", revision: 0 };

  const publish = () => {
    state.revision += 1;
    for (const listener of listeners) listener();
  };
  const chainOf = (start) => {
    const chain = [];
    const seen = new Set();
    let current = catalog.get(start.toLowerCase());
    while (current !== undefined && !seen.has(current.id.toLowerCase())) {
      seen.add(current.id.toLowerCase());
      chain.push(current.id);
      current = current.fallback === undefined ? undefined : catalog.get(current.fallback.toLowerCase());
    }
    if (!seen.has("en")) chain.push("en");
    return chain;
  };
  const lookup = (ns, key, chain) => {
    for (const locale of chain) {
      const entries = dicts.get(ns)?.get(locale.toLowerCase());
      if (entries !== undefined && Object.hasOwn(entries, key)) return entries[key];
    }
    return undefined;
  };
  return {
    // The real runtime keeps its registry in this field; the add-on reads it to
    // tell a duplicate apart from a genuine failure. A service that hides the
    // field must make the add-on fail rather than guess.
    get dicts() {
      return transparentForDuplicates ? undefined : dicts;
    },
    addLanguage({ id, label, fallback }) {
      const key = id.toLowerCase();
      if (catalog.has(key)) throw new Error(`locale "${id}" is already registered`);
      if (!catalog.has(fallback.toLowerCase())) throw new Error(`locale fallback "${fallback}" is not registered`);
      catalog.set(key, { id, label, fallback });
      publish();
      return () => {
        catalog.delete(key);
        publish();
      };
    },
    register(ns, localeOrDicts, dict) {
      const pairs = typeof localeOrDicts === "string" ? [[localeOrDicts, dict]] : Object.entries(localeOrDicts);
      let locales = dicts.get(ns);
      if (locales === undefined) {
        locales = new Map();
        dicts.set(ns, locales);
      }
      for (const [locale] of pairs) {
        if (locales.has(locale.toLowerCase())) throw new Error(`locale namespace "${ns}" already has locale "${locale}"`);
      }
      for (const [locale, entries] of pairs) locales.set(locale.toLowerCase(), entries);
      publish();
      return () => {
        for (const [locale] of pairs) locales.delete(locale.toLowerCase());
        publish();
      };
    },
    bind(ns) {
      return (key, params = {}) => {
        const chain = chainOf(state.active);
        let template = lookup(ns, key, chain);
        if (template === undefined && ns !== "common") template = lookup("common", key, chain);
        if (template === undefined) return key;
        return String(template).replace(/\{(\w+)\}/gu, (match, name) => (name in params ? String(params[name]) : match));
      };
    },
    translate(ns, key, params) {
      return this.bind(ns)(key, params);
    },
    getLocale() {
      return {
        active: state.active,
        locales: [...catalog.values()],
        revision: state.revision,
      };
    },
    setLocale(id) {
      if (!catalog.has(id.toLowerCase())) throw new Error(`locale "${id}" is not registered`);
      state.active = catalog.get(id.toLowerCase()).id;
      publish();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** A Client context recording owned effects so disposal can be exercised. */
function createClientContext(locale) {
  const effects = [];
  const context = {
    locale,
    effect(factory, label) {
      const result = factory();
      effects.push({ label, dispose: typeof result === "function" ? result : () => {} });
      return typeof result === "function" ? result : () => {};
    },
  };
  return { context, effects };
}

/** Load the emitted bundle exactly as the Harness module loader does. */
async function loadBundle() {
  const source = await readFile(join(root, "dsh", "client.js"), "utf8");
  const registrations = [];
  const previous = globalThis.window;
  globalThis.window = { __ModuleLoader__: { load: (registration) => registrations.push(registration) } };
  try {
    // The bundle only registers a lazy factory at script evaluation.
    new Function(source)();
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
  return registrations;
}

const registrations = await loadBundle();

test("the bundle registers one lazy factory under the package id", () => {
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].id, "dsh-advisor-locale-ja");
  const factory = registrations[0].factory;
  const module = factory(() => {
    throw new Error("this bundle must not require anything");
  });
  assert.deepEqual([...module.inject], ["locale"]);
  assert.equal(typeof module.apply, "function");
});

/**
 * Load the bundle's factory with nothing materialized, matching a Harness that
 * reaches `apply` only after the locale service exists.
 */
async function loadClient() {
  const factory = (await loadBundle())[0].factory;
  return factory(() => {
    throw new Error("this bundle must not require anything");
  });
}

test("applying contributes the Japanese dictionary to the Advisor namespace", async () => {
  const client = await loadClient();
  const locale = createLocaleService();
  client.apply(createClientContext(locale).context);
  locale.setLocale("ja");
  const t = locale.bind("settings.advisor");
  assert.equal(t("tab.budget"), "予算");
  assert.equal(t("tab.history"), "履歴");
  assert.equal(t("tab.test"), "接続テスト");
  assert.equal(t("group.budget"), "相談予算");
  assert.equal(t("title"), "Advisor");
});

test("the Japanese dictionary covers every Advisor key", async () => {
  const client = await loadClient();
  const locale = createLocaleService();
  client.apply(createClientContext(locale).context);
  locale.setLocale("ja");
  const t = locale.bind("settings.advisor");
  const untranslated = ADVISOR_KEYS.filter((key) => t(key) === key);
  assert.deepEqual(untranslated, [], "every Advisor key has Japanese copy");
  // Product names and literal syntax examples stay as they are on purpose.
  const verbatim = new Set([
    "title",
    "field.advisorEnabled.label",
    "field.advisorPricingJson.placeholder",
    "field.advisorToolPoliciesJson.placeholder",
  ]);
  const englishLeaks = ADVISOR_KEYS.filter((key) => !verbatim.has(key) && !/[\u3000-\u30ff\u4e00-\u9fff]/u.test(t(key)));
  assert.deepEqual(englishLeaks, [], "no Advisor key is left as uninjected English prose");
});

test("placeholder parameters survive translation", async () => {
  const client = await loadClient();
  const locale = createLocaleService();
  client.apply(createClientContext(locale).context);
  locale.setLocale("ja");
  const t = locale.bind("settings.advisor");
  assert.equal(t("budget.remaining", { count: 3 }), "残り 3 回");
  assert.equal(t("error.fieldWholeNumber", { min: 2 }), "2 以上の整数を入力してください。");
  assert.equal(t("budget.ceiling", { limit: "$5.00" }), "上限 $5.00");
});

test("Japanese registers itself when no other language pack provides it", async () => {
  const client = await loadClient();
  const locale = createLocaleService();
  client.apply(createClientContext(locale).context);
  const ids = locale.getLocale().locales.map((language) => language.id);
  assert.deepEqual(ids, ["en", "zh", "ja"]);
  const japanese = locale.getLocale().locales.find((language) => language.id === "ja");
  assert.equal(japanese.label, "日本語");
  assert.equal(japanese.fallback, "en");
});

test("Japanese is active once selected, and English is untouched", async () => {
  const client = await loadClient();
  const locale = createLocaleService();
  client.apply(createClientContext(locale).context);
  locale.setLocale("ja");
  const t = locale.bind("settings.advisor");
  assert.equal(locale.getLocale().active, "ja");
  assert.equal(t("tab.budget"), "予算", "Advisor copy is Japanese while Japanese is active");
  locale.setLocale("en");
  assert.equal(t("tab.budget"), "tab.budget", "the add-on leaves the core's English dictionary untouched");
});

test("coexists with a language pack that already defines Japanese", async () => {
  const client = await loadClient();
  // @fang2hou/dsh-locale-ja, or any other pack, registered `ja` first.
  const locale = createLocaleService([
    { id: "en", label: "English" },
    { id: "zh", label: "中文" },
    { id: "ja", label: "日本語", fallback: "en" },
  ]);
  const { context, effects } = createClientContext(locale);
  client.apply(context);
  const ids = locale.getLocale().locales.map((language) => language.id);
  assert.deepEqual(ids, ["en", "zh", "ja"], "the add-on adds no second Japanese entry and throws nothing");
  locale.setLocale("ja");
  assert.equal(locale.bind("settings.advisor")("tab.budget"), "予算", "the add-on still supplies the Advisor dictionary");
  assert.equal(effects.length, 1, "only the dictionary is owned when the language already existed");
});

test("an Advisor key without Japanese copy falls back to English", async () => {
  const client = await loadClient();
  const locale = createLocaleService();
  // The Advisor core owns English in the same namespace.
  locale.register("settings.advisor", { en: { "tab.budget": "Budget", "future.onlyInEnglish": "English only" } });
  client.apply(createClientContext(locale).context);
  locale.setLocale("ja");
  const t = locale.bind("settings.advisor");
  assert.equal(t("tab.budget"), "予算");
  assert.equal(t("future.onlyInEnglish"), "English only", "an untranslated key falls back to English");
});

test("an Advisor core that still ships its own Japanese does not break the add-on", async () => {
  const client = await loadClient();
  const locale = createLocaleService([
    { id: "en", label: "English" },
    { id: "zh", label: "中文" },
    { id: "ja", label: "日本語", fallback: "en" },
  ]);
  // An Advisor built before this copy moved out of the core ships the full ja dictionary itself.
  locale.register("settings.advisor", { en: { "tab.budget": "Budget" }, ja: { "action.discard": "破棄", "tab.budget": "予算" } });
  locale.setLocale("ja");
  assert.doesNotThrow(
    () => client.apply(createClientContext(locale).context),
    "the duplicate dictionary is reported, not thrown over, while Japanese is on screen",
  );
  assert.equal(locale.bind("settings.advisor")("tab.budget"), "予算", "the Advisor's own Japanese still renders");
});

test("a duplicate the add-on cannot explain is surfaced instead of hidden", async () => {
  const client = await loadClient();
  // A service that refuses the write while exposing no registry to check against.
  const locale = createLocaleService(undefined, { transparentForDuplicates: true });
  locale.register("settings.advisor", "ja", {});
  assert.throws(
    () => client.apply(createClientContext(locale).context),
    /already has locale "ja"/u,
    "an unexplained duplicate stays visible",
  );
});

test("unloading removes only this add-on's contribution", async () => {
  const client = await loadClient();
  const locale = createLocaleService();
  const { context, effects } = createClientContext(locale);
  client.apply(context);
  assert.equal(locale.getLocale().locales.some((language) => language.id === "ja"), true);
  for (const effect of effects) effect.dispose();
  assert.equal(locale.getLocale().locales.some((language) => language.id === "ja"), false, "the language definition is withdrawn");
  assert.equal(locale.bind("settings.advisor")("tab.budget"), "tab.budget", "the dictionary is withdrawn");
});

test("a host without the locale service is left untouched", async () => {
  const client = await loadClient();
  assert.doesNotThrow(() => client.apply({ effect: () => () => {} }));
});

test("duplicate dictionary registration is rejected by the service, not silently overwritten", async () => {
  const locale = createLocaleService();
  locale.register("settings.advisor", "ja", { "tab.budget": "予算" });
  assert.throws(
    () => locale.register("settings.advisor", "ja", { "tab.budget": "別の訳" }),
    /already has locale "ja"/u,
    "the service rejects a second Japanese dictionary for the same namespace",
  );
});
