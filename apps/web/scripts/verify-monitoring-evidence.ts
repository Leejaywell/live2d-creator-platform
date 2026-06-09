import { verifyProductionMonitoringEvidence } from "../src/lib/monitoring-evidence";

const args = process.argv.slice(2);

async function main() {
  if (args.includes("--help")) {
    printHelp();
    return;
  }

  const report = verifyProductionMonitoringEvidence(valueAfter("--evidence") ?? "artifacts/monitoring-production.json", {
    maxEvidenceAgeHours: numberAfter("--max-age-hours"),
  });
  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
}

function valueAfter(flag: string) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function numberAfter(flag: string) {
  const value = valueAfter(flag);
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive number`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Verify production monitoring evidence.

Usage:
  npm run monitoring:evidence:verify
  npm run monitoring:evidence:verify -- --evidence artifacts/monitoring-production.json

Checks:
  - production HTTPS deployBaseUrl
  - live2d-web metrics scrape is up with samples
  - live2d-health-full blackbox probe succeeds
  - every production alert has fired and resolved

Options:
  --max-age-hours <hours>  Reject stale monitoring evidence.
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
