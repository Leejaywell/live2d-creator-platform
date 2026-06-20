import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StoredObject = {
  key: string;
  url: string;
};

const globalForStorage = globalThis as unknown as {
  s3Client?: S3Client;
};

// Local-filesystem fallback. When no object-storage bucket is configured (the
// default for local dev — PGlite, no S3, no Docker) every object is written
// under a local directory instead of S3. Production sets OBJECT_STORAGE_* and
// transparently uses the S3 path below.
function localStorageEnabled() {
  // Explicit override wins (STORAGE_DRIVER=local|s3); otherwise fall back to
  // local when no bucket is configured. This lets local dev keep stale
  // OBJECT_STORAGE_* values in .env while still using the filesystem store.
  const driver = process.env.STORAGE_DRIVER?.toLowerCase();
  if (driver === "local") return true;
  if (driver === "s3") return false;
  return !process.env.OBJECT_STORAGE_BUCKET;
}

const LOCAL_URL_PREFIX = "local://";

function localBaseDir() {
  return process.env.LOCAL_STORAGE_DIR
    ? path.resolve(process.env.LOCAL_STORAGE_DIR)
    : path.join(process.cwd(), ".local-storage");
}

// Resolve an object key to an absolute path inside the local store, rejecting
// any key that would escape the base directory (path traversal).
function localPathForKey(key: string) {
  const base = localBaseDir();
  const target = path.resolve(base, key);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return target;
}

function localMetaPath(filePath: string) {
  return `${filePath}.__meta.json`;
}

async function localPut(input: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  cacheControl?: string;
}): Promise<StoredObject> {
  const filePath = localPathForKey(input.key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, input.body);
  await writeFile(
    localMetaPath(filePath),
    JSON.stringify({ contentType: input.contentType, cacheControl: input.cacheControl ?? null }),
  );
  return { key: input.key, url: `${LOCAL_URL_PREFIX}${input.key}` };
}

async function localGet(key: string) {
  const filePath = localPathForKey(key);
  const body = await readFile(filePath);
  let contentType = "application/octet-stream";
  let cacheControl: string | undefined;
  try {
    const meta = JSON.parse(await readFile(localMetaPath(filePath), "utf8")) as {
      contentType?: string;
      cacheControl?: string | null;
    };
    if (meta.contentType) contentType = meta.contentType;
    if (meta.cacheControl) cacheControl = meta.cacheControl;
  } catch {
    // No sidecar metadata — fall back to the octet-stream default.
  }
  return { body, contentType, cacheControl };
}

function getStorageConfig() {
  const bucket = process.env.OBJECT_STORAGE_BUCKET;
  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT;
  const region = process.env.OBJECT_STORAGE_REGION ?? "auto";
  const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY;

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Object storage environment is not configured");
  }

  return {
    bucket,
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE !== "false",
  };
}

function getClient() {
  if (globalForStorage.s3Client) {
    return globalForStorage.s3Client;
  }

  const config = getStorageConfig();
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  if (process.env.NODE_ENV !== "production") {
    globalForStorage.s3Client = client;
  }

  return client;
}

export async function putObject(input: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  cacheControl?: string;
}) {
  if (localStorageEnabled()) {
    return localPut(input);
  }

  const config = getStorageConfig();
  await getClient().send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl,
    }),
  );

  return {
    key: input.key,
    url: `s3://${config.bucket}/${input.key}`,
  } satisfies StoredObject;
}

export async function signedGetUrl(key: string, expiresIn = Number(process.env.ASSET_SIGNED_URL_TTL_SECONDS || 900)) {
  if (localStorageEnabled()) {
    // No real signing locally. The default asset-delivery mode is app-proxy
    // (which never calls this); this exists so the readiness self-check and any
    // signed-redirect path resolve to a stable, local-only URL.
    return `${LOCAL_URL_PREFIX}${key}?ttl=${expiresIn}`;
  }
  const config = getStorageConfig();
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
    { expiresIn },
  );
}

export async function getObjectBytes(key: string) {
  if (localStorageEnabled()) {
    const { body, contentType } = await localGet(key);
    return { body, contentType };
  }

  const config = getStorageConfig();
  const response = await getClient().send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error(`Object ${key} has no body`);
  }

  return {
    body: Buffer.from(await response.Body.transformToByteArray()),
    contentType: response.ContentType ?? "application/octet-stream",
  };
}

export async function getObjectStream(key: string) {
  if (localStorageEnabled()) {
    const { body, contentType, cacheControl } = await localGet(key);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(body));
        controller.close();
      },
    });
    return { body: stream, contentType, contentLength: body.byteLength, cacheControl };
  }

  const config = getStorageConfig();
  const response = await getClient().send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error(`Object ${key} has no body`);
  }

  const body = response.Body as {
    transformToWebStream?: () => ReadableStream<Uint8Array>;
  };
  if (!body.transformToWebStream) {
    throw new Error(`Object ${key} cannot be streamed`);
  }

  return {
    body: body.transformToWebStream(),
    contentType: response.ContentType ?? "application/octet-stream",
    contentLength: response.ContentLength,
    cacheControl: response.CacheControl,
  };
}

export async function deleteObject(key: string) {
  if (localStorageEnabled()) {
    const filePath = localPathForKey(key);
    await rm(filePath, { force: true });
    await rm(localMetaPath(filePath), { force: true });
    return;
  }

  const config = getStorageConfig();
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );
}

export function parseStorageKey(value: string) {
  if (value.startsWith(LOCAL_URL_PREFIX)) {
    return value.slice(LOCAL_URL_PREFIX.length);
  }
  if (localStorageEnabled()) {
    return value;
  }
  const config = getStorageConfig();
  const prefix = `s3://${config.bucket}/`;
  if (value.startsWith(prefix)) {
    return value.slice(prefix.length);
  }
  return value;
}

export function modelAssetBaseKey(projectId: string, version: number) {
  return `projects/${projectId}/models/v${version}`;
}

// Stable content hash used by callers that want a deterministic object key.
export function contentHash(body: Buffer | Uint8Array) {
  return createHash("sha256").update(body).digest("hex");
}
