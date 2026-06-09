export type SeedConfig = {
  superAdminEmail: string;
  creatorEmail: string;
};

const defaultSuperAdminEmail = "admin@example.com";
const defaultCreatorEmail = "creator@example.com";

export function resolveSeedConfig(env: NodeJS.ProcessEnv = process.env): SeedConfig {
  const production = env.NODE_ENV === "production";
  const superAdminEmail = normalizeEmail(env.SEED_SUPER_ADMIN_EMAIL);
  const creatorEmail = normalizeEmail(env.SEED_CREATOR_EMAIL);

  if (production) {
    if (!superAdminEmail || !creatorEmail) {
      throw new Error("SEED_SUPER_ADMIN_EMAIL and SEED_CREATOR_EMAIL are required when NODE_ENV=production");
    }
    if (isExampleEmail(superAdminEmail) || isExampleEmail(creatorEmail)) {
      throw new Error("Production seed emails must not use example, test, or localhost domains");
    }
  }

  const config = {
    superAdminEmail: superAdminEmail || defaultSuperAdminEmail,
    creatorEmail: creatorEmail || defaultCreatorEmail,
  };

  assertEmail(config.superAdminEmail, "SEED_SUPER_ADMIN_EMAIL");
  assertEmail(config.creatorEmail, "SEED_CREATOR_EMAIL");
  if (config.superAdminEmail === config.creatorEmail) {
    throw new Error("SEED_SUPER_ADMIN_EMAIL and SEED_CREATOR_EMAIL must be different");
  }

  return config;
}

function normalizeEmail(value: string | undefined) {
  return value?.trim().toLowerCase();
}

function assertEmail(value: string, name: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`${name} must be a valid email address`);
  }
}

function isExampleEmail(value: string) {
  const domain = value.split("@")[1] ?? "";
  return domain === "example.com" || domain === "example.test" || domain.endsWith(".example") || domain.endsWith(".test") || domain === "localhost";
}
