import assert from "node:assert/strict";
import test from "node:test";

import { resolveSeedConfig } from "../src/lib/seed-config";

test("resolveSeedConfig keeps local defaults outside production", () => {
  const config = resolveSeedConfig({});

  assert.deepEqual(config, {
    superAdminEmail: "admin@example.com",
    creatorEmail: "creator@example.com",
  });
});

test("resolveSeedConfig requires explicit production emails", () => {
  assert.throws(
    () => resolveSeedConfig({ NODE_ENV: "production" }),
    /SEED_SUPER_ADMIN_EMAIL and SEED_CREATOR_EMAIL are required/,
  );
});

test("resolveSeedConfig rejects example production emails", () => {
  assert.throws(
    () =>
      resolveSeedConfig({
        NODE_ENV: "production",
        SEED_SUPER_ADMIN_EMAIL: "admin@example.com",
        SEED_CREATOR_EMAIL: "creator@real-domain.com",
      }),
    /must not use example/,
  );
});

test("resolveSeedConfig accepts distinct production emails", () => {
  const config = resolveSeedConfig({
    NODE_ENV: "production",
    SEED_SUPER_ADMIN_EMAIL: "Admin@Live2D-Prod.com ",
    SEED_CREATOR_EMAIL: "creator@live2d-prod.com",
  });

  assert.deepEqual(config, {
    superAdminEmail: "admin@live2d-prod.com",
    creatorEmail: "creator@live2d-prod.com",
  });
});

test("resolveSeedConfig rejects duplicate seed emails", () => {
  assert.throws(
    () =>
      resolveSeedConfig({
        SEED_SUPER_ADMIN_EMAIL: "owner@example.com",
        SEED_CREATOR_EMAIL: " OWNER@example.com ",
      }),
    /must be different/,
  );
});
