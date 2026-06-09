import { spawn, spawnSync } from "node:child_process";

const tag = process.env.DOCKER_IMAGE_TAG || "live2d-creator-platform-web";
const timeoutSeconds = numberEnv("DOCKER_BUILD_TIMEOUT_SECONDS", 180);
const primaryImage = process.env.NODE_IMAGE || "node:22-alpine";
const fallbackImage = process.env.NODE_IMAGE_FALLBACK || "public.ecr.aws/docker/library/node:22-alpine";
const revision = resolveRevision();
const sourceUrl = resolveSourceUrl();
const images = [...new Set([primaryImage, fallbackImage].filter(Boolean))];

let lastError;
for (const image of images) {
  try {
    console.log(`Building ${tag} with NODE_IMAGE=${image}`);
    await runDockerBuild(image);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(error instanceof Error ? error.message : String(error));
  }
}

console.error(`Docker build failed for all configured Node images: ${images.join(", ")}`);
if (lastError instanceof Error && lastError.stack) {
  console.error(lastError.stack);
}
process.exit(1);

function runDockerBuild(nodeImage) {
  const args = [
    "build",
    "--build-arg",
    `NODE_IMAGE=${nodeImage}`,
    "--build-arg",
    `VCS_REF=${revision}`,
    "--build-arg",
    `SOURCE_URL=${sourceUrl}`,
    "-t",
    tag,
    ".",
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      stdio: "inherit",
      env: process.env,
    });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    }, timeoutSeconds * 1000);

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`Docker build timed out after ${timeoutSeconds}s for NODE_IMAGE=${nodeImage}`));
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Docker build exited with code ${code ?? "null"} signal ${signal ?? "null"} for NODE_IMAGE=${nodeImage}`));
    });
  });
}

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function resolveRevision() {
  if (process.env.DOCKER_IMAGE_REVISION) return process.env.DOCKER_IMAGE_REVISION;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  if (process.env.GIT_COMMIT_SHA) return process.env.GIT_COMMIT_SHA;

  const result = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function resolveSourceUrl() {
  if (process.env.DOCKER_IMAGE_SOURCE_URL) return process.env.DOCKER_IMAGE_SOURCE_URL;
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY) {
    return `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`;
  }
  return "unknown";
}
