"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ApiForm } from "@/components/api-form";
import { Live2DViewer, type Live2DEffect } from "@/components/live2d-viewer";
import { MobilePreview } from "@/components/mobile-preview";
import { TriggerTagTester } from "@/components/trigger-tag-tester";
import { Button, LinkButton, Pill, type Tone } from "@/components/ui";

import { creatorStyles } from "../../_components";
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
  characterSetting: string;
  welcomeMessage: string;
  theme: string;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  modelStatus: string | null;
  modelAssetCount: number;
  capabilities: { expressions: string[]; motions: string[] };
  tags: WorkspaceTag[];
  voices: Array<{ id: string; name: string; status: string; audioUrl?: string; tags?: string[] }>;
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

export type WorkspaceNav = {
  apiBase: string;
  backHref: string;
  backLabel: string;
  fanCodesHref: string;
  previewHref: string;
  showAssist: boolean;
};

export function ProjectWorkspace({
  project,
  previewSessionId,
  nav: navProp,
  mobilePreview,
}: {
  project: WorkspaceProject;
  previewSessionId: string;
  nav?: WorkspaceNav;
  mobilePreview?: { qr: string; url: string };
}) {
  const t = useTranslations("workspace");
  const nav: WorkspaceNav = navProp ?? {
    apiBase: `/api/creator/projects/${project.id}`,
    backHref: "/creator",
    backLabel: t("backWorkbench"),
    fanCodesHref: `/creator/projects/${project.id}/fan-codes`,
    previewHref: `/creator/projects/${project.id}/preview`,
    showAssist: true,
  };
  const apiBase = nav.apiBase;
  const [active, setActive] = useState<StepKey>("model");
  // The workspace opens model-first: only the centered model panel shows, with
  // the full step rail revealed on demand (or when jumping to a specific step).
  const [showSteps, setShowSteps] = useState(false);
  const [chatTags, setChatTags] = useState<string[]>([]);
  const [chatEffects, setChatEffects] = useState<Live2DEffect[]>([]);

  const goToStep = (key: StepKey) => {
    setActive(key);
    setShowSteps(true);
  };

  const [profileDone, modelDone, tagsDone] = project.readiness;
  const publishUnlocked = project.readiness.every(Boolean);

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
          <Link href={nav.backHref} className={styles.back}>
            ← {nav.backLabel}
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
          <Link href="/" className={styles.homeBtn} title={t("backHome")} aria-label={t("backHome")}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 11.5 12 4l9 7.5" />
              <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
            </svg>
          </Link>
          {mobilePreview ? (
            <MobilePreview qr={mobilePreview.qr} url={mobilePreview.url} label={t("mobilePreview")} />
          ) : null}
          <LinkButton href={nav.fanCodesHref} variant="ghost" size="sm">
            {t("fanCodes")}
          </LinkButton>
          <LinkButton href={nav.previewHref} variant="ghost" size="sm">
            {t("preview")}
          </LinkButton>
          <Button size="sm" onClick={() => goToStep("publish")} disabled={!publishUnlocked}>
            {t("publish")} →
          </Button>
        </div>
      </header>

      <div className={`${styles.layout} ${showSteps ? "" : styles.layoutFocus}`}>
        <button
          type="button"
          className={`${styles.configToggle} ${showSteps ? styles.configToggleOpen : ""}`}
          onClick={() => setShowSteps((v) => !v)}
          aria-pressed={showSteps}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          {showSteps ? t("collapseSteps") : t("expandSteps")}
        </button>

        <aside className={styles.rail} aria-label={t("configSteps")} aria-hidden={!showSteps}>
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
          {nav.showAssist ? (
            <div className={styles.assistCard}>
              <strong>{t("needHelp")}</strong>
              <p>{t("modelHelpHint")}</p>
              <details className={creatorStyles.disclosure}>
                <summary>{t("requestModelAssistance")} →</summary>
                <div className={creatorStyles.formCard}>
                  <ApiForm action={`${apiBase}/model-assets/assistance-requests`} submitLabel={t("submitAssistance")}>
                    <label>
                      {t("assistanceNotes")}
                      <textarea name="notes" placeholder={t("assistanceNotesPlaceholder")} />
                    </label>
                  </ApiForm>
                </div>
              </details>
            </div>
          ) : null}
        </aside>

        <main className={styles.center} aria-hidden={!showSteps}>{renderStep(active, project, apiBase)}</main>

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
                voices={project.voices.map((v) => ({ name: v.name, audioUrl: v.audioUrl, tags: v.tags }))}
                backgroundUrl={project.backgroundUrl}
                welcomeMessage={project.welcomeMessage}
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

function renderStep(active: StepKey, project: WorkspaceProject, apiBase: string) {
  switch (active) {
    case "basics":
      return <BasicsStep project={project} apiBase={apiBase} />;
    case "model":
      return <ModelStep project={project} apiBase={apiBase} />;
    case "tags":
      return <TagsStep project={project} apiBase={apiBase} />;
    case "voice":
      return <VoiceStep project={project} apiBase={apiBase} />;
    case "publish":
      return <PublishStep project={project} apiBase={apiBase} />;
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

function BasicsStep({ project, apiBase }: { project: WorkspaceProject; apiBase: string }) {
  const t = useTranslations("workspace");
  return (
    <>
      <StepHeader title={t("basicInfo")} sub={t("basicsSubtitle")} />
      <div className={creatorStyles.formCard}>
        <ApiForm action={`${apiBase}/profile`} submitLabel={t("saveBasics")}>
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
            {t("fieldCharacterSetting")}
            <textarea name="characterSetting" defaultValue={project.characterSetting} placeholder={t("characterSettingPlaceholder")} />
          </label>
          <label>
            {t("fieldWelcomeMessage")}
            <input name="welcomeMessage" defaultValue={project.welcomeMessage} required />
          </label>
          <label>
            {t("fieldTheme")}
            <input name="theme" type="color" defaultValue={project.theme} aria-label={t("themeAriaLabel")} />
          </label>
        </ApiForm>
      </div>
    </>
  );
}

function ModelStep({ project, apiBase }: { project: WorkspaceProject; apiBase: string }) {
  const t = useTranslations("workspace");
  const [showUpload, setShowUpload] = useState(false);
  const [fileName, setFileName] = useState("");
  const hasModel = project.modelStatus === "valid";
  const statusText = hasModel
    ? t("modelStatusValid")
    : project.modelStatus === "invalid"
      ? t("modelStatusInvalid")
      : project.modelStatus === "pending"
        ? t("modelStatusPending")
        : t("modelNotUploaded");

  return (
    <>
      <StepHeader title={t("stepModel")} sub={t("modelSubtitle")} />
      {showUpload ? (
        <div className={styles.panelBox}>
          <div className={styles.uploadPanel}>
            <ApiForm
              action={`${apiBase}/model-assets`}
              submitLabel={t("uploadAndValidate")}
            >
              <div className={styles.fileField}>
                <span className={styles.fileFieldLabel}>{t("modelZipLabel")}</span>
                <div className={styles.filePicker}>
                  <label htmlFor="model-zip-input" className={styles.filePickerBtn}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <path d="M17 8l-5-5-5 5" />
                      <path d="M12 3v12" />
                    </svg>
                    {t("chooseFile")}
                  </label>
                  <input
                    id="model-zip-input"
                    name="file"
                    type="file"
                    accept=".zip"
                    required
                    className={styles.fileInputHidden}
                    onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
                  />
                  <span className={styles.fileNameText}>{fileName || t("noFileChosen")}</span>
                </div>
              </div>
            </ApiForm>
            <button
              type="button"
              className={styles.cancelUpload}
              onClick={() => {
                setShowUpload(false);
                setFileName("");
              }}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.modelManage}>
          <div className={styles.modelGlyph} aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 2 7l10 5 10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <div className={styles.modelManageName}>{project.name}</div>
            <p className={styles.modelManageHint}>{statusText}</p>
          </div>
          <Button variant={hasModel ? "ghost" : "primary"} onClick={() => setShowUpload(true)}>
            {hasModel ? t("replaceModel") : t("uploadLive2dModel")}
          </Button>
        </div>
      )}
    </>
  );
}

function TagToggle({ apiBase, tagId, enabled }: { apiBase: string; tagId: string; enabled: boolean }) {
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
      const response = await fetch(`${apiBase}/tags/${tagId}`, {
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

function TagsStep({ project, apiBase }: { project: WorkspaceProject; apiBase: string }) {
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
            <TagToggle apiBase={apiBase} tagId={tag.id} enabled={tag.enabled} />
            <details className={creatorStyles.disclosure}>
              <summary>{t("delete")}</summary>
              <div className={creatorStyles.formCard}>
                <ApiForm
                  action={`${apiBase}/tags/${tag.id}`}
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
          {project.capabilities.expressions.length || project.capabilities.motions.length ? (
            <div className={styles.capRef}>
              {project.capabilities.expressions.length ? (
                <div className={styles.capRow}>
                  <span className={styles.capLabel}>{t("modelExpressions")}</span>
                  <div className={styles.capChips}>
                    {project.capabilities.expressions.map((e) => (
                      <span key={e} className={styles.capChip}>{e}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              {project.capabilities.motions.length ? (
                <div className={styles.capRow}>
                  <span className={styles.capLabel}>{t("modelMotions")}</span>
                  <div className={styles.capChips}>
                    {project.capabilities.motions.map((m) => (
                      <span key={m} className={styles.capChip}>{m}</span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className={creatorStyles.pageHeadSub}>{t("noCapabilitiesHint")}</p>
          )}
          <ApiForm action={`${apiBase}/tags`} submitLabel={t("createTag")}>
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
              {project.capabilities.expressions.length ? (
                <select name="live2dExpression" defaultValue="">
                  <option value="">{t("expressionNone")}</option>
                  {project.capabilities.expressions.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              ) : (
                <input name="live2dExpression" placeholder={t("expressionFreeformPlaceholder")} />
              )}
            </label>
            <label>
              {t("fieldLive2dParams")}
              <textarea name="live2dParams" placeholder='{"ParamCheek":0.8}' />
            </label>
            <label>
              {t("fieldPromptFragment")}
              <textarea name="promptFragment" />
            </label>
            {project.voices.length ? (
              <fieldset className={styles.voiceBind}>
                <legend>{t("fieldBindVoices")}</legend>
                {project.voices.map((v) => (
                  <label key={v.id} className={styles.voiceBindItem}>
                    <input type="checkbox" name="voiceAssetIds" value={v.id} />
                    {v.name}
                  </label>
                ))}
              </fieldset>
            ) : null}
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

function voiceSrc(audioUrl?: string) {
  if (!audioUrl) return undefined;
  const isStatic = /^(https?:)?\/\//.test(audioUrl) || audioUrl.startsWith("/");
  // Creator is authenticated, so the proxy authorizes via owner access (no
  // viewer session needed) for protected storage-key voices.
  return isStatic ? audioUrl : `/api/assets/proxy?key=${encodeURIComponent(audioUrl)}`;
}

function VoiceStep({ project, apiBase }: { project: WorkspaceProject; apiBase: string }) {
  const t = useTranslations("workspace");
  return (
    <>
      <StepHeader title={t("stepVoice")} sub={t("voiceSubtitle")} />
      <div className={styles.simpleList}>
        {project.voices.length === 0 ? (
          <div className={creatorStyles.empty}>{t("voiceEmpty")}</div>
        ) : (
          project.voices.map((voice) => (
            <div key={voice.id} className={styles.voiceRow}>
              <span className={styles.voiceRowName}>{voice.name}</span>
              {voice.tags && voice.tags.length ? (
                <span className={styles.voiceRowTags}>{voice.tags.map((tn) => `#${tn}`).join(" ")}</span>
              ) : (
                <span className={styles.voiceRowTags}>{t("voiceUnbound")}</span>
              )}
              {voice.audioUrl ? (
                <audio className={styles.voiceRowAudio} controls preload="none" src={voiceSrc(voice.audioUrl)} />
              ) : null}
              <Pill tone={voice.status === "active" ? "live" : "neutral"}>{voice.status}</Pill>
              <details className={creatorStyles.disclosure}>
                <summary>{t("delete")}</summary>
                <div className={creatorStyles.formCard}>
                  <ApiForm
                    action={`${apiBase}/voices/${voice.id}`}
                    method="DELETE"
                    submitLabel={t("confirmDeleteVoice")}
                    submitVariant="danger"
                  >
                    <span className={creatorStyles.pageHeadSub}>{t("deleteVoiceHint")}</span>
                  </ApiForm>
                </div>
              </details>
            </div>
          ))
        )}
      </div>

      <details className={`${styles.panelBox} ${creatorStyles.disclosure}`}>
        <summary>+ {t("addVoice")}</summary>
        <div className={creatorStyles.formCard}>
          <ApiForm action={`${apiBase}/voices`} submitLabel={t("uploadVoice")}>
            <label>
              {t("voiceName")}
              <input name="name" placeholder={t("voiceNamePlaceholder")} required />
            </label>
            <label>
              {t("voiceFileLabel")}
              <input name="file" type="file" accept=".ogg,.mp3,.wav,.m4a,audio/*" required />
            </label>
            <span className={creatorStyles.pageHeadSub}>{t("voiceUploadHint")}</span>
          </ApiForm>
        </div>
      </details>
    </>
  );
}

function PublishStep({ project, apiBase }: { project: WorkspaceProject; apiBase: string }) {
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
            action={`${apiBase}/publish`}
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
