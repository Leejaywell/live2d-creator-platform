import { readdirSync, rmSync } from "node:fs";
import path from "node:path";

const standaloneDir = path.join(process.cwd(), ".next", "standalone");

for (const entry of safeReadDir(standaloneDir)) {
  if (entry === ".env" || entry.startsWith(".env.")) {
    rmSync(path.join(standaloneDir, entry), { force: true, recursive: true });
  }
}

function safeReadDir(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
