import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type QaModelZipSource = {
  path?: string;
  url?: string;
  sha256?: string;
  allowInsecureUrl?: boolean;
  fetchImpl?: typeof fetch;
};

export type LoadedQaModelZip = {
  fileName: string;
  data: Buffer;
  source: "path" | "url";
  sha256: string;
};

export async function loadQaModelZip(input: QaModelZipSource): Promise<LoadedQaModelZip | undefined> {
  if (input.path && input.url) {
    throw new Error("Set only one of QA_MODEL_ZIP_PATH or QA_MODEL_ZIP_URL");
  }

  if (input.path) {
    return loadQaModelZipFromPath(input.path, input.sha256);
  }

  if (input.url) {
    return loadQaModelZipFromUrl(input.url, input.sha256, input.allowInsecureUrl, input.fetchImpl ?? fetch);
  }

  return undefined;
}

function loadQaModelZipFromPath(modelZipPath: string, expectedSha256: string | undefined): LoadedQaModelZip {
  const absolutePath = path.resolve(modelZipPath);
  if (!existsSync(absolutePath)) {
    throw new Error(`QA_MODEL_ZIP_PATH does not exist: ${absolutePath}`);
  }

  const data = readFileSync(absolutePath);
  const sha256 = verifySha256(data, expectedSha256);
  return {
    fileName: path.basename(absolutePath),
    data,
    source: "path",
    sha256,
  };
}

async function loadQaModelZipFromUrl(
  modelZipUrl: string,
  expectedSha256: string | undefined,
  allowInsecureUrl: boolean | undefined,
  fetchImpl: typeof fetch,
): Promise<LoadedQaModelZip> {
  const url = new URL(modelZipUrl);
  if (url.protocol !== "https:" && !allowInsecureUrl) {
    throw new Error("QA_MODEL_ZIP_URL must be HTTPS");
  }

  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`QA_MODEL_ZIP_URL returned ${response.status}`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  const sha256 = verifySha256(data, expectedSha256);
  return {
    fileName: fileNameFromUrlOrHeader(url, response.headers.get("content-disposition")),
    data,
    source: "url",
    sha256,
  };
}

function verifySha256(data: Buffer, expectedSha256: string | undefined) {
  const actual = createHash("sha256").update(data).digest("hex");
  if (expectedSha256 && actual !== expectedSha256.toLowerCase()) {
    throw new Error("QA_MODEL_ZIP_SHA256 does not match downloaded model zip");
  }
  return actual;
}

function fileNameFromUrlOrHeader(url: URL, contentDisposition: string | null) {
  const headerName = contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1];
  const name = headerName || path.basename(url.pathname);
  return name && name.toLowerCase().endsWith(".zip") ? name : "qa-live2d-model.zip";
}
