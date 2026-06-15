import Link from "next/link";

import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { ensureCreatorPlan } from "@/lib/creator-onboarding";
import { prisma } from "@/lib/prisma";
import { summarizeUsageAnalytics, usageWindowStart } from "@/lib/usage-analytics";

import { CreatorAuthRequired, CreatorChrome, UsageBar, UsageTrend } from "./_components";

export const dynamic = "force-dynamic";

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
      include: { fanAccessCodes: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
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
    { days: usageDays },
  );

  return (
    <CreatorChrome active="overview" user={session.user}>
      <section className={styles.grid}>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>当前套餐</span>
          <strong>{plan?.planName ?? "未开通"}</strong>
          <p className={styles.muted}>{plan ? `${plan.expiresAt.toISOString().slice(0, 10)} 到期` : "联系管理员开通套餐。"}</p>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>AI 消息</span>
          <strong>{plan ? `${plan.usedAiMessages}/${plan.monthlyAiMessageLimit}` : "0/0"}</strong>
          <UsageBar used={plan?.usedAiMessages ?? 0} limit={plan?.monthlyAiMessageLimit ?? 0} />
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>粉丝码</span>
          <strong>{plan ? `${plan.usedFanCodes}/${plan.fanCodeQuota}` : "0/0"}</strong>
          <UsageBar used={plan?.usedFanCodes ?? 0} limit={plan?.fanCodeQuota ?? 0} />
        </div>
      </section>

      <section className={styles.twoColumn}>
        <section className={styles.panel}>
          <h2>近 {usageDays} 天用量</h2>
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
          <h2>最近项目</h2>
          <ul className={styles.list}>
            {projects.map((project) => (
              <li className={styles.row} key={project.id}>
                <strong>{project.name}</strong>
                <span>
                  /c/{project.slug} · {project.status} · {project.fanAccessCodes.length} 个粉丝码
                </span>
                <div className={styles.nav}>
                  <Link href={`/creator/projects/${project.id}`}>管理</Link>
                  <Link href={`/c/${project.slug}`}>观众页</Link>
                </div>
              </li>
            ))}
            {!projects.length ? <li className={styles.row}>还没有项目。</li> : null}
          </ul>
          <Link className={styles.buttonLink} href="/creator/projects">
            管理所有项目
          </Link>
        </section>
      </section>
    </CreatorChrome>
  );
}
