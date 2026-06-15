export type ProjectPublishReadinessInput = {
  name?: string | null;
  slug?: string | null;
  intro?: string | null;
  systemPrompt?: string | null;
  welcomeMessage?: string | null;
  currentModelAsset?: { validationStatus: string } | null;
  triggerTags: Array<{ enabled: boolean }>;
  fanAccessCodes: Array<{ status: string; expiresAt: Date }>;
};

export type ProjectReadinessItem = {
  title: string;
  detail: string;
  done: boolean;
};

export function projectPublishReadiness(input: ProjectPublishReadinessInput, now = new Date()): ProjectReadinessItem[] {
  const activeFanCodes = input.fanAccessCodes.filter((code) => code.status === "active" && code.expiresAt > now).length;
  const enabledTags = input.triggerTags.filter((tag) => tag.enabled).length;

  return [
    {
      title: "Project profile",
      detail: input.intro ? "Name, slug, intro, and welcome copy are configured." : "Add an intro so fans understand the companion before entering a code.",
      done: Boolean(input.name && input.slug && input.welcomeMessage && input.systemPrompt && input.intro),
    },
    {
      title: "Live2D model",
      detail: input.currentModelAsset?.validationStatus === "valid" ? "A valid model is ready." : "Upload a valid model or request admin setup.",
      done: input.currentModelAsset?.validationStatus === "valid",
    },
    {
      title: "Trigger tags",
      detail: enabledTags ? `${enabledTags} enabled tag(s) can drive expressions, parameters, and prompt fragments.` : "Create at least one enabled tag to make responses feel characterful.",
      done: enabledTags > 0,
    },
    {
      title: "Fan access",
      detail: activeFanCodes ? `${activeFanCodes} active code(s) are available for distribution.` : "Generate active fan codes before sharing the audience page.",
      done: activeFanCodes > 0,
    },
  ];
}

export function missingProjectPublishRequirements(input: ProjectPublishReadinessInput, now = new Date()) {
  return projectPublishReadiness(input, now).filter((item) => !item.done).map((item) => item.title);
}

export function assertProjectPublishReadiness(input: ProjectPublishReadinessInput, now = new Date()) {
  const missing = missingProjectPublishRequirements(input, now);
  if (missing.length) {
    throw new Error(`Project is not ready to publish: ${missing.join(", ")}`);
  }
}
