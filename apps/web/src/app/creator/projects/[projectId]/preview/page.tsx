import crypto from "node:crypto";

import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentSession } from "@/auth";
import { AudienceChat } from "@/components/audience-chat";
import { MobilePreview } from "@/components/mobile-preview";
import { getLanBaseUrl } from "@/lib/lan-url";
import { prisma } from "@/lib/prisma";
import { qrPngDataUrl } from "@/lib/qr";

import { CreatorAuthRequired } from "../../../_components";
import styles from "./preview.module.css";

export const dynamic = "force-dynamic";

export default async function CreatorProjectPreviewPage({ params }: PageProps<"/creator/projects/[projectId]/preview">) {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title="项目预览" />;
  }

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, creatorId: session.user.id },
    include: { triggerTags: { where: { enabled: true } }, currentModelAsset: true },
  });

  if (!project) {
    notFound();
  }

  // Mint a stable preview fan code + viewer session so the creator can test
  // chat and trigger effects without consuming a real code or publish gate.
  const codeHash = crypto.createHash("sha256").update(`PREVIEW-${projectId}`).digest("hex");
  const code =
    (await prisma.fanAccessCode.findUnique({ where: { codeHash } })) ??
    (await prisma.fanAccessCode.create({
      data: {
        projectId,
        codeHash,
        expiresAt: new Date("2099-12-31T23:59:59Z"),
        maxMessages: 9999,
        bindMode: "none",
        status: "active",
        batchId: "preview",
      },
    }));

  const deviceHash = "creator-preview";
  const viewerSession =
    (await prisma.viewerSession.findUnique({
      where: { fanAccessCodeId_deviceHash: { fanAccessCodeId: code.id, deviceHash } },
    })) ??
    (await prisma.viewerSession.create({
      data: { projectId, fanAccessCodeId: code.id, deviceHash },
    }));

  const mobileUrl = `${getLanBaseUrl()}/c/${project.slug}`;
  const mobileQr = await qrPngDataUrl(mobileUrl);

  return (
    <main>
      <div className={styles.banner}>
        <span className={styles.bannerDot} aria-hidden />
        创作者调试预览 · 不消耗配额、不受发布状态限制
        <Link href={`/creator/projects/${projectId}`} className={styles.bannerLink}>
          返回工作区 →
        </Link>
        <span style={{ marginLeft: "auto" }}>
          <MobilePreview qr={mobileQr} url={mobileUrl} label="手机预览" />
        </span>
      </div>
      <AudienceChat
        projectSlug={project.slug}
        projectName={project.name}
        intro={project.intro ?? ""}
        characterSetting={project.characterSetting ?? ""}
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
