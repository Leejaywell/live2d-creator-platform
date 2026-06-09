import { loadEnvFileForScript } from "../src/lib/env-file";
import { validateBrowserQaEnv } from "../src/lib/browser-qa-env";

async function main() {
  if (process.argv.includes("--help")) {
    printHelp();
    return;
  }

  const envFile = valueAfter("--app-env-file") ?? ".env.qa";
  const report = {
    envFile,
    requireLive2D: process.argv.includes("--require-live2d"),
    ...validateBrowserQaEnv(loadEnvFileForScript(envFile).env, { requireLive2D: process.argv.includes("--require-live2d") }),
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

function valueAfter(flag: string) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function printHelp() {
  console.log(`Validate browser QA environment variables.

Usage:
  npx tsx scripts/validate-browser-qa-env.ts --app-env-file .env.qa
  npx tsx scripts/validate-browser-qa-env.ts --app-env-file /dev/null --require-live2d

Checks:
  - QA_BASE_URL is present
  - QA_PROJECT_SLUG is present
  - QA_FAN_CODE is present
  - QA_EXPECT_LIVE2D=true when --require-live2d is passed
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
