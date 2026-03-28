const { spawnSync } = require("node:child_process");
const path = require("node:path");

const scriptPath = path.join(__dirname, "health-check.mjs");
const extraArgs = process.argv.slice(2);
const baseUrl = process.env.HEALTHCHECK_BASE_URL || process.argv[2] || "";
const hasOriginArg = extraArgs.some((arg) => arg === "--origin" || arg.startsWith("--origin="));

const args = [scriptPath, "--mode", "smoke"];

if (baseUrl && !hasOriginArg) {
  args.push("--origin", baseUrl);
}

for (const arg of extraArgs) {
  if (arg === baseUrl && !hasOriginArg) continue;
  args.push(arg);
}

const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(result.error.stack || String(result.error));
  process.exit(1);
}

process.exit(result.status == null ? 1 : result.status);
