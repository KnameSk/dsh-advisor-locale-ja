/**
 * The Japanese language contribution, kept separate from the dictionary so the
 * two concerns stay independently testable.
 *
 * Registration is deliberately additive and reversible: this module never
 * unregisters or redefines anything another plugin owns, and the locale service
 * is the single authority on what is currently registered.
 */
import { DICTIONARY_NAMESPACE, JA, JA_LABEL } from "./constants.js";
import { ja } from "./locale/ja.js";

/** A registered language id, matched case-insensitively as the locale service does. */
function isLanguageRegistered(locale, id) {
  const snapshot = locale.getLocale();
  const wanted = id.toLowerCase();
  return snapshot.locales.some((language) => language.id.toLowerCase() === wanted);
}

/**
 * Whether Japanese is already registered for the Advisor namespace.
 *
 * The service keeps no public way to list a namespace's dictionaries, and every
 * public read follows the *active* language, so the registry itself is the only
 * honest source. `dicts` is a private field of the runtime; reading it is
 * defensively typed and a service that no longer exposes it reports "cannot
 * tell" rather than a wrong answer.
 *
 * @returns true when Japanese is registered, false when it is not, undefined
 * when the service cannot be asked.
 */
function japaneseDictionaryState(locale) {
  const dicts = locale.dicts;
  if (!(dicts instanceof Map)) return undefined;
  const namespaces = dicts.get(DICTIONARY_NAMESPACE);
  if (!(namespaces instanceof Map)) return undefined;
  return namespaces.has(JA);
}

/**
 * Make Japanese selectable, but only when nothing else already provides it.
 *
 * `LocaleRuntime.addLanguage` throws once an id is occupied, so a language pack
 * such as `@fang2hou/dsh-locale-ja` owns the definition whenever it is loaded
 * and this add-on then supplies only its dictionary. Registering again would not
 * change how Japanese looks, so the duplicate is reported as "already
 * available" instead of as a failure.
 *
 * @param locale - the Client locale service.
 * @returns whether this call supplied the definition, and its disposer when it did.
 */
export function registerJapaneseLanguage(locale) {
  if (isLanguageRegistered(locale, JA)) {
    return { registered: false, reason: "already-available" };
  }
  try {
    return { registered: true, reason: "registered", dispose: locale.addLanguage({ id: JA, label: JA_LABEL, fallback: "en" }) };
  } catch (error) {
    // A concurrent language pack won the race between the check and the write.
    if (isLanguageRegistered(locale, JA)) {
      return { registered: false, reason: "already-available" };
    }
    throw error;
  }
}

/**
 * Contribute the Japanese Advisor Settings copy to the Advisor's namespace.
 *
 * The dictionary is registered through the per-locale form, which adds one
 * `(namespace, locale)` pair. The Advisor core owns `en` in the same namespace
 * and no other dictionary is replaced, so an Advisor key this add-on does not
 * translate keeps rendering in English.
 *
 * An Advisor built before this copy moved out of the core still registers its
 * own `ja`, and the service refuses a second one. That duplicate is treated as
 * already-satisfied rather than an error, because the copy it holds is the same
 * copy this add-on carries and a fresh install must never break a page over it.
 * When Japanese is confirmed absent, a rejection means the service is refusing a
 * write it should have accepted, and that failure stays visible.
 *
 * @param locale - the Client locale service.
 * @returns idempotent disposer removing exactly this dictionary, plus the outcome.
 */
export function registerAdvisorDictionary(locale) {
  try {
    return { dispose: locale.register(DICTIONARY_NAMESPACE, JA, ja), applied: true };
  } catch (error) {
    if (!isDuplicateDictionary(error)) throw error;
    // Only a confirmed duplicate is absorbed; "cannot tell" stays visible.
    if (japaneseDictionaryState(locale) !== true) throw error;
    return { dispose: () => {}, applied: false, superseded: true };
  }
}

/** Whether the service rejected the write because this namespace already has Japanese. */
function isDuplicateDictionary(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("already has locale");
}

/**
 * Register the language when it is missing and always contribute the dictionary.
 *
 * The dictionary is registered first so a failing language registration can
 * never leave the page half-translated. Either way the contribution is an owned
 * effect, so Cordis disposes it when the plugin unloads and Japanese returns to
 * whichever provider was there before.
 *
 * @param ctx - the Client cordis context carrying the locale service.
 * @returns the outcome of this activation.
 */
export function installAdvisorJapanese(ctx) {
  const { locale } = ctx;
  // The registration stays inside the effect factory so Cordis owns exactly the
  // write this plugin performed, matching how every other locale pack registers.
  const applied = { applied: false };
  const disposers = [ctx.effect(() => {
    const dictionary = registerAdvisorDictionary(locale);
    applied.applied = dictionary.applied;
    return dictionary.dispose;
  }, "dsh-advisor-locale-ja: japanese dictionary")];
  const language = registerJapaneseLanguage(locale);
  if (language.registered) {
    const disposeLanguage = language.dispose;
    disposers.push(ctx.effect(
      () => disposeLanguage,
      "dsh-advisor-locale-ja: japanese language",
    ));
  }
  return { disposers, language, dictionary: applied };
}
