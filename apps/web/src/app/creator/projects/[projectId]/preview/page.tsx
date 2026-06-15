import { notFound } from "next/navigation";
import crypto from "node:crypto";
import Link from "next/link";

import { getCurrentSession } from "@/auth";
import { AudienceChat } from "@/components/audience-chat";
import { prisma } from "@/lib/prisma";
import styles from "@/app/dashboard.module.css";

export const dynamic = "force-dynamic";

export default async function CreatorProjectPreviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return (
      <main className={styles.authShell}>
        <div className={styles.authCard}>
          <p className={styles.kicker}>STAGE DOOR</p>
          <h1>项目预览</h1>
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
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      creatorId: session.user.id,
    },
    include: {
      triggerTags: {
        where: { enabled: true },
      },
      currentModelAsset: true,
    },
  });

  if (!project) {
    notFound();
  }

  // Generate a preview FanAccessCode and ViewerSession
  const codeHash = crypto.createHash("sha256").update(`PREVIEW-${projectId}`).digest("hex");
  let code = await prisma.fanAccessCode.findUnique({
    where: { codeHash },
  });

  if (!code) {
    code = await prisma.fanAccessCode.create({
      data: {
        projectId,
        codeHash,
        expiresAt: new Date("2099-12-31T23:59:59Z"),
        maxMessages: 9999,
        bindMode: "none",
        status: "active",
        batchId: "preview",
      },
    });
  }

  const deviceHash = "creator-preview";
  let viewerSession = await prisma.viewerSession.findUnique({
    where: {
      fanAccessCodeId_deviceHash: {
        fanAccessCodeId: code.id,
        deviceHash,
      },
    },
  });

  if (!viewerSession) {
    viewerSession = await prisma.viewerSession.create({
      data: {
        projectId,
        fanAccessCodeId: code.id,
        deviceHash,
      },
    });
  }

  return (
    <main>
      <div style={{ padding: "8px 16px", background: "#f59e0b", color: "#000", fontSize: "12px", textAlign: "center", fontWeight: "bold" }}>
        ⚠️ 创作者调试模式：此页面的聊天和表情调用属于预览状态，不会限制项目发布状态。点击
        <Link href={`/creator/projects/${projectId}`} style={{ textDecoration: "underline", marginLeft: "6px", color: "#000" }}>
          返回项目设置
        </Link>
      </div>
      <AudienceChat
        projectSlug={project.slug}
        projectName={project.name}
        intro={project.intro ?? ""}
        theme={project.theme}
        avatarUrl={project.avatarUrl}
        backgroundUrl={project.backgroundUrl}
        welcomeMessage={project.welcomeMessage}
        hasLive2DModel={project.currentModelAsset?.validationStatus === "valid"}
        tagNames={project.triggerTags.map((tag) => tag.name)}
        initialViewerSessionId={viewerSession.id}
      />
    </main>
  );
}
