// Shared stage background presets used by the landing showcase and the real
// Live2D viewer (audience + creator preview) so all three stay in sync.
// labelKey resolves against each surface's i18n namespace (keys bgLabel0..5).
export type StageBackground = { labelKey: string; css: string };

export const STAGE_BACKGROUNDS: StageBackground[] = [
  {
    labelKey: "bgLabel0",
    css: "radial-gradient(62% 52% at 50% 16%, rgba(255,108,158,0.34), transparent 70%), linear-gradient(180deg, #1c1424, #0c0a14)",
  },
  { labelKey: "bgLabel1", css: "linear-gradient(180deg, #f6a06b 0%, #c56b9c 46%, #3a2a4a 100%)" },
  { labelKey: "bgLabel2", css: "radial-gradient(90% 60% at 50% 0%, #2b3066, #0b0a1a 72%)" },
  { labelKey: "bgLabel3", css: "linear-gradient(180deg, #ffd6e6 0%, #e7a3c6 48%, #5f4560 100%)" },
  {
    labelKey: "bgLabel4",
    css: "radial-gradient(70% 60% at 50% 20%, rgba(111,231,218,0.3), transparent 70%), linear-gradient(180deg, #14201f, #0c0a14)",
  },
  { labelKey: "bgLabel5", css: "linear-gradient(180deg, #1b1b22, #0e0c15)" },
];
