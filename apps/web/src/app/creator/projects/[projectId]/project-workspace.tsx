"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ApiForm } from "@/components/api-form";
import { Live2DViewer, type Live2DEffect } from "@/components/live2d-viewer";
import { TriggerTagTester } from "@/components/trigger-tag-tester";
import { Button, LinkButton, Pill, type Tone } from "@/components/ui";

import { creatorStyles } from "../../_components";
import { updateProjectAction } from "./actions";
import { StageChat } from "./stage-chat";
import styles from "./workspace.module.css";

type WorkspaceTag = {
  id: string;
  name: string;
  keywords: string[];
  live2dExpression: string | null;
  priority: number;
  enabled: boolean;
};

type WorkspaceCode = {
  id: string;
  status: string;
  display: string;
  expiresAt: string;
  usedMessages: number;
  maxMessages: number;
};

export type WorkspaceProject = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "paused";
  intro: string;
  systemPrompt: string;
  welcomeMessage: string;
  theme: string;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  modelStatus: string | null;
  modelAssetCount: number;
  tags: WorkspaceTag[];
  voices: Array<{ id: string; name: string; status: string }>;
  codes: WorkspaceCode[];
  readiness: boolean[];
};

type StepKey = "model" | "tags" | "voice" | "basics" | "publish";

const statusToneMap: Record<string, Tone> = { published: "live", paused: "danger", draft: "amber" };
const statusLabelKey: Record<string, string> = {
  published: "statusPublished",
  paused: "statusPaused",
  draft: "statusDraft",
};

