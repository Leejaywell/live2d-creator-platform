import assert from "node:assert/strict";
import test from "node:test";

import { normalizeProjectSlug } from "../src/lib/project-slugs";

test("normalizeProjectSlug creates URL-safe project slugs", () => {
  assert.equal(normalizeProjectSlug("Mika Companion 01"), "mika-companion-01");
  assert.equal(normalizeProjectSlug("  live__2d!!!demo  "), "live-2d-demo");
  assert.equal(normalizeProjectSlug("---Already--Slug---"), "already-slug");
});
