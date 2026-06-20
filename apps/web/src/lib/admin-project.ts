import { prisma } from "@/lib/prisma";

/** Look up the owning creator of a project (admins act on behalf of the creator
 * when reusing the creator-scoped service functions). */
export async function projectCreatorId(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { creatorId: true },
  });
  return project.creatorId;
}
