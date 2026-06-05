import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const repoRoot = resolve(root, "..");
const nodeBin = process.env.EPIVIDA_NODE_BIN || process.execPath;
const strictSyntax = process.env.EPIVIDA_STRICT_SYNTAX === "1";

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

async function runScript(label, file, env = {}) {
  const previous = {};
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }
  try {
    await import(pathToFileURL(join(repoRoot, file)).href);
  } catch (error) {
    throw new Error(`${label} fallo: ${error?.message || error}`);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function runCheck(label, args) {
  const result = spawnSync(nodeBin, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
    stdio: "pipe"
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error && ["EPERM", "EACCES"].includes(result.error.code) && !strictSyntax) {
    console.warn(`${label} no verificado por bloqueo del sandbox. CI lo ejecuta con EPIVIDA_STRICT_SYNTAX=1.`);
    return;
  }
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || `status ${result.status}`;
    throw new Error(`${label} fallo: ${detail}`);
  }
}

await runScript("validate-lite", "lite/tools/validate-lite.mjs");
await runScript("validate-local-qa", "lite/tools/validate-local-qa.mjs");
await runScript("validate-deploy-config", "lite/tools/validate-deploy-config.mjs");
await runScript("validate-security-config", "lite/tools/validate-security-config.mjs");
await runScript("validate-offline-queue", "lite/tools/validate-offline-queue.mjs");
await runScript("validate-round-helpers", "lite/tools/validate-round-helpers.mjs");

const syntaxFiles = [
  ...walk(join(root, "src")).filter(file => extname(file) === ".js"),
  join(root, "epivida-lite-config.js"),
  join(root, "epivida-lite-sw.js"),
  join(root, "tools/prepare-user-seed.mjs"),
  join(root, "tools/validate-all.mjs"),
  join(root, "tools/validate-deploy-config.mjs"),
  join(root, "tools/validate-lite.mjs"),
  join(root, "tools/validate-local-qa.mjs"),
  join(root, "tools/validate-migration-package.mjs"),
  join(root, "tools/validate-offline-queue.mjs"),
  join(root, "tools/validate-round-helpers.mjs"),
  join(root, "tools/validate-security-config.mjs")
];

for (const file of syntaxFiles) {
  runCheck(`node --check ${relative(repoRoot, file)}`, ["--check", file]);
}

console.log(`EPIVIDA Lite full validation OK (${syntaxFiles.length} syntax files)`);
