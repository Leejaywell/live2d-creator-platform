import Link from "next/link";

import { getCurrentSession } from "@/auth";
import { LinkButton, Pill } from "@/components/ui";
import { ensureCreatorPlan } from "@/lib/creator-onboarding";
import { prisma } from "@/lib/prisma";
import { summarizeUsageAnalytics, usageWindowStart } from "@/lib/usage-analytics";

import {
  CreatorAuthRequired,
  CreatorShell,
  UsageBar,
  UsageTrend,
  nextProjectStep,
  projectStatusLabel,
  projectStatusTone,
  creatorStyles as styles,
} from "./_components";

export const dynamic = "force-dynamic";

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 18) return "下午好";
  return "晚上好";
}

const onboardingSteps = ["上传模型", "配置标签", "绑定语音", "发布"] as const;

export default async function CreatorPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title="创作者工作台" />;
  }

  const usageDays = 7;
  const [plan, projects, usageRecords] = await Promise.all([
    ensureCreatorPlan(session.user.id),
    prisma.project.findMany({
      where: { creatorId: session.user.id },
      include: {
        currentModelAsset: true,
        _count: { select: { triggerTags: true, voiceAssets: true, fanAccessCodes: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.chatUsage.findMany({
      where: { creatorId: session.user.id, createdAt: { gte: usageWindowStart(usageDays) } },
      include: { project: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const usage = summarizeUsageAnalytics(
    usageRecords.map((record) => ({
      projectId: record.projectId,
      projectName: record.project.name,
      messageCount: record.messageCount,
      tokenEstimate: record.tokenEstimate,
      createdAt: record.createdAt,
    })),
    { days: usageDays }
  );

  const liveCount = projects.filter((p) => p.status === "published").length;
  const quotaPct =
    plan && plan.monthlyAiMessageLimit > 0
      ? Math.min(100, Math.round((plan.usedAiMessages / plan.monthlyAiMessageLimit) * 100))
      : 0;
  const studio = session.user.username ?? "创作者";

  // pick the most recent project still being prepared for the onboarding strip
  const onboarding = projects.find((p) => p.status !== "published");
  const onboardingState = onboarding
    ? [
        onboarding.currentModelAsset?.validationStatus === "valid",
        onboarding._count.triggerTags > 0,
        onboarding._count.voiceAssets > 0,
        false,
      ]
    : [];
  const onboardingDone = onboardingState.filter(Boolean).length;

  return (
    <CreatorShell active="overview" user={session.user} planName={plan?.planName}>
      <div className={styles.pageHead}>
        <div>
          <h1>
            {greeting()}，{studio}
          </h1>
          <p className={styles.pageHeadSub}>
            {liveCount} 位角色正在演 · 平台运行正常
          </p>
        </div>
        <LinkButton href="/creator/projects">+ 新建项目</LinkButton>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>项目总数</div>
          <div className={styles.metricValue}>{projects.length}</div>
        </div>
        <div className={`${styles.metric} ${styles.metricLive}`}>
          <div className={styles.metricLabel}>在演中</div>
          <div className={styles.metricValue}>
            {liveCount}
            {liveCount > 0 && <span className={styles.liveDot} aria-hidden />}
          </div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>近 {usageDays} 天对话</div>
          <div className={styles.metricValue}>{usage.totalMessages}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>AI 消息配额</div>
          <div className={styles.metricValue}>
            {quotaPct}
            <span className={styles.metricUnit}>%</span>
          </div>
          <UsageBar used={plan?.usedAiMessages ?? 0} limit={plan?.monthlyAiMessageLimit ?? 0} />
        </div>
      </div>

      {onboarding && (
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>完成「{onboarding.name}」的开演准备</h2>
            <span className={styles.panelMeta}>
              {onboardingDone} / {onboardingSteps.length} 步
            </span>
          </div>
          <div className={styles.steps}>
            {onboardingSteps.map((label, index) => {
              const done = onboardingState[index];
              const current = !done && onboardingState.slice(0, index).every(Boolean);
              return (
                <div
                  key={label}
                  className={`${styles.step} ${done ? styles.stepDone : current ? styles.stepCurrent : ""}`}
                >
                  <span className={styles.stepMark} aria-hidden>
                    {done ? "✓" : index + 1}
                  </span>
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.quickGrid}>
        <Link href="/creator/projects" className={styles.quickCard}>
          <div className={styles.quickIcon} aria-hidden>
            ＋
          </div>
          <div className={styles.quickTitle}>新建角色项目</div>
          <div className={styles.quickSub}>从模型上传开始</div>
        </Link>
        <Link href="/creator/projects" className={styles.quickCard}>
          <div className={styles.quickIcon} aria-hidden>
            ⊞
          </div>
          <div className={styles.quickTitle}>生成粉丝码</div>
          <div className={styles.quickSub}>批量发放访问码</div>
        </Link>
        <Link href="/creator/billing" className={styles.quickCard}>
          <div className={styles.quickIcon} aria-hidden>
            ⊟
          </div>
          <div className={styles.quickTitle}>查看账单</div>
          <div className={styles.quickSub}>用量与套餐</div>
        </Link>
      </div>

      <div className={styles.twoCol}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>近 {usageDays} 天用量</h2>
          </div>
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span>消息数</span>
              <strong>{usage.totalMessages}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>Token 估算</span>
              <strong>{usage.totalTokens}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>活跃项目</span>
              <strong>{usage.activeProjects}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>今日</span>
              <strong>{usage.daily.at(-1)?.messages ?? 0}</strong>
            </div>
          </div>
          <UsageTrend daily={usage.daily} />
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>最近项目</h2>
            <Link href="/creator/projects" className={styles.panelMeta}>
              全部 →
            </Link>
          </div>
          <div className={styles.table}>
            {projects.slice(0, 5).map((project) => (
              <div
                key={project.id}
                className={styles.tableRow}
                style={{ gridTemplateColumns: "1fr auto auto" }}
              >
                <div className={styles.cellMain}>
                  <strong>{project.name}</strong>
                  <small>{nextProjectStep(project)}</small>
                </div>
                <Pill tone={projectStatusTone(project.status)}>{projectStatusLabel(project.status)}</Pill>
                <div className={styles.rowActions}>
                  <Link href={`/creator/projects/${project.id}`}>管理</Link>
                </div>
              </div>
            ))}
            {projects.length === 0 && <div className={styles.empty}>还没有项目，点右上角「新建项目」开始。</div>}
          </div>
        </section>
      </div>
    </CreatorShell>
  );
}
