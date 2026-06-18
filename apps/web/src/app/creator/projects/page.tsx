import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { ProjectCreateForm } from "@/components/project-create-form";
import { ShareLinkCopyButton } from "@/components/share-link-copy-button";
import { Pill } from "@/components/ui";
import { ensureCreatorPlan } from "@/lib/creator-onboarding";
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

export default async function CreatorModelsPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title="模型" />;
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

  return (
    <CreatorShell active="projects" user={session.user} planName={plan?.planName}>
      <div className={styles.pageHead}>
        <div>
          <h1>{multiModel ? "模型" : "我的模型"}</h1>
          <p className={styles.pageHeadSub}>
            {multiModel
              ? `${projects.length} / ${maxModels} 个模型`
              : "每个创作者默认拥有一个 Live2D 模型；如需更多请向管理员申请。"}
          </p>
        </div>
        {multiModel ? (
          <div className={styles.toolbar}>
            <span className={styles.searchBox}>🔍 搜索模型…</span>
          </div>
        ) : null}
      </div>

      {canCreate ? (
        <details className={`${styles.panel} ${styles.disclosure}`} open={projects.length === 0}>
          <summary>+ 创建模型</summary>
          <div className={styles.formCard}>
            <ProjectCreateForm />
          </div>
        </details>
      ) : null}

      {projects.length === 0 ? (
        <div className={styles.empty}>还没有模型。展开上方「创建模型」，从上传 Live2D 模型开始。</div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={`${styles.tableRow} ${styles.tableHead}`} style={{ gridTemplateColumns: COLS }}>
            <span>模型</span>
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
                <Link href={`/creator/projects/${project.id}/fan-codes`}>粉丝码</Link>
                <ShareLinkCopyButton path={`/c/${project.slug}`} />
                <details>
                  <summary className={styles.danger}>删除</summary>
                  <div className={styles.formCard}>
                    <ApiForm action={`/api/creator/projects/${project.id}`} method="DELETE" submitLabel="确认删除模型" submitVariant="danger">
                      <span className={styles.pageHeadSub}>
                        将删除该模型及其标签、粉丝码与聊天用量记录，操作不可恢复。
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
