import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // No migration history — the schema is applied with `prisma db push`.
  datasource: {
    url: env("DATABASE_URL"),
  },
});
