import { prisma } from "@/lib/prisma";
import { setTagVoicesData } from "@/lib/tag-voice-binding";

// Replaces a tag's voice bindings via the M2M relation, scoped to the owning
// creator/project so a creator can only bind their own voices to their own tags.
export async function bindVoicesToTag(input: {
  projectId: string;
  creatorId: string;
  tagId: string;
  voiceAssetIds: string[];
}) {
  return prisma.$transaction(async (tx) => {
    await tx.triggerTag.findFirstOrThrow({
      where: { id: input.tagId, project: { id: input.projectId, creatorId: input.creatorId } },
    });
    const uniqueIds = Array.from(new Set(input.voiceAssetIds));
    if (uniqueIds.length) {
      const owned = await tx.voiceAsset.count({
        where: { id: { in: uniqueIds }, projectId: input.projectId },
      });
      if (owned !== uniqueIds.length) {
        throw new Error("One or more voice assets do not belong to this project");
      }
    }
    return tx.triggerTag.update({
      where: { id: input.tagId },
      data: setTagVoicesData(uniqueIds),
    });
  });
}
