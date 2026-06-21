import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  type Model3Json,
  parseLive2DModelJson,
  resolveModelReferenceKey,
} from "@/lib/live2d-model-proxy";
import { getObjectBytes } from "@/lib/storage";

// Maps file extensions to MIME types for data-URL embedding. Live2D references
// model3/moc3/physics/motion JSON (treated as text/json), textures (png), and
// optionally bundled sounds; voices ship as ogg/mp3/wav.
const MIME_BY_EXT: Record<string, string> = {
  ".json": "application/json",
  ".moc3": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".js": "text/javascript",
  ".css": "text/css",
};

function guessMime(ref: string): string {
  const ext = path.posix.extname(ref.split("?")[0]).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function toDataUrl(bytes: Buffer, mime: string): string {
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

/**
 * Read a project asset reference into bytes, transparently handling the three
 * shapes the platform uses:
 *   - a static public path ("/live2d/audio/.../home.ogg") -> read from public/
 *   - an absolute http(s) URL -> fetched (best-effort; remote assets)
 *   - anything else -> an object-storage key (creator uploads) via getObjectBytes
 * Returns null when the reference is empty or cannot be read, so a single
 * missing asset never aborts the whole export.
 */
export async function readReferenceBytes(ref: string | null | undefined): Promise<Buffer | null> {
  if (!ref) return null;
  try {
    if (ref.startsWith("http://") || ref.startsWith("https://")) {
      const response = await fetch(ref);
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    }
    if (ref.startsWith("/")) {
      // Public static asset — resolve under the app's public directory, rejecting
      // any traversal outside it.
      const publicDir = path.join(process.cwd(), "public");
      const target = path.resolve(publicDir, `.${ref}`);
      if (target !== publicDir && !target.startsWith(publicDir + path.sep)) return null;
      return await readFile(target);
    }
    const { body } = await getObjectBytes(ref);
    return Buffer.isBuffer(body) ? body : Buffer.from(body);
  } catch {
    return null;
  }
}

/** Read an asset reference and return a base64 data URL, or null when missing. */
export async function readReferenceDataUrl(ref: string | null | undefined): Promise<string | null> {
  const bytes = await readReferenceBytes(ref);
  if (!bytes) return null;
  return toDataUrl(bytes, guessMime(ref ?? ""));
}

/**
 * Load the model3.json for a project from storage and rewrite every file
 * reference (moc/textures/physics/pose/expressions/motions/sounds) to an
 * inline base64 data URL. The result is fully self-contained: the standalone
 * viewer hands it straight to Live2DModel.from() with no network access.
 */
export async function embedModelReferences(modelJsonKey: string): Promise<Model3Json> {
  const { body } = await getObjectBytes(modelJsonKey);
  const modelJson = parseLive2DModelJson(body);
  const references = modelJson.FileReferences;
  if (!references) return modelJson;

  const baseKey = path.posix.dirname(modelJsonKey);
  // Cache by storage key so shared textures/motions are read & encoded once.
  const cache = new Map<string, string | null>();
  const embed = async (value?: string): Promise<string | undefined> => {
    if (!value) return value;
    // A single unsafe/unreadable reference must not abort the whole export — keep
    // the original value so the rest of the model still embeds.
    let key: string;
    try {
      key = resolveModelReferenceKey(baseKey, value);
    } catch {
      return value;
    }
    if (!cache.has(key)) {
      const bytes = await readReferenceBytes(key);
      cache.set(key, bytes ? toDataUrl(bytes, guessMime(value)) : null);
    }
    return cache.get(key) ?? value;
  };

  references.Moc = await embed(references.Moc);
  references.Physics = await embed(references.Physics);
  references.Pose = await embed(references.Pose);
  references.DisplayInfo = await embed(references.DisplayInfo);
  if (references.Textures) {
    references.Textures = await Promise.all(references.Textures.map(async (t) => (await embed(t)) ?? t));
  }
  if (references.Expressions) {
    references.Expressions = await Promise.all(
      references.Expressions.map(async (expression) => ({ ...expression, File: await embed(expression.File) })),
    );
  }
  if (references.Motions) {
    const motionEntries = await Promise.all(
      Object.entries(references.Motions).map(async ([group, motions]) => {
        const embedded = await Promise.all(
          motions.map(async (motion) => ({
            ...motion,
            File: await embed(motion.File),
            Sound: await embed(motion.Sound),
          })),
        );
        return [group, embedded] as const;
      }),
    );
    references.Motions = Object.fromEntries(motionEntries);
  }

  return modelJson;
}
