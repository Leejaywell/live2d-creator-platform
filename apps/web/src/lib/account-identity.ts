export function normalizeUsername(username: string) {
  const value = username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(value)) {
    throw new Error("Username must be 3-32 characters using letters, numbers, underscore, or hyphen");
  }
  return value;
}

export function internalEmailForUsername(username: string) {
  return `${normalizeUsername(username)}@accounts.live2d.local`;
}
