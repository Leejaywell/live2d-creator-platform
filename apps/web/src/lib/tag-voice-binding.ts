// The TriggerTag <-> VoiceAsset M2M relation is the single source of truth the
// chat/tap runtime reads (chat-effects.buildTriggeredVoiceAssets). This builds
// the Prisma `set` payload that makes a tag's bound voices exactly `voiceIds`.
// Pure (no Prisma import) so it can be unit-tested without a database.
export function setTagVoicesData(voiceIds: string[]) {
  const unique = Array.from(new Set(voiceIds));
  return { voiceAssets: { set: unique.map((id) => ({ id })) } };
}
