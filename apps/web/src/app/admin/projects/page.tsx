import Link from "next/link";

import { getCurrentSession } from "@/auth";
import { AdminReviewActions } from "@/components/admin-review-actions";
import { ApiForm } from "@/components/api-form";
import { Pill } from "@/components/ui";
import { modelAssistanceStatusText, resolveModelAssistanceRequests } from "@/lib/model-assistance-requests";
import { hasPermission, isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { AdminAuthRequired, AdminShell, dash } from "../_components";

export const dynamic = "force-dynamic";

const REVIEW_COLS = "2.2fr 1.4fr 1fr 1fr auto";

function relativeTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours}h 前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export default async function AdminProjectsPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const role = session.user.role;
  const [projects, modelSetupRequests, adminModelFulfillments] = await Promise.all([
    prisma.project.findMany({
      include: { creator: { include: { creatorProfile: true } }, currentModelAsset: true },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.auditLog.findMany({
      where: { action: "model_setup_assistance.requested" },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.modelAsset.findMany({
      where: { uploadedBy: "admin", validationStatus: "valid" },
      select: { id: true, projectId: true, version: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const requests = resolveModelAssistanceRequests(modelSetupRequests, adminModelFulfillments);
  const pendingCount = projects.filter((p) => p.status === "draft").length;
  const liveCount = projects.filter((p) => p.status === "published").length;
  const pausedCount = projects.filter((p) => p.status === "paused").length;

  const statusPill = (status: string) =>
    status === "published" ? (
      <Pill tone="live" dot>
        在演
      </Pill>
    ) : status === "paused" ? (
      <Pill tone="danger">已下架</Pill>
    ) : (
      <Pill tone="amber">待审</Pill>
    );

  return (
    <AdminShell active="projects" user={session.user}>
      <div className={dash.pageHead}>
        <div>
          <h1>项目审核</h1>
        </div>
        <div className={dash.toolbar} style={{ flexWrap: "wrap" }}>
          <Pill tone="amber">待审 {pendingCount}</Pill>
          <Pill tone="neutral">在演 {liveCount}</Pill>
          <Pill tone="neutral">已下架 {pausedCount}</Pill>
        </div>
      </div>

      <section className={dash.panel}>
        <div className={dash.tableWrap}>
          <div className={`${dash.tableRow} ${dash.tableHead}`} style={{ gridTemplateColumns: REVIEW_COLS }}>
            <span>角色</span>
            <span>创作者</span>
            <span>状态</span>
            <span>提交时间</span>
            <span>操作</span>
          </div>
          {projects.map((project) => (
            <div key={project.id} className={dash.tableRow} style={{ gridTemplateColumns: REVIEW_COLS }}>
              <div className={dash.projectCell}>
                <div className={dash.projectAvatar} aria-hidden />
                <div className={dash.cellMain}>
                  <strong>{project.name}</strong>
                  <Link href={`/c/${project.slug}`} className={dash.monoTeal}>
                    /c/{project.slug}
                  </Link>
                </div>
              </div>
              <span>{project.creator.creatorProfile?.displayName ?? project.creator.username ?? "—"}</span>
              {statusPill(project.status)}
              <span className={dash.mono}>{relativeTime(project.updatedAt)}</span>
              <div className={dash.rowActions}>
                {hasPermission(role, "projects.pause") ? (
                  <AdminReviewActions projectId={project.id} status={project.status} />
                ) : (
                  <span className={dash.pageHeadSub}>只读</span>
                )}
                {hasPermission(role, "assets.assist") ? (
                  <details className={dash.disclosure}>
                    <summary>模型</summary>
                    <div className={dash.formCard}>
                      <p className={dash.pageHeadSub} style={{ margin: "0 0 10px" }}>
                        当前模型：{project.currentModelAsset?.validationStatus ?? "未上传"}
                      </p>
                      <ApiForm action={`/api/admin/projects/${project.id}/model-assets`} submitLabel="上传协助模型">
                        <label>
                          Live2D zip（覆盖当前模型）
                          <input name="file" type="file" accept=".zip" required />
                        </label>
                      </ApiForm>
                    </div>
                  </details>
                ) : null}
              </div>
            </div>
          ))}
          {projects.length === 0 && <div className={dash.empty}>还没有项目。</div>}
        </div>
      </section>

      <section className={dash.panel}>
        <div className={dash.panelHead}>
          <h2>模型协助请求</h2>
        </div>
        <div className={dash.tableWrap}>
          <div className={`${dash.tableRow} ${dash.tableHead}`} style={{ gridTemplateColumns: "1.4fr 1fr 2fr" }}>
            <span>项目</span>
            <span>状态</span>
            <span>请求人 / 说明</span>
          </div>
          {requests.map((request) => (
            <div key={request.id} className={dash.tableRow} style={{ gridTemplateColumns: "1.4fr 1fr 2fr" }}>
              <div className={dash.cellMain}>
                <strong>{request.projectName}</strong>
                <small>{request.projectId || "n/a"}</small>
              </div>
              <Pill tone={request.status === "fulfilled" ? "live" : "amber"}>
                {request.status === "fulfilled" ? "已完成" : "待配置"}
              </Pill>
              <div className={dash.cellMain}>
                <strong>{request.creatorUsername}</strong>
                <small>{modelAssistanceStatusText(request)}</small>
                {request.notes && <small>{request.notes}</small>}
              </div>
            </div>
          ))}
          {requests.length === 0 && <div className={dash.empty}>还没有模型协助请求。</div>}
        </div>
      </section>
    </AdminShell>
  );
}
