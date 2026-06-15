import Link from "next/link";

import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { ProjectCreateForm } from "@/components/project-create-form";
import { ShareLinkCopyButton } from "@/components/share-link-copy-button";
import { prisma } from "@/lib/prisma";

import { CreatorAuthRequired, CreatorChrome, nextProjectStep, projectStatusLabel } from "../_components";

export const dynamic = "force-dynamic";

export default async function CreatorProjectsPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title="角色项目" />;
  }

  const projects = await prisma.project.findMany({
    where: { creatorId: session.user.id },
    include: {
      currentModelAsset: true,
      triggerTags: true,
      fanAccessCodes: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  const hasModelSlot = projects.length > 0;

  return (
    <CreatorChrome active="projects" user={session.user}>
      <section className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>MODEL SLOT</p>
          <h2>我的角色模型</h2>
        </div>
        <div className={styles.sectionActions}>
          <span className={hasModelSlot ? `${styles.statusPill} ${styles.statusGood}` : `${styles.statusPill} ${styles.statusWarn}`}>
            {hasModelSlot ? "1/1 模型位已创建" : "0/1 模型位"}
          </span>
          {!hasModelSlot ? (
            <details className={styles.inlineAction}>
              <summary>创建角色模型</summary>
              <div>
                <ProjectCreateForm />
              </div>
            </details>
          ) : null}
        </div>
      </section>

      <section className={styles.panel}>
        <h2>模型槽位</h2>
        <div className={`${styles.dataTable} ${styles.cols5}`}>
          <div className={styles.dataHeader}>
            <span>角色</span>
            <span>状态</span>
            <span>当前模型</span>
            <span>下一步</span>
            <span>操作</span>
          </div>
          {projects.map((project) => (
            <div className={styles.dataRow} key={project.id}>
              <div className={styles.dataCell}>
                <strong>{project.name}</strong>
                <small>/c/{project.slug}</small>
              </div>
              <div className={styles.dataCell}>
                <span className={project.status === "published" ? `${styles.statusPill} ${styles.statusGood}` : project.status === "paused" ? `${styles.statusPill} ${styles.statusBad}` : `${styles.statusPill} ${styles.statusWarn}`}>
                  {projectStatusLabel(project.status)}
                </span>
              </div>
              <div className={styles.dataCell}>
                <strong>{project.currentModelAsset?.validationStatus ?? "未上传"}</strong>
                <small>{project.triggerTags.length} 标签 · {project.fanAccessCodes.length} 粉丝码</small>
              </div>
              <div className={styles.dataCell}>{nextProjectStep(project)}</div>
              <div className={`${styles.dataCell} ${styles.rowActions}`}>
                <Link href={`/creator/projects/${project.id}`}>管理</Link>
                <Link href={`/c/${project.slug}`}>观众页</Link>
                <ShareLinkCopyButton path={`/c/${project.slug}`} label="复制链接" />
                <details className={`${styles.collapse} ${styles.compactDetails}`}>
                  <summary>删除</summary>
                  <ApiForm action={`/api/creator/projects/${project.id}`} method="DELETE" submitLabel="确认删除项目">
                    <span className={styles.muted}>删除该项目及其模型、标签、粉丝码和聊天用量记录。</span>
                  </ApiForm>
                </details>
              </div>
            </div>
          ))}
          {!projects.length ? <div className={styles.emptyState}>还没有角色模型，点上方「创建角色模型」开始。</div> : null}
        </div>
      </section>
    </CreatorChrome>
  );
}
