import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getCurrentSession } from "@/auth";
import { AdminReviewActions } from "@/components/admin-review-actions";
import { ApiForm } from "@/components/api-form";
import { Pill } from "@/components/ui";
import { hasPermission, isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { AdminAuthRequired, AdminShell, dash } from "../_components";

export const dynamic = "force-dynamic";

const REVIEW_COLS = "2.2fr 1.4fr 1fr 1fr auto";

function relativeTime(t: Awaited<ReturnType<typeof getTranslations<"admin">>>, date: Date) {
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return t("justNow");
  if (hours < 24) return t("hoursAgo", { hours });
  return t("daysAgo", { days: Math.floor(hours / 24) });
}

export default async function AdminProjectsPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const t = await getTranslations("admin");
  const role = session.user.role;
  const projects = await prisma.project.findMany({
    include: { creator: { include: { creatorProfile: true } }, currentModelAsset: true },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100,
  });

  const pendingCount = projects.filter((p) => p.status === "draft").length;
  const liveCount = projects.filter((p) => p.status === "published").length;
  const pausedCount = projects.filter((p) => p.status === "paused").length;

  const statusPill = (status: string) =>
    status === "published" ? (
      <Pill tone="live" dot>
        {t("statusLive")}
      </Pill>
    ) : status === "paused" ? (
      <Pill tone="danger">{t("statusRemoved")}</Pill>
    ) : (
      <Pill tone="amber">{t("statusDraft")}</Pill>
    );

  return (
    <AdminShell active="projects" user={session.user}>
      <div className={dash.pageHead}>
        <div>
          <h1>{t("projectsTitle")}</h1>
        </div>
        <div className={dash.toolbar} style={{ flexWrap: "wrap" }}>
          <Pill tone="amber">
            {t("statusDraft")} {pendingCount}
          </Pill>
          <Pill tone="neutral">
            {t("statusLive")} {liveCount}
          </Pill>
          <Pill tone="neutral">
            {t("statusRemoved")} {pausedCount}
          </Pill>
        </div>
      </div>

      <section className={dash.panel}>
        <div className={dash.tableWrap}>
          <div className={`${dash.tableRow} ${dash.tableHead}`} style={{ gridTemplateColumns: REVIEW_COLS }}>
            <span>{t("colRole")}</span>
            <span>{t("colCreator")}</span>
            <span>{t("colStatus")}</span>
            <span>{t("colSubmittedAt")}</span>
            <span>{t("colActions")}</span>
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
              <span className={dash.mono}>{relativeTime(t, project.updatedAt)}</span>
              <div className={dash.rowActions}>
                <Link href={`/admin/projects/${project.id}/preview`}>{t("previewModel")}</Link>
                <Link href={`/admin/projects/${project.id}/fan-codes`}>{t("fanCodesLink")}</Link>
                {hasPermission(role, "projects.pause") ? (
                  <AdminReviewActions projectId={project.id} status={project.status} />
                ) : (
                  <span className={dash.pageHeadSub}>{t("readOnly")}</span>
                )}
                {hasPermission(role, "assets.assist") ? (
                  <details>
                    <summary>{t("modelSummary")}</summary>
                    <div className={dash.formCard}>
                      <p className={dash.pageHeadSub} style={{ margin: "0 0 10px" }}>
                        {t("currentModel", {
                          status: project.currentModelAsset?.validationStatus ?? t("notUploaded"),
                        })}
                      </p>
                      <ApiForm action={`/api/admin/projects/${project.id}/model-assets`} submitLabel={t("uploadAssistModel")}>
                        <label>
                          {t("live2dZipLabel")}
                          <input name="file" type="file" accept=".zip" required />
                        </label>
                      </ApiForm>
                    </div>
                  </details>
                ) : null}
              </div>
            </div>
          ))}
          {projects.length === 0 && <div className={dash.empty}>{t("emptyProjects")}</div>}
        </div>
      </section>
    </AdminShell>
  );
}
