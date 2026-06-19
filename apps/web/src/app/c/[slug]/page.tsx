import Link from "next/link";

import { AudienceChat } from "@/components/audience-chat";
import { findPublicAudienceProject } from "@/lib/public-projects";

import styles from "./audience.module.css";

export const dynamic = "force-dynamic";

export default async function AudiencePage({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const project = await findPublicAudienceProject(slug);

  if (!project) {
    return (
      <main className={styles.curtain}>
        <div className={styles.curtainCard}>
          <div className={styles.curtainIcon} aria-hidden>
            🎭
          </div>
          <h1>尚未开演</h1>
          <p>这位角色还在后台筹备中，或暂停了访问。敬请期待 TA 的登场。</p>
          <Link href="/" className={styles.curtainLink}>
            ← 返回角色广场
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AudienceChat
      projectSlug={project.slug}
      projectName={project.name}
      intro={project.intro ?? ""}
      theme={project.theme}
      avatarUrl={project.avatarUrl}
      backgroundUrl={project.backgroundUrl}
      welcomeMessage={project.welcomeMessage}
      hasLive2DModel={project.currentModelAsset?.validationStatus === "valid"}
      tagNames={project.triggerTags.map((tag) => tag.name)}
      voices={project.voiceAssets.map((voice) => ({
        name: voice.name,
        audioUrl: voice.audioUrl,
        tags: voice.triggerTags.map((tag) => tag.name),
      }))}
    />
  );
}
