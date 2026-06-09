import { applyScriptEnvToProcess, loadEnvFileForScript } from "../src/lib/env-file";

import type { ReadinessMode } from "../src/lib/readiness";

async function main() {
  const envFile = valueAfter("--app-env-file") ?? ".env";
  const loadedEnv = loadEnvFileForScript(envFile);
  const appEnvKeys = Object.keys(loadEnvFileForScript(".env.example").env);
  applyScriptEnvToProcess(loadedEnv, appEnvKeys);

  const mode = process.argv.includes("--full") ? "full" : "basic";
  const { runReadinessChecks } = await import("../src/lib/readiness");
  const report = await runReadinessChecks({ mode: mode as ReadinessMode });
  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function valueAfter(flag: string) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}
