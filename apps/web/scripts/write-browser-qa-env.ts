import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);

async function main() {
  if (args.includes("--help")) {
    printHelp();
    return;
  }

  const output = valueAfter("--output") ?? ".env.qa";
  const entries = [
    ["QA_BASE_URL", requiredEnv("QA_BASE_URL")],
    ["QA_PROJECT_SLUG", requiredEnv("QA_PROJECT_SLUG")],
    ["QA_FAN_CODE", requiredEnv("QA_FAN_CODE")],
    ["QA_CHAT_MESSAGE", process.env.QA_CHAT_MESSAGE || "你好"],
    ["QA_EXPECT_LIVE2D", requiredEnv("QA_EXPECT_LIVE2D")],
    ["QA_HEADLESS", process.env.QA_HEADLESS || "true"],
  ];

  writeFileSync(output, `${entries.map(([key, value]) => `${key}=${quote(value)}`).join("\n")}\n`);
  console.log(JSON.stringify({ ok: true, output, projectSlug: process.env.QA_PROJECT_SLUG }, null, 2));
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function valueAfter(flag: string) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function quote(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function printHelp() {
  console.log(`Write a browser QA env file from QA_* environment variables.

Usage:
  QA_BASE_URL=https://app.example.com QA_PROJECT_SLUG=qa QA_FAN_CODE=... QA_EXPECT_LIVE2D=true npm run qa:env:write
  npm run qa:env:write -- --output .env.qa.release

Required environment:
  QA_BASE_URL, QA_PROJECT_SLUG, QA_FAN_CODE, QA_EXPECT_LIVE2D
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
