import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getCurrentSession } from "@/auth";
import { AdminReviewActions } from "@/components/admin-review-actions";
import { MobilePreview } from "@/components/mobile-preview";
import { Pill } from "@/components/ui";
import { getLanBaseUrl } from "@/lib/lan-url";
import { hasPermission, isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { qrPngDataUrl } from "@/lib/qr";

import { AdminAuthRequired, AdminShell, dash } from "../_components";

export const dynamic = "force-dynamic";

// All-fr tracks (no content-sized `auto`) so the header and every row share
// identical column widths and line up. The last column holds a compact actions
// menu rather than a wide button cluster.
const REVIEW_COLS = "2.4fr 1.5fr 1.1fr 1fr 0.9fr";

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

  // Pre-render a per-character QR pointing at that character's ADMIN preview
  // (phone-scannable for testing — skips the fan-code gate; each character's URL
  // is distinct). The admin must be signed in on the scanning device.
  const lanBase = getLanBaseUrl();
  const mobileByProject = new Map(
    await Promise.all(
      projects.map(async (p) => {
        const url = `${lanBase}/admin/projects/${p.id}/preview`;
        return [p.id, { url, qr: await qrPngDataUrl(url) }] as const;
      }),
    ),
  );

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
            <span style={{ justifySelf: "end" }}>{t("colActions")}</span>
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
                <MobilePreview
                  qr={mobileByProject.get(project.id)!.qr}
                  url={mobileByProject.get(project.id)!.url}
                  label={t("mobilePreview")}
                />
                <details className={dash.rowMenu}>
                  <summary>{t("colActions")} ▾</summary>
                  <div className={dash.rowMenuPop}>
                    <Link href={`/admin/projects/${project.id}/preview`}>{t("previewModel")}</Link>
                    {project.currentModelAsset?.validationStatus === "valid" ? (
                      <a href={`/api/admin/projects/${project.id}/export-preview`} download>
                        {t("downloadLocalPreview")}
                      </a>
                    ) : null}
                    <Link href={`/admin/projects/${project.id}/fan-codes`}>{t("fanCodesLink")}</Link>
                    {hasPermission(role, "assets.assist") ? (
                      <Link href={`/admin/projects/${project.id}/config`}>{t("configLink")}</Link>
                    ) : null}
                    {hasPermission(role, "projects.pause") ? (
                      <AdminReviewActions projectId={project.id} status={project.status} />
                    ) : (
                      <span className={dash.pageHeadSub}>{t("readOnly")}</span>
                    )}
                  </div>
                </details>
              </div>
            </div>
          ))}
          {projects.length === 0 && <div className={dash.empty}>{t("emptyProjects")}</div>}
        </div>
      </section>
    </AdminShell>
  );
}
