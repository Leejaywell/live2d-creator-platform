import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { ProjectManagementForms } from "@/components/project-management-forms";
import { ShareLinkCopyButton } from "@/components/share-link-copy-button";
import { resolveModelAssistanceRequests } from "@/lib/model-assistance-requests";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { projectPublishReadiness } from "@/lib/project-readiness";
import { prisma } from "@/lib/prisma";
import { voiceCloneFulfillmentLabel } from "@/lib/voice-clone-status";

export const dynamic = "force-dynamic";

export default async function CreatorProjectPage({ params }: PageProps<"/creator/projects/[projectId]">) {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return (
      <main className={styles.authShell}>
        <div className={styles.authCard}>
          <p className={styles.kicker}>STAGE DOOR</p>
          <h1>项目管理</h1>
          <p>请使用有效的创作者账号登录后继续。</p>
          <div className={styles.authActions}>
            <Link href="/sign-in">去登录</Link>
            <Link href="/">回首页</Link>
          </div>
        </div>
      </main>
    );
  }

  const { projectId } = await params;
  const [project, modelAssistanceLogs, adminModelFulfillments, platformSettings] = await Promise.all([
    prisma.project.findFirst({
      where: {
        id: projectId,
        creatorId: session.user.id,
      },
      include: {
        triggerTags: {
          include: {
            voiceAssets: {
              select: { id: true },
            },
          },
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        },
        voiceAssets: {
          orderBy: { createdAt: "desc" },
        },
        fanAccessCodes: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        voiceCloneRequests: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        modelAssets: {
          orderBy: { version: "desc" },
          take: 5,
        },
        currentModelAsset: true,
      },
    }),
    prisma.auditLog.findMany({
      where: {
        actorUserId: session.user.id,
        targetId: projectId,
        action: "model_setup_assistance.requested",
      },
      include: { actor: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.modelAsset.findMany({
      where: {
        projectId,
        uploadedBy: "admin",
        validationStatus: "valid",
      },
      select: {
        id: true,
        projectId: true,
        version: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    getPlatformRuntimeSettings(),
  ]);

  if (!project) {
    notFound();
  }

  const readiness = [
    ...projectPublishReadiness(project),
    {
      title: "发布状态",
      detail: project.status === "published" ? "观众页已对外开放。" : "各项就绪后发布项目。",
      done: project.status === "published",
    },
  ];
  const readinessScore = readiness.filter((item) => item.done).length;
  const modelAssistanceRequests = resolveModelAssistanceRequests(modelAssistanceLogs, adminModelFulfillments);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>PROJECT</p>
          <h1>{project.name}</h1>
          <p>
            /c/{project.slug} · {projectStatusLabel(project.status)}
          </p>
        </div>
        <nav className={styles.nav}>
          <Link href="/creator">工作台</Link>
          <Link href={`/c/${project.slug}`}>观众页</Link>
          <Link href="/api/auth/signout">退出登录</Link>
        </nav>
      </header>

      <section className={styles.grid}>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>当前模型</span>
          <strong>{project.currentModelAsset?.validationStatus ?? "无"}</strong>
          <p className={styles.muted}>{project.currentModelAsset ? `版本 ${project.currentModelAsset.version}` : "还没有可用的模型版本。"}</p>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>粉丝码</span>
          <strong>{project.fanAccessCodes.length}</strong>
          <p className={styles.muted}>本页展示最近的访问码。</p>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>声音克隆请求</span>
          <strong>{project.voiceCloneRequests.length}</strong>
          <p className={styles.muted}>当前模式:{voiceCloneFulfillmentLabel(platformSettings.voiceCloningFulfillment)}。</p>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>发布就绪度</span>
          <strong>
            {readinessScore}/{readiness.length}
          </strong>
          <div className={styles.progress} aria-label={`${readiness.length} 项就绪检查完成 ${readinessScore} 项`}>
            <span style={{ width: `${(readinessScore / readiness.length) * 100}%` }} />
          </div>
        </div>
      </section>

      <section className={styles.twoColumn}>
        <div className={styles.panel}>
          <h2>发布就绪清单</h2>
          <ul className={styles.checklist}>
            {readiness.map((item) => (
              <li className={styles.checkItem} key={item.title}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <span className={item.done ? `${styles.statusPill} ${styles.statusGood}` : `${styles.statusPill} ${styles.statusWarn}`}>
                  {item.done ? "就绪" : "待处理"}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.panel}>
          <h2>分享入口</h2>
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span>观众页地址</span>
              <strong>/c/{project.slug}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>状态</span>
              <strong className={project.status === "published" ? styles.statusGoodText : project.status === "paused" ? styles.statusBadText : styles.statusWarnText}>
                {projectStatusLabel(project.status)}
              </strong>
            </div>
          </div>
          <p className={styles.muted}>{nextSetupAction(readiness)}</p>
          <div className={styles.nav}>
            <Link href={`/c/${project.slug}`}>打开观众页</Link>
            <ShareLinkCopyButton path={`/c/${project.slug}`} label="复制分享链接" />
            <Link href="/creator">返回工作台</Link>
          </div>
        </div>
      </section>

      <ProjectManagementForms project={{ ...project, modelAssistanceRequests }} voiceCloneFulfillment={platformSettings.voiceCloningFulfillment} />
    </main>
  );
}

function projectStatusLabel(status: string) {
  if (status === "published") return "上演中";
  if (status === "paused") return "已暂停";
  return "草稿";
}

function nextSetupAction(readiness: Array<{ title: string; detail: string; done: boolean }>) {
  const next = readiness.find((item) => !item.done);
  return next ? `下一步:${next.detail}` : "已就绪,随时可以分享给粉丝。";
}
