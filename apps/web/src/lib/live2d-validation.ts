import path from "node:path";

import JSZip from "jszip";
import { z } from "zod";

const allowedExtensions = new Set([
  ".json",
  ".moc3",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".motion3.json",
  ".exp3.json",
  ".physics3.json",
  ".pose3.json",
  ".userdata3.json",
]);

const model3Schema = z.object({
  Version: z.number(),
  FileReferences: z
    .object({
      Moc: z.string().optional(),
      Textures: z.array(z.string()).optional(),
      Physics: z.string().optional(),
      Pose: z.string().optional(),
      DisplayInfo: z.string().optional(),
      Expressions: z.array(z.object({ File: z.string() })).optional(),
      Motions: z.record(z.string(), z.array(z.object({ File: z.string() }))).optional(),
    })
    .optional(),
});

export type Live2DValidationResult =
  | {
      ok: true;
      modelJsonPath: string;
      referencedFiles: string[];
      warnings: string[];
    }
  | {
      ok: false;
      errors: string[];
    };

export type Live2DZipFile = {
  path: string;
  data: Buffer;
  contentType: string;
};

export async function validateLive2DZip(input: Buffer | ArrayBuffer, maxBytes = Number(process.env.MAX_LIVE2D_ZIP_BYTES || 104857600)): Promise<Live2DValidationResult> {
  const data = Buffer.isBuffer(input) ? input : Buffer.from(new Uint8Array(input));
  const size = data.byteLength;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (size > maxBytes) {
    return { ok: false, errors: [`Zip exceeds max size of ${maxBytes} bytes`] };
  }

  const zip = await loadZip(data);
  if (!zip) {
    return { ok: false, errors: ["Upload is not a readable zip file"] };
  }
  const files = Object.values(zip.files).filter((file) => !file.dir);
  const fileNames = new Set(files.map((file) => normalizeZipPath(file.name)));

  for (const file of files) {
    const name = normalizeZipPath(file.name);
    if (isUnsafeZipPath(name)) {
      errors.push(`Unsafe zip path: ${file.name}`);
    }
    if (!isAllowedLive2DExtension(name)) {
      errors.push(`Disallowed file extension: ${file.name}`);
    }
  }

  const modelJsonFiles = files.filter((file) => file.name.endsWith(".model3.json"));
  if (modelJsonFiles.length !== 1) {
    errors.push(`Expected exactly one model3.json file, found ${modelJsonFiles.length}`);
  }

  if (errors.length || modelJsonFiles.length !== 1) {
    return { ok: false, errors };
  }

  const modelJsonPath = normalizeZipPath(modelJsonFiles[0].name);
  const modelDir = path.posix.dirname(modelJsonPath);
  const rawModel = await modelJsonFiles[0].async("string");
  const parsedModel = parseModelJson(rawModel);
  if (!parsedModel) {
    return { ok: false, errors: ["model3.json is not valid JSON"] };
  }
  const parsed = model3Schema.safeParse(parsedModel);

  if (!parsed.success) {
    return { ok: false, errors: ["model3.json is not a supported Cubism 4 model file"] };
  }

  if (parsed.data.Version !== 3) {
    errors.push(`Unsupported model3.json Version: ${parsed.data.Version}`);
  }

  const references = collectModelReferences(parsed.data.FileReferences);
  for (const reference of references) {
    const resolved = normalizeZipPath(path.posix.join(modelDir, reference));
    if (isUnsafeZipPath(resolved)) {
      errors.push(`Unsafe referenced path: ${reference}`);
      continue;
    }
    if (!fileNames.has(resolved)) {
      errors.push(`Referenced file missing from zip: ${reference}`);
    }
  }

  if (!references.length) {
    warnings.push("model3.json does not declare texture, moc, expression, motion, physics, or pose references");
  }

  return errors.length
    ? { ok: false, errors }
    : {
        ok: true,
        modelJsonPath,
        referencedFiles: references,
        warnings,
      };
}

export async function extractLive2DZipFiles(input: Buffer | ArrayBuffer): Promise<Live2DZipFile[]> {
  const data = Buffer.isBuffer(input) ? input : Buffer.from(new Uint8Array(input));
  const zip = await JSZip.loadAsync(data);
  const files = Object.values(zip.files).filter((file) => !file.dir);

  return Promise.all(
    files.map(async (file) => {
      const filePath = normalizeZipPath(file.name);
      if (isUnsafeZipPath(filePath) || !isAllowedLive2DExtension(filePath)) {
        throw new Error(`Unsafe or disallowed Live2D asset path: ${file.name}`);
      }
      return {
        path: filePath,
        data: await file.async("nodebuffer"),
        contentType: contentTypeForPath(filePath),
      };
    }),
  );
}

function collectModelReferences(fileReferences: z.infer<typeof model3Schema>["FileReferences"]) {
  if (!fileReferences) return [];

  const refs = [
    fileReferences.Moc,
    fileReferences.Physics,
    fileReferences.Pose,
    fileReferences.DisplayInfo,
    ...(fileReferences.Textures ?? []),
    ...(fileReferences.Expressions ?? []).map((expression) => expression.File),
    ...Object.values(fileReferences.Motions ?? {}).flatMap((motions) => motions.map((motion) => motion.File)),
  ];

  return refs.filter(Boolean) as string[];
}

function parseModelJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function loadZip(data: Buffer) {
  try {
    return await JSZip.loadAsync(data);
  } catch {
    return null;
  }
}

function normalizeZipPath(value: string) {
  return value.replaceAll("\\", "/").replace(/^\/+/, "");
}

function isUnsafeZipPath(value: string) {
  return value.includes("\0") || value.startsWith("../") || value.includes("/../") || path.posix.isAbsolute(value);
}

function isAllowedLive2DExtension(value: string) {
  return [...allowedExtensions].some((extension) => value.toLowerCase().endsWith(extension));
}

function contentTypeForPath(value: string) {
  const lower = value.toLowerCase();
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".moc3")) return "application/octet-stream";
  return "application/octet-stream";
}
