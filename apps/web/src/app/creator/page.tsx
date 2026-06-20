import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getCurrentSession } from "@/auth";
import { Pill } from "@/components/ui";
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
  if (h < 6) return "greetingLateNight";
  if (h < 12) return "greetingMorning";
  if (h < 18) return "greetingAfternoon";
  return "greetingEvening";
}

const onboardingSteps = [
  "onboardingStepUpload",
  "onboardingStepTags",
  "onboardingStepVoice",
  "onboardingStepPublish",
] as const;

export default async function CreatorPage() {
  const t = await getTranslations("creator");
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title={t("authTitleOverview")} />;
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
  const studio = session.user.username ?? t("defaultStudioName");

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
          <h1>{t("greetingHeading", { greeting: t(greeting()), name: studio })}</h1>
          <p className={styles.pageHeadSub}>{t("subStatus", { count: liveCount })}</p>
        </div>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>{t("metricTotalModels")}</div>
          <div className={styles.metricValue}>{projects.length}</div>
        </div>
        <div className={`${styles.metric} ${styles.metricLive}`}>
          <div className={styles.metricLabel}>{t("metricLive")}</div>
          <div className={styles.metricValue}>
            {liveCount}
            {liveCount > 0 && <span className={styles.liveDot} aria-hidden />}
          </div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>{t("metricRecentChats", { days: usageDays })}</div>
          <div className={styles.metricValue}>{usage.totalMessages}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>{t("metricAiQuota")}</div>
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
            <h2>{t("onboardingTitle", { name: onboarding.name })}</h2>
            <span className={styles.panelMeta}>
              {t("onboardingProgress", { done: onboardingDone, total: onboardingSteps.length })}
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
                  {t(label)}
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
          <div className={styles.quickTitle}>{t("quickManageTitle")}</div>
          <div className={styles.quickSub}>{t("quickManageSub")}</div>
        </Link>
        <Link
          href={projects[0] ? `/creator/projects/${projects[0].id}/fan-codes` : "/creator/projects"}
          className={styles.quickCard}
        >
          <div className={styles.quickIcon} aria-hidden>
            ⊞
          </div>
          <div className={styles.quickTitle}>{t("quickFanCodeTitle")}</div>
          <div className={styles.quickSub}>{t("quickFanCodeSub")}</div>
        </Link>
        <Link href="/creator/billing" className={styles.quickCard}>
          <div className={styles.quickIcon} aria-hidden>
            ⊟
          </div>
          <div className={styles.quickTitle}>{t("quickBillingTitle")}</div>
          <div className={styles.quickSub}>{t("quickBillingSub")}</div>
        </Link>
      </div>

      <div className={styles.twoCol}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>{t("usageTitle", { days: usageDays })}</h2>
          </div>
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span>{t("usageMessages")}</span>
              <strong>{usage.totalMessages}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>{t("usageTokens")}</span>
              <strong>{usage.totalTokens}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>{t("usageActiveModels")}</span>
              <strong>{usage.activeProjects}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>{t("usageToday")}</span>
              <strong>{usage.daily.at(-1)?.messages ?? 0}</strong>
            </div>
          </div>
          <UsageTrend daily={usage.daily} />
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>{t("myModels")}</h2>
            <Link href="/creator/projects" className={styles.panelMeta}>
              {t("viewAll")}
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
                  <small>{t(nextProjectStep(project))}</small>
                </div>
                <Pill tone={projectStatusTone(project.status)}>{t(projectStatusLabel(project.status))}</Pill>
                <div className={styles.rowActions}>
                  <Link href={`/creator/projects/${project.id}`}>{t("manage")}</Link>
                </div>
              </div>
            ))}
            {projects.length === 0 && <div className={styles.empty}>{t("emptyModelsDashboard")}</div>}
          </div>
        </section>
      </div>
    </CreatorShell>
  );
}
