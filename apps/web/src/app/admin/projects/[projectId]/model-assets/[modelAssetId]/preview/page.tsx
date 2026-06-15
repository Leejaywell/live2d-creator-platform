import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { Live2DViewer } from "@/components/live2d-viewer";
import { isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { AdminAuthRequired, AdminChrome } from "../../../../../_components";

export const dynamic = "force-dynamic";

export default async function AdminModelPreviewPage({ params }: PageProps<"/admin/projects/[projectId]/model-assets/[modelAssetId]/preview">) {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const { projectId, modelAssetId } = await params;
  const modelAsset = await prisma.modelAsset.findFirst({
    where: {
      id: modelAssetId,
      projectId,
      validationStatus: "valid",
    },
    include: {
      project: {
        include: {
          creator: true,
        },
      },
    },
  });
  if (!modelAsset) {
    notFound();
  }

  return (
    <AdminChrome active="projects" user={session.user}>
      <section className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>MODEL PREVIEW</p>
          <h2>{modelAsset.project.name}</h2>
        </div>
        <div className={styles.sectionActions}>
          <span className={styles.statusPill}>当前模型</span>
          <Link href="/admin/projects">返回项目交付</Link>
          <Link href={`/c/${modelAsset.project.slug}`}>观众页</Link>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <span>创作者</span>
            <strong>{modelAsset.project.creator.username ?? modelAsset.project.creator.id}</strong>
          </div>
          <div className={styles.metaItem}>
            <span>模型状态</span>
            <strong>{modelAsset.validationStatus}</strong>
          </div>
          <div className={styles.metaItem}>
            <span>模型记录</span>
            <strong>{modelAsset.id}</strong>
          </div>
        </div>
        <div className={styles.adminModelStage}>
          <Live2DViewer
            modelJsonUrl={`/api/admin/projects/${modelAsset.projectId}/model-assets/${modelAsset.id}/preview`}
            activeTags={[]}
            activeEffects={[]}
          />
        </div>
      </section>
    </AdminChrome>
  );
}
