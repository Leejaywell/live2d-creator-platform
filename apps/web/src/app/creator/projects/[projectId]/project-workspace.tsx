"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiForm } from "@/components/api-form";
import { TriggerTagTester } from "@/components/trigger-tag-tester";
import { Button, LinkButton, Pill, type Tone } from "@/components/ui";

import { creatorStyles } from "../../_components";
import { updateProjectAction } from "./actions";
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
const statusLabelMap: Record<string, string> = { published: "上演中", paused: "已暂停", draft: "草稿" };

export function ProjectWorkspace({ project }: { project: WorkspaceProject }) {
  const [active, setActive] = useState<StepKey>("model");

  const [profileDone, modelDone, tagsDone] = project.readiness;
  const publishUnlocked = profileDone && modelDone && tagsDone;

  const steps: Array<{ key: StepKey; name: string; sub: string; done: boolean; locked?: boolean }> = [
    {
      key: "model",
      name: "模型资源",
      sub: modelDone ? `已校验 · ${project.modelAssetCount} 个资产` : "上传 Live2D 模型",
      done: modelDone,
    },
    {
      key: "tags",
      name: "触发标签",
      sub: project.tags.length ? `${project.tags.length} 个标签` : "待配置",
      done: tagsDone,
    },
    {
      key: "voice",
      name: "语音绑定",
      sub: project.voices.length ? `${project.voices.length} 条语音` : "待配置",
      done: project.voices.length > 0,
    },
    { key: "basics", name: "人设设定", sub: profileDone ? "已填写" : "完善人设与简介", done: profileDone },
    {
      key: "publish",
      name: "发布设置",
      sub: publishUnlocked ? (project.status === "published" ? "已发布" : "可发布") : "完成前置步骤后解锁",
      done: project.status === "published",
      locked: !publishUnlocked,
    },
  ];

  return (
    <div className={styles.wrap}>
      <header className={styles.topbar}>
        <div className={styles.topLeft}>
          <Link href="/creator" className={styles.back}>
            ← 工作台
          </Link>
          <span className={styles.vdivider} aria-hidden />
          <span className={styles.projectMark} aria-hidden />
          <div className={styles.projectTitle}>
            {project.name}
            <Pill tone={statusToneMap[project.status]}>{statusLabelMap[project.status]}</Pill>
          </div>
        </div>
        <div className={styles.topActions}>
          <span className={styles.autosave}>已保存</span>
          <LinkButton href={`/creator/projects/${project.id}/fan-codes`} variant="ghost" size="sm">
            粉丝码
          </LinkButton>
          <LinkButton href={`/creator/projects/${project.id}/preview`} variant="ghost" size="sm">
            预览
          </LinkButton>
          <Button size="sm" onClick={() => setActive("publish")} disabled={!publishUnlocked}>
            发布 →
          </Button>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.rail} aria-label="配置步骤">
          <div className={styles.railLabel}>配置步骤</div>
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
            <strong>需要协助？</strong>
            <p>模型绑定遇到问题可申请官方协助处理。</p>
            <Link href="#">申请 model-assistance →</Link>
          </div>
        </aside>

        <main className={styles.center}>{renderStep(active, project)}</main>

        <aside className={styles.stage}>
          <div className={styles.stageHead}>
            <span className={styles.stageHeadLabel}>常驻预览</span>
            <span className={styles.stageLive}>实时</span>
          </div>
          <div className={styles.stageBody}>
            <div className={styles.stageSlot}>
              LIVE2D
              <br />
              {project.modelStatus === "valid" ? "模型已就绪" : "模型渲染区"}
            </div>
          </div>
          <div className={styles.stageFoot}>
            <Button variant="ghost" size="sm" block>
              重置姿态
            </Button>
            <LinkButton
              href={`/creator/projects/${project.id}/preview`}
              variant="tintPink"
              size="sm"
              block
              style={{ flex: 1 }}
            >
              打开预览
            </LinkButton>
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
  return (
    <>
      <StepHeader title="基本信息" sub="角色名片、人设提示词与欢迎语" />
      <div className={creatorStyles.formCard}>
        <form action={updateProjectAction.bind(null, project.id)}>
          <label>
            名称
            <input name="name" defaultValue={project.name} required />
          </label>
          <label>
            Slug
            <input name="slug" defaultValue={project.slug} pattern="[a-z0-9-]+" required />
          </label>
          <label>
            简介
            <textarea name="intro" defaultValue={project.intro} />
          </label>
          <label>
            头像 URL
            <input name="avatarUrl" type="url" defaultValue={project.avatarUrl ?? ""} />
          </label>
          <label>
            舞台背景图 URL
            <input name="backgroundUrl" type="url" defaultValue={project.backgroundUrl ?? ""} />
          </label>
          <label>
            系统提示词（人设）
            <textarea name="systemPrompt" defaultValue={project.systemPrompt} required />
          </label>
          <label>
            欢迎语
            <input name="welcomeMessage" defaultValue={project.welcomeMessage} required />
          </label>
          <label>
            主题色
            <input name="theme" type="color" defaultValue={project.theme} aria-label="项目主题色" />
          </label>
          <Button type="submit">保存基本信息</Button>
        </form>
      </div>
    </>
  );
}

