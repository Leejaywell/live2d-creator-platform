import assert from "node:assert/strict";
import test from "node:test";

import { resolveSeedConfig } from "../src/lib/seed-config";

test("resolveSeedConfig keeps local defaults outside production", () => {
  const config = resolveSeedConfig({});

  assert.deepEqual(config, {
    superAdminUsername: "admin",
    superAdminPassword: "ChangeMe123!",
    creatorUsername: "creator",
    creatorPassword: "ChangeMe123!",
  });
});

test("resolveSeedConfig requires explicit production account credentials", () => {
  assert.throws(
    () => resolveSeedConfig({ NODE_ENV: "production" }),
    /SEED_SUPER_ADMIN_USERNAME/,
  );
});

test("resolveSeedConfig rejects invalid usernames", () => {
  assert.throws(
    () =>
      resolveSeedConfig({
        SEED_SUPER_ADMIN_USERNAME: "bad email",
        SEED_CREATOR_USERNAME: "creator",
      }),
    /SEED_SUPER_ADMIN_USERNAME must be 3-32 characters/,
  );
});

test("resolveSeedConfig accepts distinct production account credentials", () => {
  const config = resolveSeedConfig({
    NODE_ENV: "production",
    SEED_SUPER_ADMIN_USERNAME: "Admin_Ops ",
    SEED_SUPER_ADMIN_PASSWORD: "admin-password",
    SEED_CREATOR_USERNAME: "creator-main",
    SEED_CREATOR_PASSWORD: "creator-password",
  });

  assert.deepEqual(config, {
    superAdminUsername: "admin_ops",
    superAdminPassword: "admin-password",
    creatorUsername: "creator-main",
    creatorPassword: "creator-password",
  });
});

test("resolveSeedConfig rejects duplicate seed usernames", () => {
  assert.throws(
    () =>
      resolveSeedConfig({
        SEED_SUPER_ADMIN_USERNAME: "owner",
        SEED_CREATOR_USERNAME: " OWNER ",
      }),
    /must be different/,
  );
});