export function ProjectWorkspace({
  project,
  previewSessionId,
}: {
  project: WorkspaceProject;
  previewSessionId: string;
}) {
  const t = useTranslations("workspace");
  const [active, setActive] = useState<StepKey>("model");
  const [chatTags, setChatTags] = useState<string[]>([]);
  const [chatEffects, setChatEffects] = useState<Live2DEffect[]>([]);

  const [profileDone, modelDone, tagsDone] = project.readiness;
  const publishUnlocked = profileDone && modelDone && tagsDone;

  const steps: Array<{ key: StepKey; name: string; sub: string; done: boolean; locked?: boolean }> = [
    {
      key: "model",
      name: t("stepModel"),
      sub: modelDone ? t("modelVerifiedCount", { count: project.modelAssetCount }) : t("uploadLive2dModel"),
      done: modelDone,
    },
    {
      key: "tags",
      name: t("stepTags"),
      sub: project.tags.length ? t("tagCount", { count: project.tags.length }) : t("toConfigure"),
      done: tagsDone,
    },
    {
      key: "voice",
      name: t("stepVoice"),
      sub: project.voices.length ? t("voiceCount", { count: project.voices.length }) : t("toConfigure"),
      done: project.voices.length > 0,
    },
    { key: "basics", name: t("stepBasics"), sub: profileDone ? t("profileFilled") : t("completeProfile"), done: profileDone },
    {
      key: "publish",
      name: t("stepPublish"),
      sub: publishUnlocked ? (project.status === "published" ? t("published") : t("publishable")) : t("lockedUntilSteps"),
      done: project.status === "published",
      locked: !publishUnlocked,
    },
  ];

  return (
    <div className={styles.wrap}>
      <header className={styles.topbar}>
        <div className={styles.topLeft}>
          <Link href="/creator" className={styles.back}>
            ← {t("backWorkbench")}
          </Link>
          <span className={styles.vdivider} aria-hidden />
          <span className={styles.projectMark} aria-hidden />
          <div className={styles.projectTitle}>
            {project.name}
            <Pill tone={statusToneMap[project.status]}>{t(statusLabelKey[project.status])}</Pill>
          </div>
        </div>
        <div className={styles.topActions}>
          <span className={styles.autosave}>{t("saved")}</span>
          <LinkButton href={`/creator/projects/${project.id}/fan-codes`} variant="ghost" size="sm">
            {t("fanCodes")}
          </LinkButton>
          <LinkButton href={`/creator/projects/${project.id}/preview`} variant="ghost" size="sm">
            {t("preview")}
          </LinkButton>
          <Button size="sm" onClick={() => setActive("publish")} disabled={!publishUnlocked}>
            {t("publish")} →
          </Button>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.rail} aria-label={t("configSteps")}>
          <div className={styles.railLabel}>{t("configSteps")}</div>
          {steps.map((step, index) => {
            const isActive = active === step.key;
            return (
              <button
                key={step.key}
                type="button"
                className={`${styles.railItem} ${isActive ? styles.railItemActive : ""} ${
                  step.locked ? styles.railItemLocked : ""
                }`}
                onClick={() => !step.locked && setActive(step.key)}
                disabled={step.locked}
              >
                <span
                  className={`${styles.railMark} ${
                    step.done ? styles.railMarkDone : isActive ? styles.railMarkActive : ""
                  }`}
                  aria-hidden
                >
                  {step.locked ? "🔒" : step.done ? "✓" : index + 1}
                </span>
                <span className={styles.railText}>
                  <span className={styles.railName}>{step.name}</span>
                  <span className={styles.railSub}>{step.sub}</span>
                </span>
              </button>
            );
          })}
          <div className={styles.assistCard}>
            <strong>{t("needHelp")}</strong>
            <p>{t("modelHelpHint")}</p>
            <Link href="#">{t("requestModelAssistance")} →</Link>
          </div>
        </aside>

        <main className={styles.center}>{renderStep(active, project)}</main>

        <aside className={styles.stage}>
          <div className={styles.stageHead}>
            <span className={styles.stageHeadLabel}>{t("persistentPreview")}</span>
            <span className={styles.stageLive}>{t("realtime")}</span>
          </div>
          <div className={styles.stageBody}>
            {project.modelStatus === "valid" ? (
              <Live2DViewer
                projectSlug={project.slug}
                viewerSessionId={previewSessionId}
                activeTags={chatTags}
                activeEffects={chatEffects}
                isSpeaking={false}
                voices={project.voices.map((v) => ({ name: v.name }))}
              />
            ) : (
              <div className={styles.stageSlot}>
                LIVE2D
                <br />
                {project.modelStatus === "invalid" ? t("modelValidationFailed") : t("modelNotUploaded")}
              </div>
            )}
            <StageChat
              viewerSessionId={previewSessionId}
              welcomeMessage={project.welcomeMessage}
              onEffects={(tags, effects) => {
                setChatTags(tags);
                setChatEffects(effects);
              }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function renderStep(active: StepKey, project: WorkspaceProject) {
  switch (active) {
    case "basics":
      return <BasicsStep project={project} />;
    case "model":
      return <ModelStep project={project} />;
    case "tags":
      return <TagsStep project={project} />;
    case "voice":
      return <VoiceStep project={project} />;
    case "publish":
      return <PublishStep project={project} />;
  }
}

function StepHeader({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className={styles.stepHead}>
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      {action}
    </div>
  );
}

function BasicsStep({ project }: { project: WorkspaceProject }) {
  const t = useTranslations("workspace");
  return (
    <>
      <StepHeader title={t("basicInfo")} sub={t("basicsSubtitle")} />
      <div className={creatorStyles.formCard}>
        <form action={updateProjectAction.bind(null, project.id)}>
          <label>
            {t("fieldName")}
            <input name="name" defaultValue={project.name} required />
          </label>
          <label>
            Slug
            <input name="slug" defaultValue={project.slug} pattern="[a-z0-9-]+" required />
          </label>
          <label>
            {t("fieldIntro")}
            <textarea name="intro" defaultValue={project.intro} />
          </label>
          <label>
            {t("fieldAvatarUrl")}
            <input name="avatarUrl" type="url" defaultValue={project.avatarUrl ?? ""} />
          </label>
          <label>
            {t("fieldBackgroundUrl")}
            <input name="backgroundUrl" type="url" defaultValue={project.backgroundUrl ?? ""} />
          </label>
          <label>
            {t("fieldSystemPrompt")}
            <textarea name="systemPrompt" defaultValue={project.systemPrompt} required />
          </label>
          <label>
            {t("fieldWelcomeMessage")}
            <input name="welcomeMessage" defaultValue={project.welcomeMessage} required />
          </label>
          <label>
            {t("fieldTheme")}
            <input name="theme" type="color" defaultValue={project.theme} aria-label={t("themeAriaLabel")} />
          </label>
          <Button type="submit">{t("saveBasics")}</Button>
        </form>
      </div>
    </>
  );
}

function ModelStep({ project }: { project: WorkspaceProject }) {
  const t = useTranslations("workspace");
  const statusText =
    project.modelStatus === "valid"
      ? t("modelStatusValid")
      : project.modelStatus === "invalid"
        ? t("modelStatusInvalid")
        : project.modelStatus === "pending"
          ? t("modelStatusPending")
          : t("modelNotUploaded");
  return (
    <>
      <StepHeader title={t("stepModel")} sub={t("modelSubtitle")} />
      <div className={styles.panelBox}>
        <p style={{ margin: "0 0 14px", color: "var(--text-dim)", fontSize: 14 }}>
          {statusText} · {t("assetCount", { count: project.modelAssetCount })}
        </p>
        <div className={creatorStyles.formCard}>
          <ApiForm
            action={`/api/creator/projects/${project.id}/model-assets`}
            submitLabel={t("uploadAndValidate")}
          >
            <label>
              {t("modelZipLabel")}
              <input name="file" type="file" accept=".zip" required />
            </label>
          </ApiForm>
        </div>
      </div>
    </>
  );
}

function TagToggle({ projectId, tagId, enabled }: { projectId: string; tagId: string; enabled: boolean }) {
  const t = useTranslations("workspace");
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    const next = !on;
    setPending(true);
    setOn(next);
    try {
      const response = await fetch(`/api/creator/projects/${projectId}/tags/${tagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!response.ok) {
        setOn(!next);
        return;
      }
      router.refresh();
    } catch {
      setOn(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? t("disableTag") : t("enableTag")}
      className={`${styles.toggle} ${on ? styles.toggleOn : ""}`}
      onClick={toggle}
      disabled={pending}
    >
      <span className={styles.toggleKnob} aria-hidden />
    </button>
  );
}

function TagsStep({ project }: { project: WorkspaceProject }) {
  const t = useTranslations("workspace");
  return (
    <>
      <StepHeader title={t("stepTags")} sub={t("tagsSubtitle")} />
      <div className={styles.tagList}>
        {project.tags.length === 0 && (
          <div className={creatorStyles.empty}>{t("tagsEmpty")}</div>
        )}
        {project.tags.map((tag) => (
          <div key={tag.id} className={`${styles.tagRow} ${tag.enabled ? "" : styles.tagDisabled}`}>
            <span className={styles.tagName}>#{tag.name}</span>
            <div className={styles.tagKeywords}>
              {tag.keywords.length ? (
                tag.keywords.map((kw) => (
                  <span key={kw} className={styles.tagKw}>
                    {kw}
                  </span>
                ))
              ) : (
                <span className={styles.tagKw}>{t("noKeywords")}</span>
              )}
            </div>
            {tag.live2dExpression && <span className={styles.tagMeta}>{tag.live2dExpression}</span>}
            <TagToggle projectId={project.id} tagId={tag.id} enabled={tag.enabled} />
            <details className={creatorStyles.disclosure}>
              <summary>{t("delete")}</summary>
              <div className={creatorStyles.formCard}>
                <ApiForm
                  action={`/api/creator/projects/${project.id}/tags/${tag.id}`}
                  method="DELETE"
                  submitLabel={t("confirmDeleteTag")}
                  submitVariant="danger"
                >
                  <span className={creatorStyles.pageHeadSub}>{t("deleteTagHint")}</span>
                </ApiForm>
              </div>
            </details>
          </div>
        ))}
      </div>

      <details className={`${styles.panelBox} ${creatorStyles.disclosure}`}>
        <summary>+ {t("newTriggerTag")}</summary>
        <div className={creatorStyles.formCard}>
          <ApiForm action={`/api/creator/projects/${project.id}/tags`} submitLabel={t("createTag")}>
            <label>
              {t("fieldName")}
              <input name="name" placeholder={t("tagNamePlaceholder")} required />
            </label>
            <label>
              {t("fieldKeywords")}
              <input name="keywords" placeholder={t("keywordsPlaceholder")} />
            </label>
            <label>
              {t("fieldLive2dExpression")}
              <input name="live2dExpression" placeholder="exp_shy" />
            </label>
            <label>
              {t("fieldLive2dParams")}
              <textarea name="live2dParams" placeholder='{"ParamCheek":0.8}' />
            </label>
            <label>
              {t("fieldPromptFragment")}
              <textarea name="promptFragment" />
            </label>
            <label>
              {t("fieldPriority")}
              <input name="priority" type="number" defaultValue="0" />
            </label>
          </ApiForm>
        </div>
      </details>

      <div className={styles.tester}>
        <div className={styles.testerLabel}>⚡ {t("tagTester")}</div>
        <div className={creatorStyles.formCard}>
          <TriggerTagTester projectId={project.id} />
        </div>
      </div>
    </>
  );
}

function VoiceStep({ project }: { project: WorkspaceProject }) {
  const t = useTranslations("workspace");
  return (
    <>
      <StepHeader title={t("stepVoice")} sub={t("voiceSubtitle")} />
      <div className={styles.simpleList}>
        {project.voices.length === 0 ? (
          <div className={creatorStyles.empty}>{t("voiceEmpty")}</div>
        ) : (
          project.voices.map((voice) => (
            <div key={voice.id} className={styles.simpleRow}>
              <span>{voice.name}</span>
              <Pill tone={voice.status === "active" ? "live" : "neutral"}>{voice.status}</Pill>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function PublishStep({ project }: { project: WorkspaceProject }) {
  const t = useTranslations("workspace");
  const readinessLabels = [t("basicInfo"), t("live2dModel"), t("stepTags"), t("fanCodes")];
  return (
    <>
      <StepHeader title={t("stepPublish")} sub={t("publishSubtitle")} />
      <ul className={styles.checklist}>
        {readinessLabels.map((label, index) => (
          <li key={label} className={styles.checkItem}>
            <div>
              <strong>{label}</strong>
              <span>{project.readiness[index] ? t("readyLong") : t("todo")}</span>
            </div>
            <Pill tone={project.readiness[index] ? "live" : "amber"}>
              {project.readiness[index] ? t("readyShort") : t("todo")}
            </Pill>
          </li>
        ))}
      </ul>

      <div className={styles.panelBox}>
        <div className={creatorStyles.formCard}>
          <ApiForm
            action={`/api/creator/projects/${project.id}/publish`}
            submitLabel={project.status === "published" ? t("pausePerformance") : t("publishPerformance")}
          >
            <input
              type="hidden"
              name="status"
              value={project.status === "published" ? "paused" : "published"}
            />
            <span className={creatorStyles.pageHeadSub}>
              {t("currentStatus", { status: t(statusLabelKey[project.status]) })}
              {project.status === "published" ? t("pausedHint") : t("publishedHint")}
            </span>
          </ApiForm>
        </div>
      </div>
    </>
  );
}
