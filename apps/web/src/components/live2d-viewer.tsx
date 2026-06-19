"use client";

import { useTranslations } from "next-intl";
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";

import { Live2DControls, type ControlPanel } from "@/components/live2d-controls";
import { Button } from "@/components/ui";
import { STAGE_BACKGROUNDS } from "@/lib/stage-backgrounds";

import styles from "./live2d-viewer.module.css";

export type Live2DEffect = { tag: string; params: Array<{ id: string; value: number }> };

export type Live2DVoice = { name: string; audioUrl?: string; tags?: string[] };

type Props = {
  projectSlug: string;
  viewerSessionId?: string;
  activeTags: string[];
  activeEffects: Live2DEffect[];
  isSpeaking: boolean;
  voices?: Live2DVoice[];
  backgroundUrl?: string | null;
  /** Shown as the greeting subtitle when the model finishes loading. */
  welcomeMessage?: string;
};

// Self-hosted runtime — PixiJS + Live2D Cubism Core + pixi-live2d-display (cubism4
// bundle). Vendored under /public so model rendering never depends on a CDN.
const SCRIPTS = [
  "/vendor/pixi-7.4.2.min.js",
  "/live2dcubismcore.min.js",
  "/vendor/pixi-live2d-cubism4-0.4.0.min.js",
];

type CoreModel = { setParameterValueById(id: string, value: number): void };
type MotionManager = { definitions?: Record<string, unknown[]>; motionGroups?: Record<string, unknown[]> };
type MotionDef = { File?: string; file?: string };
type InternalModel = {
  coreModel?: CoreModel;
  motionManager?: MotionManager;
  eyeBlink?: unknown;
  physics?: unknown;
  settings?: { expressions?: Array<{ Name?: string; name?: string }>; motions?: Record<string, MotionDef[]> };
};
type Bounds = { x: number; y: number; width: number; height: number };
type Live2DModelInstance = {
  scale: { set(x: number, y?: number): void };
  position: { set(x: number, y: number): void };
  anchor: { set(x: number, y: number): void };
  width: number;
  height: number;
  internalModel?: InternalModel;
  motion?: (group: string, index?: number) => void;
  expression?: (name?: string) => void;
  focus?: (x: number, y: number) => void;
  hitTest?: (x: number, y: number) => string[];
  getBounds?: () => Bounds;
  destroy(): void;
};
type PixiApp = {
  stage: { addChild(child: unknown): void };
  renderer: { width: number; height: number };
  destroy(removeView?: boolean, options?: { children?: boolean }): void;
};
type Live2DWindow = {
  PIXI?: {
    Application: new (options: Record<string, unknown>) => PixiApp;
    live2d?: { Live2DModel: { from(url: string): Promise<Live2DModelInstance> } };
  };
};

const scriptCache = new Map<string, Promise<void>>();

function loadScript(src: string) {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const cached = scriptCache.get(src);
  if (cached) return cached;
  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
      if (existing.dataset.loaded === "true") resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(script);
  });
  scriptCache.set(src, promise);
  return promise;
}

