import Link from "next/link";

import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { ProjectCreateForm } from "@/components/project-create-form";
import { ShareLinkCopyButton } from "@/components/share-link-copy-button";
import { Pill } from "@/components/ui";
import { prisma } from "@/lib/prisma";
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

export default async function CreatorProjectsPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title="角色项目" />;
  }

  const [projects, usageGroups] = await Promise.all([
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

  const usageByProject = new Map(usageGroups.map((g) => [g.projectId, g._sum.messageCount ?? 0]));

  return (
    <CreatorShell active="projects" user={session.user}>
      <div className={styles.pageHead}>
        <div>
          <h1>项目</h1>
          <p className={styles.pageHeadSub}>{projects.length} 个角色项目</p>
        </div>
        <div className={styles.toolbar}>
          <span className={styles.searchBox}>🔍 搜索项目…</span>
        </div>
      </div>

      <details className={`${styles.panel} ${styles.disclosure}`}>
        <summary>+ 新建角色项目</summary>
        <div className={styles.formCard}>
          <ProjectCreateForm />
        </div>
      </details>

      {projects.length === 0 ? (
        <div className={styles.empty}>还没有角色项目。展开上方「新建角色项目」，从上传 Live2D 模型开始。</div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={`${styles.tableRow} ${styles.tableHead}`} style={{ gridTemplateColumns: COLS }}>
            <span>角色</span>
            <span>slug</span>
            <span>状态</span>
            <span>30 天对话</span>
            <span>粉丝码</span>
            <span />
          </div>
          {projects.map((project) => (
            <div key={project.id} className={styles.tableRow} style={{ gridTemplateColumns: COLS }}>
              <div className={styles.projectCell}>
                <div className={styles.projectAvatar} aria-hidden />
                <div className={styles.cellMain}>
                  <strong>{project.name}</strong>
                  <small>{nextProjectStep(project)}</small>
                </div>
              </div>
              <Link href={`/c/${project.slug}`} className={styles.monoTeal}>
                /c/{project.slug}
              </Link>
              <Pill tone={projectStatusTone(project.status)} dot={project.status === "published"}>
                {projectStatusLabel(project.status)}
              </Pill>
              <span className={styles.mono}>
                {usageByProject.has(project.id) ? `${usageByProject.get(project.id)} 条` : "—"}
              </span>
              <span className={styles.mono}>{project._count.fanAccessCodes} 个</span>
              <div className={styles.rowActions}>
                <Link href={`/creator/projects/${project.id}`}>编辑</Link>
                <ShareLinkCopyButton path={`/c/${project.slug}`} />
                <details>
                  <summary className={styles.danger}>删除</summary>
                  <div className={styles.formCard}>
                    <ApiForm action={`/api/creator/projects/${project.id}`} method="DELETE" submitLabel="确认删除项目" submitVariant="danger">
                      <span className={styles.pageHeadSub}>
                        将删除该项目及其模型、标签、粉丝码与聊天用量记录，操作不可恢复。
                      </span>
                    </ApiForm>
                  </div>
                </details>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.newPrompt}>
        <span aria-hidden>🎭</span>
        还想新建一位角色？
        <Link href="#">展开上方表单，从上传 Live2D 模型开始 →</Link>
      </div>
    </CreatorShell>
  );
}
