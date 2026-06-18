"use client";

import { type ChangeEvent, useState } from "react";

import { ApiForm } from "@/components/api-form";
import { normalizeProjectSlug } from "@/lib/project-slugs";

export function ProjectCreateForm() {
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
    <ApiForm action="/api/creator/projects" submitLabel="创建模型">
      <label>
        名称
        <input name="name" onChange={onName} placeholder="星野 Hoshino" required />
      </label>
      <label>
        Slug
        <input name="slug" value={slug} onChange={onSlug} pattern="[a-z0-9-]+" placeholder="hoshino" required />
      </label>
      <label>
        简介
        <textarea name="intro" placeholder="治愈系虚拟主播 · 中文 / 日文" />
      </label>
      <label>
        头像 URL
        <input name="avatarUrl" type="url" placeholder="https://…" />
      </label>
      <label>
        舞台背景图 URL
        <input name="backgroundUrl" type="url" placeholder="https://…（留空使用默认舞台光效）" />
      </label>
      <label>
        系统提示词（人设）
        <textarea name="systemPrompt" placeholder="你是星野，一位温柔治愈的虚拟主播…" required />
      </label>
      <label>
        欢迎语
        <input name="welcomeMessage" placeholder="欢迎进场～今天想聊点什么呀？" required />
      </label>
      <label>
        主题色
        <input name="theme" type="color" defaultValue="#ff6c9e" aria-label="项目主题色" />
      </label>
    </ApiForm>
  );
}
