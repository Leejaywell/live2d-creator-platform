import { existsSync, readFileSync } from "node:fs";

import { parse } from "dotenv";

export type ScriptEnv = Record<string, string | undefined>;

export type ScriptEnvLoadResult = {
  env: ScriptEnv;
  envFile: string;
  source: "file" | "process";
};

export function loadEnvFileForScript(envFile: string, processEnv: ScriptEnv = process.env): ScriptEnvLoadResult {
  if (envFile === "/dev/null") {
    return {
      env: processEnv,
      envFile,
      source: "process",
    };
  }

  if (!existsSync(envFile)) {
    return {
      env: {},
      envFile,
      source: "file",
    };
  }

  return {
    env: parse(readFileSync(envFile)),
    envFile,
    source: "file",
  };
}

export function applyScriptEnvToProcess(loadedEnv: ScriptEnvLoadResult, keysToClear: string[] = []) {
  if (loadedEnv.source === "file") {
    for (const key of keysToClear) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(loadedEnv.env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
