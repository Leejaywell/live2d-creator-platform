import path from "node:path";

export class InvalidLive2DModelJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLive2DModelJsonError";
  }
}

export type Model3Json = {
  FileReferences?: {
    Moc?: string;
    Textures?: string[];
    Physics?: string;
    Pose?: string;
    DisplayInfo?: string;
    Expressions?: Array<{ File?: string }>;
    Motions?: Record<string, Array<{ File?: string }>>;
  };
};

export function parseLive2DModelJson(input: Buffer | string): Model3Json {
  try {
    const parsed = JSON.parse(Buffer.isBuffer(input) ? input.toString("utf8") : input);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("model3.json must be an object");
    }
    return parsed as Model3Json;
  } catch {
    throw new InvalidLive2DModelJsonError("Stored Live2D model JSON is invalid");
  }
}

export function rewriteModelReferences(input: {
  modelJson: Model3Json;
  modelJsonKey: string;
  viewerSessionId: string;
  origin: string;
}) {
  const references = input.modelJson.FileReferences;
  if (!references) return input.modelJson;

  const baseKey = path.posix.dirname(input.modelJsonKey);
  const rewrite = (value?: string) => {
    if (!value) return value;
    const key = resolveModelReferenceKey(baseKey, value);
    const params = new URLSearchParams({
      key,
      viewerSessionId: input.viewerSessionId,
    });
    return `${input.origin}/api/assets/proxy?${params.toString()}`;
  };

  references.Moc = rewrite(references.Moc);
  references.Physics = rewrite(references.Physics);
  references.Pose = rewrite(references.Pose);
  references.DisplayInfo = rewrite(references.DisplayInfo);
  references.Textures = references.Textures?.map((texture) => rewrite(texture) ?? texture);
  references.Expressions = references.Expressions?.map((expression) => ({
    ...expression,
    File: rewrite(expression.File),
  }));
  references.Motions = Object.fromEntries(
    Object.entries(references.Motions ?? {}).map(([group, motions]) => [
      group,
      motions.map((motion) => ({
        ...motion,
        File: rewrite(motion.File),
      })),
    ]),
  );

  return input.modelJson;
}

function resolveModelReferenceKey(baseKey: string, reference: string) {
  const normalized = reference.replaceAll("\\", "/");
  if (normalized.includes("\0") || path.posix.isAbsolute(normalized)) {
    throw new InvalidLive2DModelJsonError("Stored Live2D model references an unsafe asset path");
  }

  const resolved = path.posix.normalize(path.posix.join(baseKey, normalized));
  if (resolved !== baseKey && !resolved.startsWith(`${baseKey}/`)) {
    throw new InvalidLive2DModelJsonError("Stored Live2D model references an asset outside the model directory");
  }
  return resolved;
}
