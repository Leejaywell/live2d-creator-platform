import { loadEnvFileForScript } from "./env-file";
import type { ProductionEnv } from "./production-env";

export type ProductionEnvLoadResult = {
  env: ProductionEnv;
  envFile: string;
  source: "file" | "process";
};

export function loadProductionEnvForValidation(envFile: string, processEnv: ProductionEnv = process.env): ProductionEnvLoadResult {
  return loadEnvFileForScript(envFile, processEnv);
}
