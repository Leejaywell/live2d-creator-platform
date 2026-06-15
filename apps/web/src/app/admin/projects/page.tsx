import Link from "next/link";

import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { modelAssistanceStatusText, resolveModelAssistanceRequests } from "@/lib/model-assistance-requests";
import { hasPermission, isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { AdminAuthRequired, AdminChrome } from "../_components";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const [creators, modelSetupRequests, adminModelFulfillments] = await Promise.all([
    prisma.user.findMany({
      where: { role: "creator" },
      include: {
        creatorProfile: true,
        creatorPlan: true,
        projects: {
          include: { currentModelAsset: true, triggerTags: true, fanAccessCodes: true },
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
  const modelAssistanceRequests = resolveModelAssistanceRequests(modelSetupRequests, adminModelFulfillments);
  const modelSlots = creators.map((creator) => ({
    creator,
    project: creator.projects[0] ?? null,
  }));
  const validModelCount = modelSlots.filter((slot) => slot.project?.currentModelAsset?.validationStatus === "valid").length;
  const emptySlotCount = modelSlots.filter((slot) => !slot.project?.currentModelAsset).length;

  return (
    <AdminChrome active="projects" user={session.user}>
      <section className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>MODEL SLOTS</p>
          <h2>模型管理</h2>
        </div>
        <div className={styles.sectionActions}>
          <span className={styles.statusPill}>{modelSlots.length} 个创作者</span>
          <span className={`${styles.statusPill} ${styles.statusGood}`}>{validModelCount} 个有效模型</span>
          <span className={emptySlotCount ? `${styles.statusPill} ${styles.statusWarn}` : styles.statusPill}>{emptySlotCount} 个空模型位</span>
        </div>
      </section>

      <section className={styles.primaryPane}>
          <section className={styles.panel}>
            <h2>创作者模型槽位</h2>
            <div className={`${styles.dataTable} ${styles.modelSlotTable}`}>
              <div className={styles.dataHeader}>
                <span>创作者</span>
                <span>角色模型</span>
                <span>当前模型</span>
                <span>能力</span>
                <span>状态</span>
                <span>操作</span>
              </div>
              {modelSlots.map(({ creator, project }) => {
                const model = project?.currentModelAsset ?? null;
                return (
                <div className={styles.dataRow} key={creator.id}>
                  <div className={styles.dataCell}>
                    <strong>{creator.creatorProfile?.displayName ?? creator.username ?? creator.id}</strong>
                    <small>{creator.username ?? creator.id}</small>
                  </div>
                  <div className={styles.dataCell}>
                    <strong>{project?.name ?? "未创建角色"}</strong>
                    <small>{project ? `/c/${project.slug}` : "一个创作者只保留一个模型位"}</small>
                  </div>
                  <div className={styles.dataCell}>
                    <span className={model?.validationStatus === "valid" ? `${styles.statusPill} ${styles.statusGood}` : model ? `${styles.statusPill} ${styles.statusBad}` : `${styles.statusPill} ${styles.statusWarn}`}>
                      {model?.validationStatus ?? "未上传"}
                    </span>
                    {model ? <small>v{model.version} · {formatDate(model.createdAt)}</small> : null}
                  </div>
                  <div className={styles.dataCell}>
                    <strong>{modelCapabilitySummary(model?.capabilities)}</strong>
                    <small>{project ? `${project.triggerTags.length} 标签 · ${project.fanAccessCodes.length} 粉丝码` : "等待创作者创建角色"}</small>
                  </div>
                  <div className={styles.dataCell}>
                    {project ? (
                      <span className={project.status === "published" ? `${styles.statusPill} ${styles.statusGood}` : project.status === "paused" ? `${styles.statusPill} ${styles.statusBad}` : `${styles.statusPill} ${styles.statusWarn}`}>
                        {project.status}
                      </span>
                    ) : (
                      <span className={`${styles.statusPill} ${styles.statusWarn}`}>空</span>
                    )}
                    {creator.creatorPlan ? <small>项目 {creator.projects.length}/1 · AI {creator.creatorPlan.usedAiMessages}/{creator.creatorPlan.monthlyAiMessageLimit}</small> : null}
                  </div>
                  <div className={`${styles.dataCell} ${styles.rowActions}`}>
                    {project ? <Link href={`/c/${project.slug}`}>观众页</Link> : null}
                    {model?.validationStatus === "valid" && project ? (
                      <Link href={`/admin/projects/${project.id}/model-assets/${model.id}/preview`}>预览</Link>
                    ) : null}
                    {project ? (
                      <details className={`${styles.collapse} ${styles.compactDetails}`}>
                        <summary>更多</summary>
                        <div className={styles.actionStack}>
                          {hasPermission(session.user.role, "projects.pause") ? (
                            <ApiForm action={`/api/admin/projects/${project.id}/status`} submitLabel="设置状态">
                              <label>
                                状态
                                <select name="status" defaultValue={project.status}>
                                  <option value="published">上演中(published)</option>
                                  <option value="paused">暂停(paused)</option>
                                  <option value="draft">草稿(draft)</option>
                                </select>
                              </label>
                            </ApiForm>
                          ) : null}
                          <ApiForm action={`/api/admin/projects/${project.id}/model-assets`} submitLabel="上传协助模型">
                            <label>
                              Live2D zip
                              <input name="file" type="file" accept=".zip" required />
                            </label>
                            <span className={styles.muted}>上传后会覆盖当前模型。</span>
                          </ApiForm>
                          {model ? (
                            <ApiForm action={`/api/admin/projects/${project.id}/model-assets/${model.id}`} method="DELETE" submitLabel="删除当前模型">
                              <span className={styles.muted}>删除当前模型记录。删除后项目将没有可用模型。</span>
                            </ApiForm>
                          ) : null}
                          {hasPermission(session.user.role, "projects.pause") ? (
                            <ApiForm action={`/api/admin/projects/${project.id}`} method="DELETE" submitLabel="确认删除项目">
                              <span className={styles.muted}>删除项目及其模型、标签、粉丝码和聊天用量记录。</span>
                            </ApiForm>
                          ) : null}
                        </div>
                      </details>
                    ) : null}
                  </div>
                </div>
                );
              })}
              {!modelSlots.length ? <div className={styles.emptyState}>还没有创作者账号。</div> : null}
            </div>
          </section>

          <section className={styles.panel}>
            <h2>模型协助请求</h2>
            <div className={`${styles.dataTable} ${styles.cols4}`}>
              <div className={styles.dataHeader}>
                <span>项目</span>
                <span>状态</span>
                <span>请求人 / 说明</span>
                <span>资产</span>
              </div>
              {modelAssistanceRequests.map((request) => (
                <div className={styles.dataRow} key={request.id}>
                  <div className={styles.dataCell}>
                    <strong>{request.projectName}</strong>
                    <small>{request.projectId || "n/a"}</small>
                  </div>
                  <div className={styles.dataCell}>
                    <span className={request.status === "fulfilled" ? `${styles.statusPill} ${styles.statusGood}` : `${styles.statusPill} ${styles.statusWarn}`}>
                      {request.status === "fulfilled" ? "已完成" : "待配置"}
                    </span>
                  </div>
                  <div className={styles.dataCell}>
                    <strong>{request.creatorUsername}</strong>
                    <small>{modelAssistanceStatusText(request)}</small>
                    {request.notes ? <small>{request.notes}</small> : null}
                  </div>
                  <div className={styles.dataCell}>{request.fulfilledModelAssetId ?? "无"}</div>
                </div>
              ))}
              {!modelAssistanceRequests.length ? <div className={styles.emptyState}>还没有模型协助请求。</div> : null}
            </div>
          </section>
      </section>
    </AdminChrome>
  );
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function modelCapabilitySummary(value: unknown) {
  if (!value || typeof value !== "object") return "无能力信息";
  const record = value as { expressions?: unknown; motions?: unknown };
  const expressions = Array.isArray(record.expressions) ? record.expressions.length : 0;
  const motions = Array.isArray(record.motions) ? record.motions.length : 0;
  return `${expressions} 表情 · ${motions} 动作`;
}
