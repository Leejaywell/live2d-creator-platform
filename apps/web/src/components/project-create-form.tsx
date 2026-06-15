"use client";

import { ChangeEvent, useState } from "react";

import { ApiForm } from "@/components/api-form";
import { normalizeProjectSlug } from "@/lib/project-slugs";

export function ProjectCreateForm() {
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  function updateName(event: ChangeEvent<HTMLInputElement>) {
    if (!slugEdited) {
      setSlug(normalizeProjectSlug(event.target.value));
    }
  }

  function updateSlug(event: ChangeEvent<HTMLInputElement>) {
    setSlugEdited(true);
    setSlug(normalizeProjectSlug(event.target.value));
  }

  return (
    <ApiForm action="/api/creator/projects" submitLabel="创建角色模型">
      <label>
        名称
        <input name="name" onChange={updateName} required />
      </label>
      <label>
        Slug
        <input name="slug" pattern="[a-z0-9-]+" value={slug} onChange={updateSlug} required />
      </label>
      <label>
        简介
        <textarea name="intro" />
      </label>
      <label>
        头像 URL
        <input name="avatarUrl" type="url" />
      </label>
      <label>
        舞台背景图 URL
        <input name="backgroundUrl" type="url" placeholder="https://…(留空使用默认舞台光效)" />
      </label>
      <label>
        系统提示词
        <textarea name="systemPrompt" required />
      </label>
      <label>
        欢迎语
        <input name="welcomeMessage" required />
      </label>
      <label>
        主题色
        <input name="theme" type="color" defaultValue="#ff6c9e" aria-label="项目主题色" />
      </label>
    </ApiForm>
  );
}
