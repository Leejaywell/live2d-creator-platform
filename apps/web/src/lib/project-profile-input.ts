import { z } from "zod";

export const projectProfileSchema = z.object({
  name: z.string().max(200).optional(),
  slug: z.string().max(100).optional(),
  intro: z.string().max(2000).optional(),
  avatarUrl: z.string().max(500).optional(),
  backgroundUrl: z.string().max(500).optional(),
  systemPrompt: z.string().max(8000).optional(),
  characterSetting: z.string().max(8000).optional(),
  welcomeMessage: z.string().max(2000).optional(),
  theme: z.string().max(40).optional(),
});

type ProfileBody = z.infer<typeof projectProfileSchema>;

const nonEmpty = (v: string | undefined) => (v && v.length ? v : undefined);

/** Map a submitted profile form to updateProject input, matching the original
 * server action: empty text fields are no-ops, while clearable URL/character
 * fields become null when blank. */
export function toUpdateProjectInput(body: ProfileBody) {
  return {
    name: nonEmpty(body.name),
    slug: nonEmpty(body.slug),
    intro: nonEmpty(body.intro),
    avatarUrl: nonEmpty(body.avatarUrl) ?? null,
    backgroundUrl: nonEmpty(body.backgroundUrl) ?? null,
    systemPrompt: nonEmpty(body.systemPrompt),
    characterSetting: nonEmpty(body.characterSetting) ?? null,
    welcomeMessage: nonEmpty(body.welcomeMessage),
    theme: nonEmpty(body.theme),
  };
}
