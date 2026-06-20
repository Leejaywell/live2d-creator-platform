import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { MobilePreview } from "@/components/mobile-preview";
import { ProjectCreateForm } from "@/components/project-create-form";
import { ShareLinkCopyButton } from "@/components/share-link-copy-button";
import { Pill } from "@/components/ui";
import { ensureCreatorPlan } from "@/lib/creator-onboarding";
import { getLanBaseUrl } from "@/lib/lan-url";
import { prisma } from "@/lib/prisma";
import { qrPngDataUrl } from "@/lib/qr";
import { usageWindowStart } from "@/lib/usage-analytics";

import {
  CreatorAuthRequired,
  CreatorShell,
  nextProjectStep,
  projectStatusLabel,
  projectStatusTone,
  creatorStyles as styles,
} from "../_components";

export const dynamic = "force-dynamic";

const COLS = "2.2fr 1.3fr 1fr 1fr 1fr auto";

export default async function CreatorModelsPage() {
  const t = await getTranslations("creator");
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title={t("authTitleModels")} />;
  }

  const [plan, projects, usageGroups] = await Promise.all([
    ensureCreatorPlan(session.user.id),
    prisma.project.findMany({
      where: { creatorId: session.user.id },
      include: {
        currentModelAsset: true,
        _count: { select: { triggerTags: true, fanAccessCodes: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.chatUsage.groupBy({
      by: ["projectId"],
      where: { creatorId: session.user.id, createdAt: { gte: usageWindowStart(30) } },
      _sum: { messageCount: true },
    }),
  ]);

  const maxModels = plan?.maxProjects ?? 1;
  const multiModel = maxModels > 1;

  // Single-model creators jump straight to their model's workspace (the demo page).
  // The list view is reserved for creators granted multi-model access by an admin.
  if (!multiModel && projects.length === 1) {
    redirect(`/creator/projects/${projects[0].id}`);
  }

  const canCreate = projects.length < maxModels;
  const usageByProject = new Map(usageGroups.map((g) => [g.projectId, g._sum.messageCount ?? 0]));

  const lanBase = getLanBaseUrl();
  const mobileByProject = new Map(
    await Promise.all(
      projects.map(async (project) => {
        const url = `${lanBase}/c/${project.slug}`;
        return [project.id, { url, qr: await qrPngDataUrl(url) }] as const;
      }),
    ),
  );

  return (
    <CreatorShell active="projects" user={session.user} planName={plan?.planName}>
      <div className={styles.pageHead}>
        <div>
          <h1>{multiModel ? t("titleModels") : t("titleMyModels")}</h1>
          <p className={styles.pageHeadSub}>
            {multiModel
              ? t("modelsCount", { used: projects.length, max: maxModels })
              : t("singleModelHint")}
          </p>
        </div>
        {multiModel ? (
          <div className={styles.toolbar}>
            <span className={styles.searchBox}>{t("searchPlaceholder")}</span>
          </div>
        ) : null}
      </div>

      {canCreate ? (
        <details className={`${styles.panel} ${styles.disclosure}`} open={projects.length === 0}>
          <summary>{t("createModel")}</summary>
          <div className={styles.formCard}>
            <ProjectCreateForm />
          </div>
        </details>
      ) : null}

      {projects.length === 0 ? (
        <div className={styles.empty}>{t("emptyModelsList")}</div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={`${styles.tableRow} ${styles.tableHead}`} style={{ gridTemplateColumns: COLS }}>
            <span>{t("colModel")}</span>
            <span>slug</span>
            <span>{t("colStatus")}</span>
            <span>{t("col30dChats")}</span>
            <span>{t("colFanCodes")}</span>
            <span />
          </div>
          {projects.map((project) => (
            <div key={project.id} className={styles.tableRow} style={{ gridTemplateColumns: COLS }}>
              <div className={styles.projectCell}>
                <div className={styles.projectAvatar} aria-hidden />
                <div className={styles.cellMain}>
                  <strong>{project.name}</strong>
                  <small>{t(nextProjectStep(project))}</small>
                </div>
              </div>
              <Link href={`/c/${project.slug}`} className={styles.monoTeal}>
                /c/{project.slug}
              </Link>
              <Pill tone={projectStatusTone(project.status)} dot={project.status === "published"}>
                {t(projectStatusLabel(project.status))}
              </Pill>
              <span className={styles.mono}>
                {usageByProject.has(project.id)
                  ? t("chatsCount", { count: usageByProject.get(project.id) ?? 0 })
                  : "—"}
              </span>
              <span className={styles.mono}>{t("fanCodesCount", { count: project._count.fanAccessCodes })}</span>
              <div className={styles.rowActions}>
                <MobilePreview
                  qr={mobileByProject.get(project.id)!.qr}
                  url={mobileByProject.get(project.id)!.url}
                  label={t("mobilePreview")}
                />
                <Link href={`/creator/projects/${project.id}`}>{t("actionEdit")}</Link>
                <Link href={`/creator/projects/${project.id}/fan-codes`}>{t("actionFanCodes")}</Link>
                <ShareLinkCopyButton path={`/c/${project.slug}`} />
                <details>
                  <summary className={styles.danger}>{t("actionDelete")}</summary>
                  <div className={styles.formCard}>
                    <ApiForm action={`/api/creator/projects/${project.id}`} method="DELETE" submitLabel={t("confirmDeleteModel")} submitVariant="danger">
                      <span className={styles.pageHeadSub}>
                        {t("deleteModelHint")}
                      </span>
                    </ApiForm>
                  </div>
                </details>
              </div>
            </div>
          ))}
        </div>
      )}
    </CreatorShell>
  );
}