export function Live2DViewer({
  projectSlug,
  viewerSessionId,
  activeEffects,
  isSpeaking,
  voices = [],
  backgroundUrl,
  welcomeMessage,
}: Props) {
  const t = useTranslations("audience");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PixiApp | null>(null);
  const modelRef = useRef<Live2DModelInstance | null>(null);
  const baseScaleRef = useRef(0.2);
  const eyeBlinkRef = useRef<unknown>(undefined);
  const physicsRef = useRef<unknown>(undefined);
  const gazeRef = useRef(true);
  const tapIdx = useRef(0);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const subtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest props the imperative tap-reaction handler needs, kept in refs so the
  // pointer callbacks stay stable and never read stale closures.
  const voicesRef = useRef<Live2DVoice[]>(voices);
  const welcomeRef = useRef<string | undefined>(welcomeMessage);
  useEffect(() => {
    voicesRef.current = voices;
    welcomeRef.current = welcomeMessage;
  }, [voices, welcomeMessage]);

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [motionGroups, setMotionGroups] = useState<string[]>([]);
  const [expressions, setExpressions] = useState<string[]>([]);
  const [subtitle, setSubtitle] = useState<{ title: string; text: string } | null>(null);
  const [bgmOn, setBgmOn] = useState(false);

  // Model-setting controls (parity with the landing showcase).
  const [scaleMul, setScaleMul] = useState(1);
  const [posOff, setPosOff] = useState(0);
  const [flip, setFlip] = useState(false);
  const [gaze, setGaze] = useState(true);
  const [blink, setBlink] = useState(true);
  const [physics, setPhysics] = useState(true);
  const [idle, setIdle] = useState(true);
  const [lipSync, setLipSync] = useState(true);
  const [bgIdx, setBgIdx] = useState(0);

  // Background options: the creator's uploaded background (if any) first, then
  // the shared stage presets — same set as the landing showcase.
  const bgOptions = [
    ...(backgroundUrl ? [{ kind: "image" as const, url: backgroundUrl }] : []),
    ...STAGE_BACKGROUNDS.map((b) => ({ kind: "preset" as const, css: b.css, labelKey: b.labelKey })),
  ];
  const currentBg = bgOptions[bgIdx] ?? bgOptions[0];

  // Show a speech-bubble subtitle for a few seconds (auto-clears, or on audio end).
  const showSubtitle = useCallback((title: string, text: string) => {
    if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
    setSubtitle({ title, text });
    subtitleTimerRef.current = setTimeout(() => setSubtitle(null), 6000);
  }, []);

  // Play a project voice line. Optionally surface a subtitle (title + the voice
  // name, since VoiceAssets carry no transcript text).
  const playVoice = useCallback((voice?: Live2DVoice, subtitleTitle?: string) => {
    if (subtitleTitle) showSubtitle(subtitleTitle, voice?.name ?? "");
    if (!voice?.audioUrl) return;
    voiceAudioRef.current?.pause();
    const audio = new Audio(voice.audioUrl);
    voiceAudioRef.current = audio;
    audio.onended = () => setSubtitle(null);
    void audio.play().catch(() => {});
  }, [showSubtitle]);

  // Drive a motion that best matches a named reaction (e.g. "touch_head"),
  // falling back to a tap-cycled motion when the model has no named group.
  const playReactionMotion = useCallback((motionName: string) => {
    const model = modelRef.current;
    if (!model) return;
    const motions = model.internalModel?.settings?.motions;
    if (motions) {
      for (const [group, list] of Object.entries(motions)) {
        const index = list.findIndex((m) => (m.File ?? m.file ?? "").includes(motionName));
        if (index !== -1) {
          model.motion?.(group, index);
          return;
        }
      }
    }
    model.motion?.("", tapIdx.current++ % 4);
  }, []);

  // Pick a project voice whose bound trigger tag matches the reaction keyword;
  // otherwise any voice at random. Returns undefined when the project has none.
  const voiceForReaction = useCallback((keyword: string): Live2DVoice | undefined => {
    const list = voicesRef.current;
    if (list.length === 0) return undefined;
    const matched = list.find((v) => v.tags?.some((tag) => tag.includes(keyword) || keyword.includes(tag)));
    return matched ?? list[Math.floor(Math.random() * list.length)];
  }, []);

  // Map a tapped hit-area to a reaction: motion + voice + subtitle.
  const reactToArea = useCallback(
    (areas: string[]) => {
      const has = (k: string) => areas.some((a) => a.toLowerCase().includes(k));
      let motion = "touch_body";
      let keyword = "touch";
      let title = t("reactTouchBody");
      if (has("special")) {
        [motion, keyword, title] = ["touch_special", "special", t("reactTouchSpecial")];
      } else if (has("head")) {
        [motion, keyword, title] = ["touch_head", "head", t("reactTouchHead")];
      } else if (has("body")) {
        [motion, keyword, title] = ["touch_body", "body", t("reactTouchBody")];
      }
      playReactionMotion(motion);
      playVoice(voiceForReaction(keyword), title);
    },
    [t, playReactionMotion, playVoice, voiceForReaction],
  );

  const init = useCallback(async () => {
    try {
      for (const src of SCRIPTS) {
        await loadScript(src);
      }
      const w = window as unknown as Live2DWindow;
      const PIXI = w.PIXI;
      const Live2DModel = PIXI?.live2d?.Live2DModel;
      const canvas = canvasRef.current;
      if (!PIXI || !Live2DModel || !canvas) throw new Error("Live2D runtime unavailable");

      const app = new PIXI.Application({
        view: canvas,
        autoStart: true,
        backgroundAlpha: 0,
        resizeTo: canvas.parentElement ?? undefined,
        antialias: true,
      });
      appRef.current = app;

      const manifestUrl = `/api/assets/live2d-model?projectSlug=${encodeURIComponent(projectSlug)}${
        viewerSessionId ? `&viewerSessionId=${encodeURIComponent(viewerSessionId)}` : ""
      }`;
      const model = await Live2DModel.from(manifestUrl);
      modelRef.current = model;

      model.anchor.set(0.5, 0.5);
      const { width, height } = app.renderer;
      const base = Math.min(width / (model.width || width), height / (model.height || height)) * 0.9 || 0.2;
      baseScaleRef.current = base;
      model.scale.set(base, base);
      model.position.set(width / 2, height / 2);
      app.stage.addChild(model);

      const im = model.internalModel;
      eyeBlinkRef.current = im?.eyeBlink;
      physicsRef.current = im?.physics;
      const mm = im?.motionManager;
      const defs = mm?.definitions ?? mm?.motionGroups;
      setMotionGroups(defs ? Object.keys(defs) : []);
      setExpressions((im?.settings?.expressions ?? []).map((e, i) => e.Name ?? e.name ?? t("expressionN", { n: i + 1 })));
      setPhase("ready");
    } catch (error) {
      console.error("Live2D init failed", error);
      setPhase("error");
    }
  }, [projectSlug, viewerSessionId, t]);

  useEffect(() => {
    // init() only setStates after awaiting CDN + model load (no sync cascade).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    init();
    return () => {
      modelRef.current?.destroy();
      modelRef.current = null;
      appRef.current?.destroy(false, { children: true });
      appRef.current = null;
    };
  }, [init, attempt]);

  // Triggered Live2D parameters from chat tags.
  useEffect(() => {
    const core = modelRef.current?.internalModel?.coreModel;
    if (!core) return;
    for (const effect of activeEffects) {
      for (const param of effect.params) {
        try {
          core.setParameterValueById(param.id, param.value);
        } catch {
          // unknown parameter id — ignore
        }
      }
    }
  }, [activeEffects]);

  // Transform: scale / horizontal flip / vertical offset.
  useEffect(() => {
    const model = modelRef.current;
    const app = appRef.current;
    if (phase !== "ready" || !model || !app) return;
    const s = baseScaleRef.current * scaleMul;
    model.scale.set(flip ? -s : s, s);
    model.position.set(app.renderer.width / 2, app.renderer.height / 2 + posOff);
  }, [phase, scaleMul, flip, posOff]);

  // Auto-blink / physics toggles.
  useEffect(() => {
    if (phase !== "ready") return;
    const im = modelRef.current?.internalModel;
    if (im) im.eyeBlink = blink ? eyeBlinkRef.current : undefined;
  }, [phase, blink]);
  useEffect(() => {
    if (phase !== "ready") return;
    const im = modelRef.current?.internalModel;
    if (im) im.physics = physics ? physicsRef.current : undefined;
  }, [phase, physics]);

  useEffect(() => {
    gazeRef.current = gaze;
  }, [gaze]);

  // Idle: play a motion periodically when nothing else is happening.
  useEffect(() => {
    if (phase !== "ready" || !idle) return;
    const id = setInterval(() => modelRef.current?.motion?.("", 0), 9000);
    return () => clearInterval(id);
  }, [phase, idle]);

  // Lip-sync mouth motion while speaking.
  useEffect(() => {
    if (!isSpeaking || !lipSync) return;
    let raf = 0;
    const animate = () => {
      const core = modelRef.current?.internalModel?.coreModel;
      try {
        core?.setParameterValueById("ParamMouthOpenY", 0.5 + 0.5 * Math.sin(Date.now() / 120));
      } catch {
        // ignore
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [isSpeaking, lipSync]);

  // Greeting: once the model is ready, play a login/home motion and the project's
  // first voice line, with the welcome message as the on-screen subtitle.
  useEffect(() => {
    if (phase !== "ready") return;
    const timer = setTimeout(() => {
      playReactionMotion("login");
      const first = voicesRef.current[0];
      const greeting = welcomeRef.current;
      if (greeting) showSubtitle(t("reactGreeting"), greeting);
      if (first?.audioUrl) playVoice(first);
    }, 800);
    return () => clearTimeout(timer);
  }, [phase, playReactionMotion, playVoice, showSubtitle, t]);

  // Background music — looped ambient track, gated behind a user toggle so it
  // never autoplays (browsers block that anyway).
  useEffect(() => {
    const player = bgmRef.current;
    if (!player) return;
    if (bgmOn) void player.play().catch(() => {});
    else player.pause();
  }, [bgmOn]);

  // Clear any pending subtitle timer on unmount.
  useEffect(() => () => {
    if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const model = modelRef.current;
    const canvas = canvasRef.current;
    if (!model?.focus || !canvas || !gazeRef.current) return;
    const rect = canvas.getBoundingClientRect();
    model.focus(e.clientX - rect.left, e.clientY - rect.top);
  }, []);

  // Tap reaction: hit-test the tapped point against the model's named areas
  // (head / body / special) and react with motion + voice + subtitle. pixi-live2d
  // -display 0.4's built-in hit event relies on Pixi 6's InteractionManager, which
  // Pixi 7 removed, so we hit-test manually on pointer down (mouse + touch alike).
  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      const model = modelRef.current;
      const canvas = canvasRef.current;
      if (!model || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const hits = model.hitTest?.(x, y) ?? [];
      if (hits.length > 0) {
        reactToArea(hits);
        return;
      }
      // No named area hit — if the tap still landed on the silhouette, react as a
      // body touch; otherwise just cycle a tap motion.
      const bounds = model.getBounds?.();
      if (bounds && x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height) {
        reactToArea([]);
      } else {
        model.motion?.("", tapIdx.current++ % 4);
      }
    },
    [reactToArea],
  );

  const motionNames = motionGroups.length ? motionGroups : [""];
  const panels: ControlPanel[] = [
    {
      key: "act",
      title: t("panelActTitle"),
      icon: "act",
      sections: [
        {
          title: t("sectionPose"),
          items: motionNames.map((g, i) => ({
            label: g || t("motionN", { n: i + 1 }),
            onSelect: () => modelRef.current?.motion?.(g, g ? undefined : i),
          })),
        },
        {
          // A single uploaded model has no alternate costume data, so its
          // expressions are the closest "look / skin" the viewer can offer.
          title: t("sectionSkin"),
          items: expressions.map((name) => ({ label: name, onSelect: () => modelRef.current?.expression?.(name) })),
        },
      ],
    },
    {
      key: "voice",
      title: t("panelVoiceTitle"),
      icon: "voice",
      sections: [
        {
          title: t("sectionPresetVoice"),
          items: voices.map((v) => ({
            label: v.name,
            onSelect: () => playVoice(v, v.name),
          })),
        },
        {
          title: t("sectionAmbience"),
          items: [
            { label: t("randomInteract"), onSelect: () => reactToArea([]) },
            { label: `${t("bgm")} · ${bgmOn ? t("on") : t("off")}`, active: bgmOn, onSelect: () => setBgmOn((v) => !v) },
          ],
        },
      ],
    },
    {
      key: "settings",
      title: t("panelSettingsTitle"),
      icon: "settings",
      sections: [
        {
          title: t("sectionScale"),
          items: [
            { label: t("scaleUp"), active: scaleMul > 1, onSelect: () => setScaleMul(1.25) },
            { label: t("scaleNormal"), active: scaleMul === 1, onSelect: () => setScaleMul(1) },
            { label: t("scaleDown"), active: scaleMul < 1, onSelect: () => setScaleMul(0.8) },
          ],
        },
        {
          title: t("sectionPosition"),
          items: [
            { label: t("moveUp"), active: posOff < 0, onSelect: () => setPosOff(-40) },
            { label: t("center"), active: posOff === 0, onSelect: () => setPosOff(0) },
            { label: t("moveDown"), active: posOff > 0, onSelect: () => setPosOff(40) },
            { label: t("mirror"), active: flip, onSelect: () => setFlip((v) => !v) },
          ],
        },
        {
          title: t("sectionDynamic"),
          items: [
            { label: `${t("gaze")} · ${gaze ? t("on") : t("off")}`, active: gaze, onSelect: () => setGaze((v) => !v) },
            { label: `${t("blink")} · ${blink ? t("on") : t("off")}`, active: blink, onSelect: () => setBlink((v) => !v) },
            { label: `${t("physics")} · ${physics ? t("on") : t("off")}`, active: physics, onSelect: () => setPhysics((v) => !v) },
            { label: `${t("idle")} · ${idle ? t("on") : t("off")}`, active: idle, onSelect: () => setIdle((v) => !v) },
            { label: `${t("lipSync")} · ${lipSync ? t("on") : t("off")}`, active: lipSync, onSelect: () => setLipSync((v) => !v) },
          ],
        },
        {
          title: t("sectionBackground"),
          items: bgOptions.map((b, i) => ({
            label: b.kind === "image" ? t("creatorBackground") : t(b.labelKey),
            active: bgIdx === i,
            onSelect: () => setBgIdx(i),
          })),
        },
        {
          title: t("sectionOps"),
          items: [
            { label: t("randomMotion"), onSelect: () => modelRef.current?.motion?.("", Math.floor(Math.random() * 4)) },
            {
              label: t("resetAll"),
              onSelect: () => {
                setScaleMul(1);
                setPosOff(0);
                setFlip(false);
                setGaze(true);
                setBlink(true);
                setPhysics(true);
                setIdle(true);
                setLipSync(true);
                setBgIdx(0);
              },
            },
          ],
        },
      ],
    },
  ];

  return (
    <div className={styles.root} onPointerMove={onPointerMove} onPointerDown={onPointerDown}>
      <div
        className={styles.bg}
        aria-hidden
        style={
          currentBg?.kind === "image"
            ? { backgroundImage: `url(${currentBg.url})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: currentBg?.css }
        }
      />
      <canvas ref={canvasRef} className={`${styles.canvas} ${phase === "ready" ? styles.canvasReady : ""}`} />
      {phase === "ready" && subtitle ? (
        <div className={styles.subtitle} aria-live="polite">
          <span className={styles.subtitleTitle}>⚓ {subtitle.title}</span>
          {subtitle.text ? <span className={styles.subtitleText}>{subtitle.text}</span> : null}
        </div>
      ) : null}
      {phase === "ready" ? <Live2DControls panels={panels} /> : null}
      {/* Self-hosted looped ambient track; never autoplays (toggle-gated). */}
      <audio ref={bgmRef} loop preload="none" src="/audio/ambient.ogg" />
      {phase === "loading" ? (
        <div className={styles.status}>
          <div className={styles.spinner} aria-hidden />
          <span className={styles.statusText}>{t("stageLoading")}</span>
        </div>
      ) : null}
      {phase === "error" ? (
        <div className={`${styles.status} ${styles.error}`}>
          <div className={styles.slot}>
            LIVE2D
            <br />
            {t("loadFailed")}
          </div>
          <span className={styles.statusText}>{t("loadFailedDetail")}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={styles.retry}
            onClick={() => {
              setPhase("loading");
              setAttempt((n) => n + 1);
            }}
          >
            {t("retry")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
