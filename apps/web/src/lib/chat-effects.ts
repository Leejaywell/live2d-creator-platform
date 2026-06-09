export type TriggeredVoiceAsset = {
  id: string;
  name: string;
  url: string;
  tag: string;
};

export type TriggeredVoiceAssetReference = {
  id: string;
  name: string;
  tag: string;
};

export type Live2DParamEffect = {
  id: string;
  value: number;
};

export type TriggeredLive2DEffect = {
  tag: string;
  params: Live2DParamEffect[];
};

type VoiceAssetBinding = {
  id: string;
  name: string;
  audioUrl: string;
  status: string;
};

type TriggerTagBinding = {
  name: string;
  live2dExpression?: string | null;
  live2dParams?: unknown;
  voiceAssets: VoiceAssetBinding[];
};

export function buildTriggeredVoiceAssets(input: {
  tags: string[];
  triggerTags: TriggerTagBinding[];
  viewerSessionId: string;
}) {
  return buildTriggeredVoiceAssetReferences(input).map((voice) => {
    const params = new URLSearchParams({
      key: voice.audioUrl,
      viewerSessionId: input.viewerSessionId,
    });
    return {
      id: voice.id,
      name: voice.name,
      tag: voice.tag,
      url: `/api/assets/proxy?${params.toString()}`,
    };
  });
}

export function buildTriggeredVoiceAssetReferences(input: {
  tags: string[];
  triggerTags: TriggerTagBinding[];
}) {
  const tagSet = new Set(input.tags);
  const seenVoiceIds = new Set<string>();
  const voices: Array<TriggeredVoiceAssetReference & { audioUrl: string }> = [];

  for (const tag of input.triggerTags) {
    if (!tagSet.has(tag.name)) continue;

    for (const voice of tag.voiceAssets) {
      if (voice.status !== "active" || seenVoiceIds.has(voice.id)) continue;
      seenVoiceIds.add(voice.id);
      voices.push({
        id: voice.id,
        name: voice.name,
        tag: tag.name,
        audioUrl: voice.audioUrl,
      });
    }
  }

  return voices;
}

export function buildTriggeredLive2DEffects(input: {
  tags: string[];
  triggerTags: TriggerTagBinding[];
}) {
  const tagSet = new Set(input.tags);
  const effects: TriggeredLive2DEffect[] = [];

  for (const tag of input.triggerTags) {
    if (!tagSet.has(tag.name)) continue;

    const params = [
      ...normalizeLive2DParams(tag.live2dParams),
      ...normalizeLive2DExpression(tag.live2dExpression),
    ];
    if (params.length) {
      effects.push({ tag: tag.name, params });
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

function normalizeLive2DExpression(value: string | null | undefined): Live2DParamEffect[] {
  if (!value) return [];
  const match = value.trim().match(/^([A-Za-z0-9_.-]+)\s*=\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return [];
  return [{ id: match[1], value: Number(match[2]) }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
