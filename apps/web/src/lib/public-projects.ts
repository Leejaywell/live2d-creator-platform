import { ProjectStatus, UserStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export function listPublicCompanionProjects() {
  return prisma.project.findMany({
    where: publicProjectWhere(),
    orderBy: { updatedAt: "desc" },
    take: 6,
    select: {
      id: true,
      name: true,
      slug: true,
      intro: true,
      theme: true,
      avatarUrl: true,
      triggerTags: {
        where: { enabled: true },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 3,
        select: { id: true, name: true },
      },
    },
  });
}

export function findPublicAudienceProject(slug: string) {
  return prisma.project.findFirst({
    where: publicProjectWhere(slug),
    include: {
      currentModelAsset: true,
      triggerTags: {
        where: { enabled: true },
        orderBy: { priority: "desc" },
      },
      voiceAssets: {
        where: { status: "active" },
      },
    },
  });
}

function publicProjectWhere(slug?: string) {
  return {
    ...(slug ? { slug } : {}),
    status: ProjectStatus.published,
    creator: { status: UserStatus.active },
  };
}
