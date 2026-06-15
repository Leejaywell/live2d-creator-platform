export type Live2DParamEffect = {
  id: string;
  value: number;
};

export type TriggeredLive2DEffect = {
  tag: string;
  params: Live2DParamEffect[];
  expression?: string;
};

type TriggerTagBinding = {
  name: string;
  live2dExpression?: string | null;
  live2dParams?: unknown;
};

export function buildTriggeredLive2DEffects(input: {
  tags: string[];
  triggerTags: TriggerTagBinding[];
}) {
  const tagSet = new Set(input.tags);
  const effects: TriggeredLive2DEffect[] = [];

  for (const tag of input.triggerTags) {
    if (!tagSet.has(tag.name)) continue;

    const params = normalizeLive2DParams(tag.live2dParams);
    let expression: string | undefined = undefined;

    const exprStr = tag.live2dExpression?.trim();
    if (exprStr) {
      const match = exprStr.match(/^([A-Za-z0-9_.-]+)\s*=\s*(-?\d+(?:\.\d+)?)$/);
      if (match) {
        params.push({ id: match[1], value: Number(match[2]) });
      } else {
        expression = exprStr;
      }
    }

    if (params.length || expression) {
      effects.push({
        tag: tag.name,
        params,
        ...(expression !== undefined ? { expression } : {}),
      });
    }
  }

  return effects;
}

function normalizeLive2DParams(value: unknown): Live2DParamEffect[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!isRecord(item) || typeof item.id !== "string" || typeof item.value !== "number") {
        return [];
      }
      return [{ id: item.id, value: item.value }];
    });
  }

  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([id, paramValue]) => (typeof paramValue === "number" ? [{ id, value: paramValue }] : []));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
