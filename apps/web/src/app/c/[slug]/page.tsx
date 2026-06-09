import { notFound } from "next/navigation";
import Link from "next/link";

import styles from "@/app/dashboard.module.css";
import { AudienceChat } from "@/components/audience-chat";
import { findPublicAudienceProject } from "@/lib/public-projects";

export const dynamic = "force-dynamic";

export default async function AudiencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await findPublicAudienceProject(slug);

  if (!project) {
    notFound();
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1>{project.name}</h1>
          <p>{project.intro}</p>
        </div>
        <nav className={styles.nav}>
          <Link href="/">Platform</Link>
        </nav>
      </header>

      <section className={styles.twoColumn}>
        <div className={styles.panel}>
          <h2>Live2D Stage</h2>
          <div className={styles.live2dStage}>
            <div>
              <strong>{project.currentModelAsset?.validationStatus === "valid" ? "Authorized model ready" : "Model pending setup"}</strong>
              <p className={styles.muted}>
                {project.currentModelAsset?.modelJsonPath ?? "The chat panel loads the renderer after fan-code validation."}
              </p>
            </div>
          </div>
          <h2>Enabled Tags</h2>
          <ul className={styles.list}>
            {project.triggerTags.map((tag) => (
              <li className={styles.row} key={tag.id}>
                <strong>{tag.name}</strong>
                <span>{tag.description}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.panel}>
          <h2>Audience Chat and Live2D Renderer</h2>
          <AudienceChat
            projectSlug={project.slug}
            welcomeMessage={project.welcomeMessage}
            hasLive2DModel={project.currentModelAsset?.validationStatus === "valid"}
          />
        </div>
      </section>
    </main>
  );
}
