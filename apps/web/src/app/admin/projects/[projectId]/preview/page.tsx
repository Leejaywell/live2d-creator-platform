import crypto from "node:crypto";

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { getCurrentSession } from "@/auth";
import { AudienceChat } from "@/components/audience-chat";
import { MobilePreview } from "@/components/mobile-preview";
import { getLanBaseUrl } from "@/lib/lan-url";
import { isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { qrPngDataUrl } from "@/lib/qr";

import { AdminAuthRequired } from "../../../_components";
import styles from "../../../../creator/projects/[projectId]/preview/preview.module.css";

export const dynamic = "force-dynamic";

export default async function AdminProjectPreviewPage({ params }: PageProps<"/admin/projects/[projectId]/preview">) {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const t = await getTranslations("admin");
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { triggerTags: { where: { enabled: true } }, currentModelAsset: true },
  });

  if (!project) {
    notFound();
  }

  // Mint a stable admin preview fan code + viewer session so any admin can
  // inspect the model and chat without a real fan code, publish gate, or quota.
  const codeHash = crypto.createHash("sha256").update(`ADMIN-PREVIEW-${projectId}`).digest("hex");
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
        batchId: "admin-preview",
      },
    }));

  const deviceHash = "admin-preview";
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
        {t("previewBanner")}
        <Link href="/admin/projects" className={styles.bannerLink}>
          {t("backToReview")}
        </Link>
        <span style={{ marginLeft: "auto" }}>
          <MobilePreview qr={mobileQr} url={mobileUrl} label={t("mobilePreview")} />
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
