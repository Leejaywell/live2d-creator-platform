import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StoredObject = {
  key: string;
  url: string;
};

const globalForStorage = globalThis as unknown as {
  s3Client?: S3Client;
};

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
  const config = getStorageConfig();
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );
}

export function parseStorageKey(value: string) {
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
