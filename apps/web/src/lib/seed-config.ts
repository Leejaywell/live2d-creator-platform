export type SeedConfig = {
  superAdminUsername: string;
  superAdminPassword: string;
  creatorUsername: string;
  creatorPassword: string;
};

const defaultSuperAdminUsername = "admin";
const defaultCreatorUsername = "creator";
const defaultPassword = "ChangeMe123!";

export function resolveSeedConfig(env: NodeJS.ProcessEnv = process.env): SeedConfig {
  const production = env.NODE_ENV === "production";
  const superAdminUsername = normalizeUsername(env.SEED_SUPER_ADMIN_USERNAME);
  const superAdminPassword = env.SEED_SUPER_ADMIN_PASSWORD;
  const creatorUsername = normalizeUsername(env.SEED_CREATOR_USERNAME);
  const creatorPassword = env.SEED_CREATOR_PASSWORD;

  if (production) {
    if (!superAdminUsername || !superAdminPassword || !creatorUsername || !creatorPassword) {
      throw new Error("SEED_SUPER_ADMIN_USERNAME, SEED_SUPER_ADMIN_PASSWORD, SEED_CREATOR_USERNAME, and SEED_CREATOR_PASSWORD are required when NODE_ENV=production");
    }
  }

  const config = {
    superAdminUsername: superAdminUsername || defaultSuperAdminUsername,
    superAdminPassword: superAdminPassword || defaultPassword,
    creatorUsername: creatorUsername || defaultCreatorUsername,
    creatorPassword: creatorPassword || defaultPassword,
  };

  assertUsername(config.superAdminUsername, "SEED_SUPER_ADMIN_USERNAME");
  assertUsername(config.creatorUsername, "SEED_CREATOR_USERNAME");
  assertPassword(config.superAdminPassword, "SEED_SUPER_ADMIN_PASSWORD");
  assertPassword(config.creatorPassword, "SEED_CREATOR_PASSWORD");
  if (config.superAdminUsername === config.creatorUsername) {
    throw new Error("SEED_SUPER_ADMIN_USERNAME and SEED_CREATOR_USERNAME must be different");
  }

  return config;
}

function normalizeUsername(value: string | undefined) {
  return value?.trim().toLowerCase();
}

function assertUsername(value: string, name: string) {
  if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(value)) {
    throw new Error(`${name} must be 3-32 characters using letters, numbers, underscore, or hyphen`);
  }
}

function assertPassword(value: string, name: string) {
  if (value.length < 8) {
    throw new Error(`${name} must be at least 8 characters`);
  }
}
