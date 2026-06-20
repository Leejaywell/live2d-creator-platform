import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const log = (process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]) as ("error" | "warn")[];

  // Local development uses PGlite — an in-process, file-backed Postgres. No
  // external Postgres server and no Docker. Apply the schema with `npm run db:push`.
  const pgliteDir = process.env.PGLITE_DATA_DIR;
  if (pgliteDir) {
    const adapter = new PrismaPGlite(new PGlite(pgliteDir));
    return new PrismaClient({ adapter, log });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or PGLITE_DATA_DIR is required");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter, log });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
