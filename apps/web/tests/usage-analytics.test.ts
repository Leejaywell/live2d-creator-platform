import assert from "node:assert/strict";
import test from "node:test";

import { summarizeUsageAnalytics, usageWindowStart } from "../src/lib/usage-analytics";

const now = new Date("2026-06-10T12:00:00.000Z");

test("summarizeUsageAnalytics returns empty daily buckets", () => {
  const summary = summarizeUsageAnalytics([], { days: 3, now });

  assert.equal(summary.totalMessages, 0);
  assert.equal(summary.totalTokens, 0);
  assert.equal(summary.activeProjects, 0);
  assert.deepEqual(
    summary.daily.map((day) => day.date),
    ["2026-06-08", "2026-06-09", "2026-06-10"],
  );
});

test("summarizeUsageAnalytics totals records and ranks projects", () => {
  const summary = summarizeUsageAnalytics(
    [
      { projectId: "p1", projectName: "Yuri", messageCount: 1, tokenEstimate: 12, createdAt: new Date("2026-06-09T10:00:00.000Z") },
      { projectId: "p2", projectName: "Mika", messageCount: 3, tokenEstimate: 21, createdAt: new Date("2026-06-10T10:00:00.000Z") },
      { projectId: "p1", projectName: "Yuri", messageCount: 2, tokenEstimate: 18, createdAt: new Date("2026-06-10T11:00:00.000Z") },
    ],
    { days: 3, now },
  );

  assert.equal(summary.totalMessages, 6);
  assert.equal(summary.totalTokens, 51);
  assert.equal(summary.averageTokensPerMessage, 9);
  assert.equal(summary.activeProjects, 2);
  assert.deepEqual(
    summary.daily.map((day) => [day.date, day.messages, day.tokens]),
    [
      ["2026-06-08", 0, 0],
      ["2026-06-09", 1, 12],
      ["2026-06-10", 5, 39],
    ],
  );
  assert.deepEqual(
    summary.topProjects.map((project) => [project.projectName, project.messages]),
    [
      ["Yuri", 3],
      ["Mika", 3],
    ],
  );
});

test("usageWindowStart returns the first included UTC day", () => {
  assert.equal(usageWindowStart(7, now).toISOString(), "2026-06-04T00:00:00.000Z");
});
