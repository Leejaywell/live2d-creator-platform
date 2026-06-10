import { ProjectStatus } from "@prisma/client";

export function assertFanCodeCanUnlockProject(project: { status: ProjectStatus | string }) {
  if (project.status !== ProjectStatus.published) {
    throw new Error("Project is not published");
  }
}
