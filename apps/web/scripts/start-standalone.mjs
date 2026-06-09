import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const localStandaloneDir = path.join(root, ".next", "standalone");
const localStandaloneServer = path.join(localStandaloneDir, "server.js");
const containerStandaloneServer = path.join(root, "server.js");

let serverCwd;

if (existsSync(localStandaloneServer)) {
  syncDir(path.join(root, ".next", "static"), path.join(localStandaloneDir, ".next", "static"));
  syncDir(path.join(root, "public"), path.join(localStandaloneDir, "public"));
  serverCwd = localStandaloneDir;
} else if (existsSync(containerStandaloneServer)) {
  serverCwd = root;
} else {
  console.error("Missing Next.js standalone server. Run `npm run build` first.");
  process.exit(1);
}

const child = spawn(process.execPath, ["server.js"], {
  cwd: serverCwd,
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});

function syncDir(source, target) {
  if (!existsSync(source)) {
    return;
  }

  rmSync(target, { force: true, recursive: true });
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}
