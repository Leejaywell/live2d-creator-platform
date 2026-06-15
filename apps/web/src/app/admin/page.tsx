import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listRecentSafetyEvents } from "@/lib/safety-events";
import { summarizeUsageAnalytics, usageWindowStart } from "@/lib/usage-analytics";

import { AdminAuthRequired, AdminChrome, CapabilityRow, UsageTrend } from "./_components";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const usageDays = 7;
  const [adminUsers, creators, orders, projects, fanAccessCodes, usageRecords, safetyEvents] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["super_admin", "ops_admin", "support_admin"] } }, take: 20 }),
    prisma.user.findMany({ where: { role: "creator" }, take: 20 }),
    prisma.manualOrder.findMany({ take: 20 }),
    prisma.project.findMany({ take: 20 }),
    prisma.fanAccessCode.findMany({ take: 30 }),
    prisma.chatUsage.findMany({
      where: { createdAt: { gte: usageWindowStart(usageDays) } },
      include: { project: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    listRecentSafetyEvents(10),
  ]);
  const activeCreators = creators.filter((creator) => creator.status === "active").length;
  const publishedProjects = projects.filter((project) => project.status === "published").length;
  const pendingOrders = orders.filter((order) => order.paymentStatus !== "confirmed").length;
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
    <AdminChrome active="overview" user={session.user}>
      <section className={styles.grid}>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>创作者</span>
          <strong>{creators.length}</strong>
          <p className={styles.muted}>最近一页中 {activeCreators} 个活跃账号。</p>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>管理员</span>
          <strong>{adminUsers.length}</strong>
          <p className={styles.muted}>超级 / 运营 / 客服管理员。</p>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>手动订单</span>
          <strong>{orders.length}</strong>
          <p className={styles.muted}>{pendingOrders} 笔待确认。</p>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>粉丝码</span>
          <strong>{fanAccessCodes.length}</strong>
          <p className={styles.muted}>{publishedProjects} 个项目上演中。</p>
        </div>
      </section>

      <section className={styles.twoColumn}>
        <div className={styles.forms}>
          <section className={styles.panel}>
            <h2>运营概览</h2>
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
                <span>粉丝码</span>
                <strong>{fanAccessCodes.length}</strong>
              </div>
            </div>
            <h3>近 {usageDays} 天趋势</h3>
            <UsageTrend daily={usage.daily} />
          </section>

          <section className={styles.panel}>
            <h2>安全队列</h2>
            <p className={styles.muted}>最近被内容审查或提示词安全规则拦截的粉丝消息。</p>
            <ul className={styles.list}>
              {safetyEvents.map((event) => (
                <li className={styles.row} key={event.id}>
                  <strong>{event.projectName}</strong>
                  <span>{event.creatorUsername}{event.projectSlug ? ` · /c/${event.projectSlug}` : ""}</span>
                  <span>{event.messagePreview || "无消息预览。"}</span>
                </li>
              ))}
              {!safetyEvents.length ? <li className={styles.row}>还没有被拦截的消息。</li> : null}
            </ul>
          </section>
        </div>

        <div className={styles.forms}>
          <section className={styles.panel}>
            <h2>平台能力状态</h2>
            <ul className={styles.checklist}>
              <CapabilityRow title="账号密码登录" detail="管理员与创作者使用同一套登录逻辑,按角色进入不同页面。" done />
              <CapabilityRow title="手动收款与配额台账" detail="管理员创建并确认订单,配额变更进入台账。" done />
              <CapabilityRow title="Live2D 模型交付" detail="创作者/管理员上传、校验、覆盖当前模型与受保护分发均已启用。" done />
              <CapabilityRow title="粉丝码进场与聊天代理" detail="访问码校验、设备绑定,AI 成功回复后扣减配额。" done />
              <CapabilityRow title="支付回调" detail="带签名的支付宝 webhook 可确认订单并写入配额台账。" done />
            </ul>
          </section>
        </div>
      </section>
    </AdminChrome>
  );
}
