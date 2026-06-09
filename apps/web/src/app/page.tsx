import Link from "next/link";
import type { CSSProperties } from "react";

import { listPublicCompanionProjects } from "@/lib/public-projects";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = await listPublicCompanionProjects();

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">
          Live2D Creator
        </Link>
        <nav className={styles.nav} aria-label="Primary">
          <Link href="/creator">Creator</Link>
          <Link href="/admin">Admin</Link>
          <Link href="/sign-in">Sign in</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.label}>AI companion studio</p>
          <h1>Publish fan-gated Live2D companions with real-time chat.</h1>
          <p>
            Creators manage characters, access codes, voice requests, model assets,
            and usage from one workspace. Fans enter through private character pages.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="/creator">
              Open workspace
            </Link>
            {projects[0] ? (
              <Link className={styles.secondaryAction} href={`/c/${projects[0].slug}`}>
                View companion
              </Link>
            ) : (
              <Link className={styles.secondaryAction} href="/sign-in">
                Sign in
              </Link>
            )}
          </div>
        </div>

        <div className={styles.stagePreview} aria-label="Live2D companion preview">
          <div className={styles.previewHeader}>
            <span>{projects[0]?.name ?? "New companion"}</span>
            <strong>{projects.length} live</strong>
          </div>
          <div className={styles.avatarFrame} style={{ "--theme": projects[0]?.theme ?? "#0f766e" } as CSSProperties}>
            <div className={styles.avatarFace}>
              <span />
              <span />
            </div>
          </div>
          <div className={styles.previewChat}>
            <span>Fan code accepted</span>
            <p>{projects[0]?.intro ?? "Create the first published companion from the creator workspace."}</p>
          </div>
        </div>
      </section>

      <section className={styles.companions} aria-labelledby="companions-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.label}>Published</p>
            <h2 id="companions-title">Companions</h2>
          </div>
          <Link href="/creator">Manage projects</Link>
        </div>

        {projects.length ? (
          <div className={styles.projectGrid}>
            {projects.map((project) => (
              <article className={styles.projectCard} key={project.id}>
                <div className={styles.projectAccent} style={{ background: project.theme }} />
                <h3>{project.name}</h3>
                <p>{project.intro || "A published Live2D AI companion."}</p>
                <div className={styles.tags}>
                  {project.triggerTags.map((tag) => (
                    <span key={tag.id}>{tag.name}</span>
                  ))}
                </div>
                <Link href={`/c/${project.slug}`}>Open /c/{project.slug}</Link>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <strong>No published companions yet.</strong>
            <p>Create and publish a project from the creator workspace.</p>
            <Link href="/creator">Open workspace</Link>
          </div>
        )}
      </section>
    </main>
  );
}
