import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { ProjectManagementForms } from "@/components/project-management-forms";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CreatorProjectPage({ params }: PageProps<"/creator/projects/[projectId]">) {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return (
      <main className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1>Project Management</h1>
            <p>Sign in with an active creator account to continue.</p>
          </div>
          <nav className={styles.nav}>
            <Link href="/sign-in">Sign in</Link>
            <Link href="/">Home</Link>
          </nav>
        </header>
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
  });

  if (!project) {
    notFound();
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1>{project.name}</h1>
          <p>
            /c/{project.slug} · {project.status}
          </p>
        </div>
        <nav className={styles.nav}>
          <Link href="/creator">Creator</Link>
          <Link href={`/c/${project.slug}`}>Audience page</Link>
          <Link href="/api/auth/signout">Sign out</Link>
        </nav>
      </header>

      <section className={styles.grid}>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>Current model</span>
          <strong>{project.currentModelAsset?.validationStatus ?? "none"}</strong>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>Fan codes</span>
          <strong>{project.fanAccessCodes.length}</strong>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>Clone requests</span>
          <strong>{project.voiceCloneRequests.length}</strong>
        </div>
      </section>

      <ProjectManagementForms project={project} />
    </main>
  );
}
