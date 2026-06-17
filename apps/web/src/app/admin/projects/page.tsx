import Link from "next/link";

import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { Pill } from "@/components/ui";
import { modelAssistanceStatusText, resolveModelAssistanceRequests } from "@/lib/model-assistance-requests";
import { hasPermission, isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { AdminAuthRequired, AdminShell, dash } from "../_components";

export const dynamic = "force-dynamic";

const SLOT_COLS = "1.3fr 1.3fr 1fr 0.9fr auto";

function modelCapabilitySummary(value: unknown) {
  if (!value || typeof value !== "object") return "无能力信息";
  const record = value as { expressions?: unknown; motions?: unknown };
  const expressions = Array.isArray(record.expressions) ? record.expressions.length : 0;
  const motions = Array.isArray(record.motions) ? record.motions.length : 0;
  return `${expressions} 表情 · ${motions} 动作`;
}

export default async function AdminProjectsPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const role = session.user.role;
  const [creators, modelSetupRequests, adminModelFulfillments] = await Promise.all([
    prisma.user.findMany({
      where: { role: "creator" },
      include: {
        creatorProfile: true,
        creatorPlan: true,
        projects: {
          include: { currentModelAsset: true, _count: { select: { triggerTags: true, fanAccessCodes: true } } },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
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
  const slots = creators.map((creator) => ({ creator, project: creator.projects[0] ?? null }));
  const validModels = slots.filter((s) => s.project?.currentModelAsset?.validationStatus === "valid").length;

  return (
    <AdminShell active="projects" user={session.user}>
      <div className={dash.pageHead}>
        <div>
          <h1>项目交付与审核</h1>
          <p className={dash.pageHeadSub}>
            {slots.length} 个创作者 · {validModels} 个有效模型 · {requests.filter((r) => r.status !== "fulfilled").length} 个待协助
          </p>
        </div>
      </div>

      <section className={dash.panel}>
        <div className={dash.panelHead}>
          <h2>创作者模型槽位</h2>
        </div>
        <div className={dash.tableWrap}>
          <div className={`${dash.tableRow} ${dash.tableHead}`} style={{ gridTemplateColumns: SLOT_COLS }}>
            <span>创作者</span>
            <span>角色 / 模型</span>
            <span>状态</span>
            <span>能力</span>
            <span />
          </div>
          {slots.map(({ creator, project }) => {
            const model = project?.currentModelAsset ?? null;
            const validation = model?.validationStatus;
            return (
              <div key={creator.id} className={dash.tableRow} style={{ gridTemplateColumns: SLOT_COLS }}>
                <div className={dash.cellMain}>
                  <strong>{creator.creatorProfile?.displayName ?? creator.username ?? creator.id}</strong>
                  <small>{creator.username ?? creator.id}</small>
                </div>
                <div className={dash.cellMain}>
                  <strong>{project?.name ?? "未创建角色"}</strong>
                  <small>{project ? `/c/${project.slug}` : "每个创作者一个模型位"}</small>
                </div>
                <Pill tone={validation === "valid" ? "live" : validation ? "danger" : "amber"}>
                  {validation ?? "未上传"}
                </Pill>
                <span className={dash.mono}>{modelCapabilitySummary(model?.capabilities)}</span>
                <div className={dash.rowActions}>
                  {project && <Link href={`/c/${project.slug}`}>观众页</Link>}
                  {project && (
                    <details className={dash.disclosure}>
                      <summary>管理</summary>
                      <div className={dash.formCard} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {hasPermission(role, "projects.pause") && (
                          <ApiForm action={`/api/admin/projects/${project.id}/status`} submitLabel="设置状态">
                            <label>
                              状态
                              <select name="status" defaultValue={project.status}>
                                <option value="published">上演中</option>
                                <option value="paused">暂停</option>
                                <option value="draft">草稿</option>
                              </select>
                            </label>
                          </ApiForm>
                        )}
                        <ApiForm action={`/api/admin/projects/${project.id}/model-assets`} submitLabel="上传协助模型">
                          <label>
                            Live2D zip（覆盖当前模型）
                            <input name="file" type="file" accept=".zip" required />
                          </label>
                        </ApiForm>
                        {hasPermission(role, "projects.pause") && (
                          <ApiForm action={`/api/admin/projects/${project.id}`} method="DELETE" submitLabel="删除项目">
                            <span className={dash.pageHeadSub}>删除项目及其模型、标签、粉丝码与用量记录。</span>
                          </ApiForm>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            );
          })}
          {slots.length === 0 && <div className={dash.empty}>还没有创作者账号。</div>}
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
