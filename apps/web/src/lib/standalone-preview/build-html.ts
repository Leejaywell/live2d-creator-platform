import { readFile } from "node:fs/promises";
import path from "node:path";

import { STAGE_BACKGROUNDS } from "@/lib/stage-backgrounds";
import { getObjectBytes } from "@/lib/storage";

import { embedModelReferences, readReferenceDataUrl } from "./assets";
import { PREVIEW_RUNTIME } from "./runtime-script";
import { PREVIEW_STYLE } from "./runtime-style";

// Self-hosted Live2D runtime, inlined into the export so it works offline. Order
// matters: Pixi, then Cubism Core, then the pixi-live2d-display cubism4 bundle.
const VENDOR_SCRIPTS = [
  "vendor/pixi-7.4.2.min.js",
  "live2dcubismcore.min.js",
  "vendor/pixi-live2d-cubism4-0.4.0.min.js",
];
const AMBIENT_AUDIO = "audio/ambient.ogg";

// Localized stage-background labels are resolved server-side from the audience
// namespace; the standalone has no i18n runtime, so we bake readable labels.
const BG_LABELS = ["梦幻霓虹", "黄昏暖阳", "深海蓝调", "樱粉甜梦", "薄荷微光", "静谧夜色"];

export type StandalonePreviewProject = {
  slug: string;
  name: string;
  theme: string;
  systemPrompt: string | null;
  welcomeMessage: string | null;
  characterSetting: string | null;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  modelJsonPath: string;
  voices: Array<{ name: string; audioUrl: string | null; tags: string[] }>;
  triggerTags: Array<{ name: string; keywords: string[]; live2dExpression: string | null; promptFragment: string | null }>;
};

async function readPublic(rel: string): Promise<string> {
  return readFile(path.join(process.cwd(), "public", rel), "utf8");
}

// Escape so the JSON payload can't terminate the <script> it lives in.
const SEP = new RegExp("[\\u2028\\u2029]", "g");
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(SEP, function (c) { return c === "\u2028" ? "\\u2028" : "\\u2029"; });
}

/**
 * Build a single self-contained HTML document that reproduces the full preview
 * interface for one project, with every asset (model, textures, motions,
 * voices, background, ambient audio, Live2D runtime) embedded inline so the
 * file works offline by double-click.
 */
export async function buildStandalonePreviewHtml(project: StandalonePreviewProject): Promise<string> {
  // Confirm the model is readable before doing the heavy embedding work.
  await getObjectBytes(project.modelJsonPath);

  const [model, avatarUrl, backgroundUrl, ambientUrl, vendorScripts] = await Promise.all([
    embedModelReferences(project.modelJsonPath),
    readReferenceDataUrl(project.avatarUrl),
    readReferenceDataUrl(project.backgroundUrl),
    readReferenceDataUrl(`/${AMBIENT_AUDIO}`),
    Promise.all(VENDOR_SCRIPTS.map((rel) => readPublic(rel))),
  ]);

  const voices = await Promise.all(
    project.voices.map(async (voice) => ({
      name: voice.name,
      audioUrl: await readReferenceDataUrl(voice.audioUrl),
      tags: voice.tags,
    })),
  );

  const data = {
    projectName: project.name,
    theme: project.theme,
    systemPrompt: project.systemPrompt ?? "",
    welcomeMessage: project.welcomeMessage ?? "",
    characterSetting: project.characterSetting ?? "",
    avatarUrl,
    backgroundUrl,
    ambientUrl,
    model,
    voices,
    triggerTags: project.triggerTags,
    stageBackgrounds: STAGE_BACKGROUNDS.map((bg, i) => ({ label: BG_LABELS[i] ?? `场景 ${i + 1}`, css: bg.css })),
    i18n: {},
  };

  const vendorTags = vendorScripts.map((js) => `<script>${js}</script>`).join("\n");

  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<title>${escapeHtml(project.name)} · 本地预览</title>
<style>${PREVIEW_STYLE}</style>
</head>
<body>
${vendorTags}
<script>window.__PREVIEW__ = ${safeJson(data)};</script>
<script>${PREVIEW_RUNTIME}</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}