function ModelStep({ project }: { project: WorkspaceProject }) {
  const statusText =
    project.modelStatus === "valid"
      ? "当前模型已校验通过"
      : project.modelStatus === "invalid"
        ? "当前模型校验失败，请重新上传"
        : project.modelStatus === "pending"
          ? "模型校验中"
          : "尚未上传模型";
  return (
    <>
      <StepHeader title="模型资源" sub="上传 Live2D zip（包含唯一 .model3.json）" />
      <div className={styles.panelBox}>
        <p style={{ margin: "0 0 14px", color: "var(--text-dim)", fontSize: 14 }}>
          {statusText} · 共 {project.modelAssetCount} 个资产
        </p>
        <div className={creatorStyles.formCard}>
          <ApiForm
            action={`/api/creator/projects/${project.id}/model-assets`}
            submitLabel="上传并校验模型"
          >
            <label>
              Live2D 模型 zip
              <input name="file" type="file" accept=".zip" required />
            </label>
          </ApiForm>
        </div>
      </div>
    </>
  );
}

function TagToggle({ projectId, tagId, enabled }: { projectId: string; tagId: string; enabled: boolean }) {
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
      aria-label={on ? "停用标签" : "启用标签"}
      className={`${styles.toggle} ${on ? styles.toggleOn : ""}`}
      onClick={toggle}
      disabled={pending}
    >
      <span className={styles.toggleKnob} aria-hidden />
    </button>
  );
}

function TagsStep({ project }: { project: WorkspaceProject }) {
  return (
    <>
      <StepHeader title="触发标签" sub="文本命中关键词 → 触发对应表情与参数" />
      <div className={styles.tagList}>
        {project.tags.length === 0 && (
          <div className={creatorStyles.empty}>还没有触发标签，先新建一个让回复更有角色感。</div>
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
                <span className={styles.tagKw}>无关键词</span>
              )}
            </div>
            {tag.live2dExpression && <span className={styles.tagMeta}>{tag.live2dExpression}</span>}
            <TagToggle projectId={project.id} tagId={tag.id} enabled={tag.enabled} />
            <details className={creatorStyles.disclosure}>
              <summary>删除</summary>
              <div className={creatorStyles.formCard}>
                <ApiForm
                  action={`/api/creator/projects/${project.id}/tags/${tag.id}`}
                  method="DELETE"
                  submitLabel="确认删除标签"
                  submitVariant="danger"
                >
                  <span className={creatorStyles.pageHeadSub}>删除后该标签不再参与触发。</span>
                </ApiForm>
              </div>
            </details>
          </div>
        ))}
      </div>

      <details className={`${styles.panelBox} ${creatorStyles.disclosure}`}>
        <summary>+ 新建触发标签</summary>
        <div className={creatorStyles.formCard}>
          <ApiForm action={`/api/creator/projects/${project.id}/tags`} submitLabel="创建标签">
            <label>
              名称
              <input name="name" placeholder="害羞" required />
            </label>
            <label>
              关键词（逗号分隔）
              <input name="keywords" placeholder="可爱,喜欢,脸红" />
            </label>
            <label>
              Live2D 表情文件
              <input name="live2dExpression" placeholder="exp_shy" />
            </label>
            <label>
              Live2D 参数（JSON，可选）
              <textarea name="live2dParams" placeholder='{"ParamCheek":0.8}' />
            </label>
            <label>
              提示词片段（可选）
              <textarea name="promptFragment" />
            </label>
            <label>
              优先级
              <input name="priority" type="number" defaultValue="0" />
            </label>
          </ApiForm>
        </div>
      </details>

      <div className={styles.tester}>
        <div className={styles.testerLabel}>⚡ 标签测试器</div>
        <div className={creatorStyles.formCard}>
          <TriggerTagTester projectId={project.id} />
        </div>
      </div>
    </>
  );
}

function VoiceStep({ project }: { project: WorkspaceProject }) {
  return (
    <>
      <StepHeader title="语音绑定" sub="预置语音通过触发标签朗读（MVP 由管理员协助上传）" />
      <div className={styles.simpleList}>
        {project.voices.length === 0 ? (
          <div className={creatorStyles.empty}>还没有语音资源。可在「需要协助」中申请管理员上传，并绑定到触发标签。</div>
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
  const readinessLabels = ["基本信息", "Live2D 模型", "触发标签", "粉丝码"];
  return (
    <>
      <StepHeader title="发布设置" sub="确认就绪清单后发布，观众即可凭码进场" />
      <ul className={styles.checklist}>
        {readinessLabels.map((label, index) => (
          <li key={label} className={styles.checkItem}>
            <div>
              <strong>{label}</strong>
              <span>{project.readiness[index] ? "已就绪" : "待处理"}</span>
            </div>
            <Pill tone={project.readiness[index] ? "live" : "amber"}>
              {project.readiness[index] ? "就绪" : "待处理"}
            </Pill>
          </li>
        ))}
      </ul>

      <div className={styles.panelBox}>
        <div className={creatorStyles.formCard}>
          <ApiForm
            action={`/api/creator/projects/${project.id}/publish`}
            submitLabel={project.status === "published" ? "暂停上演" : "发布上演"}
          >
            <input
              type="hidden"
              name="status"
              value={project.status === "published" ? "paused" : "published"}
            />
            <span className={creatorStyles.pageHeadSub}>
              当前状态：{statusLabelMap[project.status]}。
              {project.status === "published" ? "暂停后新会话将无法进场。" : "发布后观众可凭有效粉丝码进场。"}
            </span>
          </ApiForm>
        </div>
      </div>
    </>
  );
}
