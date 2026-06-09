export function projectIdFromStorageKey(key: string) {
  const match = key.match(/^projects\/([^/]+)\//);
  return match?.[1] ?? null;
}
