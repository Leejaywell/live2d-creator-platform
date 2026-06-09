import Link from "next/link";

import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CreatorPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <AuthRequired title="Creator Workspace" />;
  }

  const [plan, projects] = await Promise.all([
    prisma.creatorPlan.findUnique({ where: { creatorId: session.user.id } }),
    prisma.project.findMany({
      where: { creatorId: session.user.id },
      include: {
        triggerTags: {
          include: {
            voiceAssets: {
              select: { id: true },
            },
          },
        },
        voiceAssets: true,
        fanAccessCodes: true,
        voiceCloneRequests: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1>Creator Workspace</h1>
          <p>{session.user.email}</p>
        </div>
        <nav className={styles.nav}>
          <Link href="/admin">Admin</Link>
          <Link href="/">Home</Link>
          <Link href="/api/auth/signout">Sign out</Link>
        </nav>
      </header>

      <section className={styles.grid}>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>Plan</span>
          <strong>{plan?.planName ?? "No active plan"}</strong>
          <p className={styles.muted}>{plan ? `Expires ${plan.expiresAt.toISOString().slice(0, 10)}` : "Ask an admin to open a plan."}</p>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>AI messages</span>
          <strong>{plan ? `${plan.usedAiMessages}/${plan.monthlyAiMessageLimit}` : "0/0"}</strong>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>Fan codes</span>
          <strong>{plan ? `${plan.usedFanCodes}/${plan.fanCodeQuota}` : "0/0"}</strong>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>Storage</span>
          <strong>{plan ? `${plan.usedStorageMb}/${plan.storageLimitMb} MB` : "0/0 MB"}</strong>
        </div>
      </section>

      <section className={styles.twoColumn}>
        <div className={styles.panel}>
          <h2>Projects</h2>
          <ul className={styles.list}>
            {projects.map((project) => (
              <li className={styles.row} key={project.id}>
                <strong>{project.name}</strong>
                <span>
                  /c/{project.slug} · {project.status} · {project.triggerTags.length} tags · {project.voiceAssets.length} voices ·{" "}
                  {project.fanAccessCodes.length} fan codes
                </span>
                <span>{project.intro}</span>
                <div className={styles.nav}>
                  <Link href={`/creator/projects/${project.id}`}>Manage</Link>
                  <Link href={`/c/${project.slug}`}>Audience page</Link>
                </div>
              </li>
            ))}
            {!projects.length ? <li className={styles.row}>No projects yet.</li> : null}
          </ul>
        </div>

        <div className={styles.forms}>
          <section className={styles.panel}>
            <h2>Create Project</h2>
            <ApiForm action="/api/creator/projects" submitLabel="Create project">
              <label>
                Name
                <input name="name" required />
              </label>
              <label>
                Slug
                <input name="slug" pattern="[a-z0-9-]+" required />
              </label>
              <label>
                Intro
                <textarea name="intro" />
              </label>
              <label>
                Avatar URL
                <input name="avatarUrl" type="url" />
              </label>
              <label>
                System prompt
                <textarea name="systemPrompt" required />
              </label>
              <label>
                Welcome message
                <input name="welcomeMessage" required />
              </label>
              <label>
                Theme
                <input name="theme" defaultValue="#0f766e" />
              </label>
            </ApiForm>
          </section>
        </div>
      </section>
    </main>
  );
}

function AuthRequired({ title }: { title: string }) {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1>{title}</h1>
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
