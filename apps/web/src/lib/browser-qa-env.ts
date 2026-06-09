import type { ScriptEnv } from "@/lib/env-file";

export type BrowserQaEnvValidation = {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
};

export function validateBrowserQaEnv(env: ScriptEnv, options: { requireLive2D?: boolean } = {}): BrowserQaEnvValidation {
  const checks = [
    required("QA_BASE_URL", env.QA_BASE_URL),
    required("QA_PROJECT_SLUG", env.QA_PROJECT_SLUG),
    required("QA_FAN_CODE", env.QA_FAN_CODE),
  ];

  if (options.requireLive2D) {
    checks.push({
      name: "qa_expect_live2d",
      ok: env.QA_EXPECT_LIVE2D === "true",
      detail: env.QA_EXPECT_LIVE2D === "true" ? undefined : "QA_EXPECT_LIVE2D must be true for production release audit",
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

function required(name: string, value: string | undefined) {
  return {
    name: name.toLowerCase(),
    ok: Boolean(value?.trim()),
    detail: value?.trim() ? undefined : `${name} is required`,
  };
}
