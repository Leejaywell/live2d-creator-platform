import { execSync } from "node:child_process";

import { PGlite } from "@electric-sql/pglite";

// Local "db push" for PGlite. The Prisma CLI can't talk to an in-process DB, so
// we render the schema to SQL (no DB connection needed for --from-empty) and
// apply it to the PGlite data directory. This resets the public schema, so it's
// a dev convenience — re-seed afterwards.
const dir = process.env.PGLITE_DATA_DIR ?? "./.pglite";

const ddl = execSync(
  "npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script",
  {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://local:local@localhost:5432/local" },
  },
);

async function main() {
  const db = new PGlite(dir);
  await db.waitReady;
  await db.exec("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await db.exec(ddl);
  await db.close();
  console.log(`PGlite schema applied to ${dir}`);
}

main().catch((error) => {
  console.error("PGlite schema push failed:", error?.message || error);
  process.exit(1);
});
