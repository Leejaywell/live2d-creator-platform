import Link from "next/link";

import { getCurrentSession } from "@/auth";
import { Pill } from "@/components/ui";
import { isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listRecentSafetyEvents } from "@/lib/safety-events";

import { AdminAuthRequired, AdminShell, dash } from "./_components";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const [creatorCount, adminCount, projectCount, publishedCount, pendingOrders, recentDrafts, safetyEvents] =
    await Promise.all([
      prisma.user.count({ where: { role: "creator" } }),
      prisma.user.count({ where: { role: { in: ["super_admin", "ops_admin", "support_admin"] } } }),
      prisma.project.count(),
      prisma.project.count({ where: { status: "published" } }),
      prisma.manualOrder.count({ where: { paymentStatus: "pending" } }),
      prisma.project.findMany({
        where: { status: { not: "published" } },
        include: { creator: { select: { username: true } } },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
      listRecentSafetyEvents(6),
    ]);

  return (
    <AdminShell active="overview" user={session.user}>
      <div className={dash.pageHead}>
        <div>
          <h1>平台概览</h1>
          <p className={dash.pageHeadSub}>账号、项目、订单与安全信号</p>
        </div>
      </div>

      <div className={dash.metrics} style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div className={dash.metric}>
          <div className={dash.metricLabel}>创作者</div>
          <div className={dash.metricValue}>{creatorCount}</div>
        </div>
        <div className={dash.metric}>
          <div className={dash.metricLabel}>管理员</div>
          <div className={dash.metricValue}>{adminCount}</div>
        </div>
        <div className={dash.metric}>
          <div className={dash.metricLabel}>项目数</div>
          <div className={dash.metricValue}>{projectCount}</div>
        </div>
        <div className={dash.metric} style={{ background: "var(--amber-fill)", borderColor: "rgba(242,193,78,0.28)" }}>
          <div className={dash.metricLabel}>待确认订单</div>
          <div className={dash.metricValue} style={{ color: "var(--amber)" }}>
            {pendingOrders}
          </div>
        </div>
        <div className={`${dash.metric} ${dash.metricLive}`}>
          <div className={dash.metricLabel}>在演项目</div>
          <div className={dash.metricValue}>
            {publishedCount}
            {publishedCount > 0 && <span className={dash.liveDot} aria-hidden />}
          </div>
        </div>
      </div>

      <div className={dash.twoCol} style={{ gridTemplateColumns: "1.5fr 1fr" }}>
        <section className={dash.panel}>
          <div className={dash.panelHead}>
            <h2>待交付 / 未发布项目</h2>
            <Link href="/admin/projects" className={dash.panelMeta}>
              全部 →
            </Link>
          </div>
          <div className={dash.table}>
            {recentDrafts.map((project) => (
              <div key={project.id} className={dash.tableRow} style={{ gridTemplateColumns: "1fr auto" }}>
                <div className={dash.cellMain}>
                  <strong>{project.name}</strong>
                  <small>
                    {project.creator.username ?? "—"} · /c/{project.slug}
                  </small>
                </div>
                <Pill tone={project.status === "paused" ? "danger" : "amber"}>
                  {project.status === "paused" ? "已暂停" : "草稿"}
                </Pill>
              </div>
            ))}
            {recentDrafts.length === 0 && <div className={dash.empty}>没有待处理的项目。</div>}
          </div>
        </section>

        <section className={dash.panel}>
          <div className={dash.panelHead}>
            <h2>安全队列</h2>
          </div>
          <div className={dash.table}>
            {safetyEvents.map((event) => (
              <div key={event.id} className={dash.tableRow} style={{ gridTemplateColumns: "1fr" }}>
                <div className={dash.cellMain}>
                  <strong>{event.projectName}</strong>
                  <small>{event.messagePreview || "无消息预览"}</small>
                </div>
              </div>
            ))}
            {safetyEvents.length === 0 && <div className={dash.empty}>还没有被拦截的消息。</div>}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
