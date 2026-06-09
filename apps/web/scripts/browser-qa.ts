import { chromium, type Page } from "playwright";

import { loadEnvFileForScript, type ScriptEnv } from "../src/lib/env-file";
import { decodePngRgba } from "../src/lib/png-rgba";

type BrowserQaResult = {
  ok: boolean;
  checkedAt: string;
  baseUrl: string;
  projectSlug: string;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
};

async function main() {
  const loadedEnv = loadEnvFileForScript(valueAfter("--app-env-file") ?? ".env.qa");

  const baseUrl = requiredEnv(loadedEnv.env, "QA_BASE_URL").replace(/\/$/, "");
  const projectSlug = requiredEnv(loadedEnv.env, "QA_PROJECT_SLUG");
  const fanCode = requiredEnv(loadedEnv.env, "QA_FAN_CODE");
  const message = loadedEnv.env.QA_CHAT_MESSAGE ?? "你好";
  const expectLive2D = loadedEnv.env.QA_EXPECT_LIVE2D === "true";

  const browser = await chromium.launch({
    headless: loadedEnv.env.QA_HEADLESS !== "false",
  });
  const checks: BrowserQaResult["checks"] = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    page.on("pageerror", (error) => checks.push({ name: "page_error", ok: false, detail: error.message }));
    page.on("console", (message) => {
      if (message.type() === "error") {
        checks.push({ name: "console_error", ok: false, detail: message.text() });
      }
    });

    await check("audience_page_loads", checks, async () => {
      await page.goto(`${baseUrl}/c/${projectSlug}`, { waitUntil: "networkidle" });
      await page.getByTestId("audience-chat").waitFor({ state: "visible", timeout: 15_000 });
    });

    await check("fan_code_validation", checks, async () => {
      await page.getByTestId("fan-code-input").fill(fanCode);
      await page.getByTestId("fan-code-submit").click();
      await page.getByTestId("chat-form").waitFor({ state: "visible", timeout: 15_000 });
      await page.getByText(/messages remaining/).waitFor({ state: "visible", timeout: 15_000 });
    });

    await check("chat_reply", checks, async () => {
      await page.getByTestId("chat-message-input").fill(message);
      await page.getByTestId("chat-submit").click();
      await page.getByText(/Reply received|Triggered:/).waitFor({ state: "visible", timeout: 30_000 });
      const transcript = await page.getByTestId("chat-transcript").innerText();
      if (!transcript.includes("assistant")) {
        throw new Error("Assistant reply missing from transcript");
      }
    });

    if (expectLive2D) {
      await check("live2d_canvas_present", checks, async () => {
        await page.getByTestId("live2d-canvas").waitFor({ state: "visible", timeout: 15_000 });
        const box = await page.getByTestId("live2d-canvas").boundingBox();
        if (!box || box.width < 100 || box.height < 100) {
          throw new Error("Live2D canvas is not visibly sized");
        }
      });
      await check("live2d_canvas_nonblank", checks, async () => assertCanvasHasPixels(page));
    }
  } finally {
    await browser.close();
  }

  const report: BrowserQaResult = {
    ok: checks.every((item) => item.ok),
    checkedAt: new Date().toISOString(),
    baseUrl,
    projectSlug,
    checks,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

async function check(name: string, checks: BrowserQaResult["checks"], run: () => Promise<void>) {
  try {
    await run();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, detail: error instanceof Error ? error.message : "Unknown failure" });
  }
}

async function assertCanvasHasPixels(page: Page) {
  const screenshot = await page.getByTestId("live2d-canvas").screenshot();
  const image = decodePngRgba(screenshot);
  const background = `${image.pixels[0]},${image.pixels[1]},${image.pixels[2]},${image.pixels[3]}`;
  let differingPixels = 0;
  const minDifferingPixels = Math.max(50, Math.floor(image.width * image.height * 0.001));

  for (let index = 0; index < image.pixels.length; index += 4) {
    const current = `${image.pixels[index]},${image.pixels[index + 1]},${image.pixels[index + 2]},${image.pixels[index + 3]}`;
    if (current !== background) {
      differingPixels += 1;
      if (differingPixels >= minDifferingPixels) break;
    }
  }

  const nonBlank = differingPixels >= minDifferingPixels;

  if (!nonBlank) {
    throw new Error("Live2D canvas rendered blank pixels");
  }
}

function requiredEnv(env: ScriptEnv, name: string) {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function valueAfter(flag: string) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
