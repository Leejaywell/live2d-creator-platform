"use client";

import { useTranslations } from "next-intl";
import { type ChangeEvent, useState } from "react";

import { ApiForm } from "@/components/api-form";
import { normalizeProjectSlug } from "@/lib/project-slugs";

export function ProjectCreateForm() {
  const t = useTranslations("workspace");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  function onName(event: ChangeEvent<HTMLInputElement>) {
    if (!slugTouched) setSlug(normalizeProjectSlug(event.target.value));
  }
  function onSlug(event: ChangeEvent<HTMLInputElement>) {
    setSlugTouched(true);
    setSlug(normalizeProjectSlug(event.target.value));
  }

  return (
    <ApiForm action="/api/creator/projects" submitLabel={t("createModel")}>
      <label>
        {t("fieldName")}
        <input name="name" onChange={onName} placeholder={t("namePlaceholder")} required />
      </label>
      <label>
        Slug
        <input name="slug" value={slug} onChange={onSlug} pattern="[a-z0-9-]+" placeholder="hoshino" required />
      </label>
      <label>
        {t("fieldIntro")}
        <textarea name="intro" placeholder={t("introPlaceholder")} />
      </label>
      <label>
        {t("fieldAvatarUrl")}
        <input name="avatarUrl" type="url" placeholder="https://…" />
      </label>
      <label>
        {t("fieldBackgroundUrl")}
        <input name="backgroundUrl" type="url" placeholder={t("backgroundUrlPlaceholder")} />
      </label>
      <label>
        {t("fieldSystemPrompt")}
        <textarea name="systemPrompt" placeholder={t("systemPromptPlaceholder")} required />
      </label>
      <label>
        {t("fieldWelcomeMessage")}
        <input name="welcomeMessage" placeholder={t("welcomeMessagePlaceholder")} required />
      </label>
      <label>
        {t("fieldTheme")}
        <input name="theme" type="color" defaultValue="#ff6c9e" aria-label={t("themeAriaLabel")} />
      </label>
    </ApiForm>
  );
}
