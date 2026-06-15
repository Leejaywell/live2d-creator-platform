import { loadProductionEnvForValidation } from "../src/lib/production-env-file";
import { validateProductionEnv } from "../src/lib/production-env";

async function main() {
  if (process.argv.includes("--help")) {
    printHelp();
    return;
  }

  const envFile = valueAfter("--app-env-file") ?? ".env.production";
  const loadedEnv = loadProductionEnvForValidation(envFile);

  const report = validateProductionEnv(loadedEnv.env, envFile);
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
  console.log(`Validate production environment variables without contacting providers.

Usage:
  npm run env:validate:production -- --app-env-file .env.production

Checks:
  - required production variables are present
  - placeholder/example values are rejected
  - secrets have minimum length
  - public/provider URLs use production-safe schemes
  - production-only modes are enforced for rate limiting, CSP, and HSTS
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
