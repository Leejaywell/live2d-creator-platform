import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getCurrentSession } from "@/auth";
import { getLanBaseUrl } from "@/lib/lan-url";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { qrPngDataUrl } from "@/lib/qr";
import { buildWorkspaceProject, ensurePreviewSession, workspaceProjectInclude } from "@/lib/workspace-data";

import { ProjectWorkspace } from "@/app/creator/projects/[projectId]/project-workspace";
import { AdminAuthRequired } from "@/app/admin/_components";

export const dynamic = "force-dynamic";

export default async function AdminProjectConfigPage({ params }: PageProps<"/admin/projects/[projectId]/config">) {
  const t = await getTranslations("admin");
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !hasPermission(session.user.role, "assets.assist")) {
    return <AdminAuthRequired />;
  }

  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: workspaceProjectInclude,
  });
  if (!project) {
    notFound();
  }

  const previewSessionId = await ensurePreviewSession(project.id);
  const workspace = buildWorkspaceProject(project);
  const mobileUrl = `${getLanBaseUrl()}/c/${project.slug}`;
  const mobilePreview = { url: mobileUrl, qr: await qrPngDataUrl(mobileUrl) };

  return (
    <ProjectWorkspace
      project={workspace}
      previewSessionId={previewSessionId}
      mobilePreview={mobilePreview}
      nav={{
        apiBase: `/api/admin/projects/${project.id}`,
        backHref: "/admin/projects",
        backLabel: t("backToProjects"),
        fanCodesHref: `/admin/projects/${project.id}/fan-codes`,
        previewHref: `/admin/projects/${project.id}/preview`,
        showAssist: false,
      }}
    />
  );
}
