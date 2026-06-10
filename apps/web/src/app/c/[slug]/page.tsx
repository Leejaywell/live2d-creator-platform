import { notFound } from "next/navigation";

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
    <main>
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
      />
    </main>
  );
}
