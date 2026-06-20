"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/authz";
import { createTriggerTag, setProjectStatus, updateProject } from "@/lib/projects";

// Server Actions for the core creator project mutations. Each authenticates and
// authorizes inside the action (never trusting the client route gate), wraps an
// existing service, and revalidates the workspace.

async function requireCreatorId() {
  const session = await requireSession();
  if (session.user.role !== "creator") {
    throw new Error("Only creators can manage projects");
  }
  return session.user.id;
}

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.length ? value : undefined;
}

function requiredText(value: FormDataEntryValue | null, field: string) {
  const result = text(value);
  if (!result) throw new Error(`Missing required field: ${field}`);
  return result;
}

function revalidate(projectId: string) {
  revalidatePath(`/creator/projects/${projectId}`);
}

export async function updateProjectAction(projectId: string, formData: FormData) {
  const creatorId = await requireCreatorId();
  await updateProject({
    projectId,
    creatorId,
    name: text(formData.get("name")),
    slug: text(formData.get("slug")),
    intro: text(formData.get("intro")),
    avatarUrl: text(formData.get("avatarUrl")) ?? null,
    backgroundUrl: text(formData.get("backgroundUrl")) ?? null,
    systemPrompt: text(formData.get("systemPrompt")),
    characterSetting: text(formData.get("characterSetting")) ?? null,
    welcomeMessage: text(formData.get("welcomeMessage")),
    theme: text(formData.get("theme")),
  });
  revalidate(projectId);
}

export async function setProjectStatusAction(projectId: string, formData: FormData) {
  const creatorId = await requireCreatorId();
  const status = requiredText(formData.get("status"), "status");
  if (status !== "draft" && status !== "published" && status !== "paused") {
    throw new Error("Invalid project status");
  }
  await setProjectStatus({ projectId, creatorId, actorId: creatorId, actorRole: "creator", status });
  revalidate(projectId);
}

export async function createTagAction(projectId: string, formData: FormData) {
  const creatorId = await requireCreatorId();
  const keywords = (text(formData.get("keywords")) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const live2dParamsRaw = text(formData.get("live2dParams"));
  await createTriggerTag({
    projectId,
    creatorId,
    name: requiredText(formData.get("name"), "name"),
    description: text(formData.get("description")),
    keywords,
    promptFragment: text(formData.get("promptFragment")),
    live2dExpression: text(formData.get("live2dExpression")),
    live2dParams: live2dParamsRaw ? JSON.parse(live2dParamsRaw) : undefined,
    priority: Number(text(formData.get("priority")) ?? "0") || 0,
  });
  revalidate(projectId);
}
