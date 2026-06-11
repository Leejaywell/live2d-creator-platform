export type ModelExpression = { name: string; file: string };
export type ModelMotion = { group: string; index: number; file: string };
export type ModelCapabilities = { expressions: ModelExpression[]; motions: ModelMotion[] };

type UnknownRecord = Record<string, unknown>;
const isRecord = (v: unknown): v is UnknownRecord => typeof v === "object" && v !== null;

// Parses a Cubism 4 model3.json object into the expressions and motions a
// creator can bind trigger tags to. Tolerant of missing/odd shapes (e.g. Azur
// Lane models with a single unnamed motion group and no expressions).
export function parseModelCapabilities(model3: unknown): ModelCapabilities {
  const empty: ModelCapabilities = { expressions: [], motions: [] };
  if (!isRecord(model3)) return empty;
  const fileReferences = model3.FileReferences;
  if (!isRecord(fileReferences)) return empty;

  const expressions: ModelExpression[] = Array.isArray(fileReferences.Expressions)
    ? fileReferences.Expressions.flatMap((entry) =>
        isRecord(entry) && typeof entry.File === "string"
          ? [{ name: typeof entry.Name === "string" ? entry.Name : entry.File, file: entry.File }]
          : [],
      )
    : [];

  const motions: ModelMotion[] = [];
  if (isRecord(fileReferences.Motions)) {
    for (const [group, list] of Object.entries(fileReferences.Motions)) {
      if (!Array.isArray(list)) continue;
      list.forEach((item, index) => {
        if (isRecord(item) && typeof item.File === "string") {
          motions.push({ group, index, file: item.File });
        }
      });
    }
  }

  return { expressions, motions };
}
