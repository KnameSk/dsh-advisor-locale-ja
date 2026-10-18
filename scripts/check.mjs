/**
 * Verify the shipped package without a Harness and without npm.
 *
 * Three properties matter for a locale add-on: every JavaScript module parses,
 * the committed browser bundle matches its source, and the manifest still points
 * DSH at the artifacts that actually exist. `npm pack` is deliberately not used
 * so this runs in any Node-only environment (including CI on a bare runner).
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

async function collect(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path, extension));
    else if (entry.name.endsWith(extension)) files.push(path);
  }
  return files;
}

const targets = [
  ...await collect(join(root, "dsh"), ".js"),
  ...await collect(join(root, "test"), ".mjs"),
  join(root, "scripts", "build-client.mjs"),
  join(root, "scripts", "check.mjs"),
];

for (const file of targets) {
  // Inherited stdio keeps the child's parser diagnostic visible without a pipe.
  const result = spawnSync(process.execPath, ["--check", file], { stdio: ["ignore", "inherit", "inherit"] });
  if (result.status !== 0 || result.error) {
    failures.push(`${relative(root, file)}${result.error ? `: ${result.error.message}` : ""}`);
  }
}

/** Every file the manifest promises must exist, and the bundle must be fresh. */
async function checkManifest() {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const expected = [
    [manifest.name, "dsh-advisor-locale-ja", "package name"],
    [manifest.main, "dsh/index.js", "Host entry"],
    [manifest.exports["."], "./dsh/index.js", "default export"],
    [manifest.exports["./client"], "./dsh/client.js", "served Client bundle"],
    [manifest.dsh.bundle.patch, "./cordis.patch.yml", "Loader patch"],
    [manifest.dsh.client.platform, "web", "Client platform"],
  ];
  for (const [actual, should, label] of expected) {
    if (actual !== should) failures.push(`${label}: ${actual} (expected ${should})`);
  }
  if (manifest.dsh.client.immediately !== true) failures.push("the Client half must mount immediately to register a language");
  if (!manifest.dsh.client.inject.includes("@deepseek-ai/dsh-client-locale")) {
    failures.push("the Client half must inject @deepseek-ai/dsh-client-locale");
  }
  for (const entry of manifest.files) {
    if (entry.includes("*")) continue;
    try {
      await stat(join(root, entry));
    } catch {
      failures.push(`files lists a missing path: ${entry}`);
    }
  }
  // The package ships built artifacts only, never the module sources behind them.
  const sources = ["dsh/client/index.js", "dsh/client/japanese.js", "dsh/client/constants.js", "dsh/client/locale/ja.js"];
  for (const source of sources) {
    if (manifest.files.includes(source)) failures.push(`files ships a source module: ${source}`);
  }
  for (const directory of manifest.files.filter((entry) => entry.endsWith("/"))) {
    if (sources.some((source) => source.startsWith(directory))) {
      failures.push(`files ships the source directory ${directory}`);
    }
  }
}

await checkManifest();

// A stale browser bundle would ship different code than this source tree.
const rebuild = spawnSync(process.execPath, [join(root, "scripts", "build-client.mjs"), "--check"], {
  cwd: root,
  stdio: ["ignore", "inherit", "inherit"],
});
if (rebuild.status !== 0 || rebuild.error) {
  failures.push(`dsh/client.js freshness check${rebuild.error ? `: ${rebuild.error.message}` : ""}`);
}

if (failures.length) {
  console.error(`check failed for ${failures.length} item(s):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`check ok: ${targets.length} modules parse as ESM, the manifest is intact, and the bundle is current`);
}
