"use client";

import { useTranslations } from "next-intl";
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";

import { Live2DStageControls } from "@/components/live2d-stage-controls";
import { Button } from "@/components/ui";
import { motionLabel } from "@/lib/live2d-motion-names";
import { STAGE_BACKGROUNDS } from "@/lib/stage-backgrounds";

import styles from "./live2d-viewer.module.css";

export type Live2DEffect = { tag: string; params: Array<{ id: string; value: number }>; expression?: string };

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
  renderer: { width: number; height: number; resize(width: number, height: number): void };
  view: HTMLCanvasElement;
  destroy(removeView?: boolean, options?: { children?: boolean }): void;
};
type Cubism4InternalModelCtor = {
  prototype: {
    updateWebGLContext: (
      this: { renderer?: { _clippingManager?: unknown } },
      gl: unknown,
      glContextID: unknown,
    ) => void;
  };
};
type Live2DWindow = {
  Live2DCubismCore?: { Memory?: { initializeAmountOfMemory(size: number): void } };
  PIXI?: {
    Application: new (options: Record<string, unknown>) => PixiApp;
    Ticker: unknown;
    live2d?: {
      Live2DModel: { from(url: string): Promise<Live2DModelInstance>; registerTicker(ticker: unknown): void };
      Cubism4InternalModel?: Cubism4InternalModelCtor;
    };
  };
};

// Pet float is a square window; the model sits in the centered column and the
// control buttons sit in the side gaps (outside the model). Keep in sync with
// .petFloat in the stylesheet.
const PET_FLOAT_SIZE = 400;

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
  // React owns this host <div> only — Pixi creates and owns the real <canvas>
  // inside it. Destroying the Pixi app then never touches a React-managed node,
  // avoiding removeChild crashes and stale-WebGL-context reuse under StrictMode.
  const stageHostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PixiApp | null>(null);
  const modelRef = useRef<Live2DModelInstance | null>(null);
  // Monotonic token guarding the async init() against StrictMode double-mounts.
  const runIdRef = useRef(0);
  const baseScaleRef = useRef(0.2);
  // The model's intrinsic (unscaled) size, captured once. Refitting must divide
  // the host size by THIS — not model.width, which is already scaled and would
  // compound the zoom on every resize.
  const naturalRef = useRef({ w: 0, h: 0 });
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
  // Every individual motion (group + index + label), so the panel lists each
  // motion like the landing demo — not just one button per motion group.
  const [motionList, setMotionList] = useState<Array<{ group: string; index: number; label: string }>>([]);
  const [expressions, setExpressions] = useState<string[]>([]);
  const [subtitle, setSubtitle] = useState<{ title: string; text: string } | null>(null);
  const [bgmOn, setBgmOn] = useState(false);

  // Model-setting controls, exposed via the dock's "设置" tab.
  const [scaleMul, setScaleMul] = useState(1);
  const [posOff, setPosOff] = useState(0);
  const [flip, setFlip] = useState(false);
  const [gaze, setGaze] = useState(true);
  const [blink, setBlink] = useState(true);
  const [physics, setPhysics] = useState(true);
  const [idle, setIdle] = useState(true);
  const [lipSync, setLipSync] = useState(true);
  // Auto-perform toggles: when on, the model periodically plays a random
  // motion / expression / voice while idle. When off, it stays put and the
  // creator/fan drives it manually from the motion & expression lists.
  const [randomMotion, setRandomMotion] = useState(true);
  const [randomExpr, setRandomExpr] = useState(true);
  const [randomVoice, setRandomVoice] = useState(true);
  const [bgIdx, setBgIdx] = useState(0);
  const [voiceVolume, setVoiceVolume] = useState(1);
  const voiceVolumeRef = useRef(1);
  // Desktop-pet mode: float the whole viewer as a small draggable window.
  const [petMode, setPetMode] = useState(false);
  // Mobile uses the pet-style side-column controls (no bottom dock, no actual
  // desktop-pet toggle) so the buttons sit at the screen edges, clear of the
  // bottom chat sheet.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const [petPos, setPetPos] = useState<{ x: number; y: number }>(() =>
    typeof window !== "undefined"
      ? { x: Math.max(8, Math.round((window.innerWidth - PET_FLOAT_SIZE) / 2)), y: Math.max(8, Math.round((window.innerHeight - PET_FLOAT_SIZE) / 2)) }
      : { x: 120, y: 80 },
  );
  const petDragRef = useRef<{ dx: number; dy: number } | null>(null);
  const petModeRef = useRef(false);
  const petPosRef = useRef({ x: 0, y: 0 });

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
    // Seeded voices are static public paths; creator uploads are protected
    // storage keys served through the per-session authorized asset proxy.
    const isStatic = /^(https?:)?\/\//.test(voice.audioUrl) || voice.audioUrl.startsWith("/");
    const src = isStatic
      ? voice.audioUrl
      : `/api/assets/proxy?key=${encodeURIComponent(voice.audioUrl)}${
          viewerSessionId ? `&viewerSessionId=${encodeURIComponent(viewerSessionId)}` : ""
        }`;
    voiceAudioRef.current?.pause();
    const audio = new Audio(src);
    audio.volume = voiceVolumeRef.current;
    voiceAudioRef.current = audio;
    audio.onended = () => setSubtitle(null);
    void audio.play().catch(() => {});
  }, [showSubtitle, viewerSessionId]);

  // Keep the voice volume ref in sync and live-apply to any playing line.
  useEffect(() => {
    voiceVolumeRef.current = voiceVolume;
    if (voiceAudioRef.current) voiceAudioRef.current.volume = voiceVolume;
  }, [voiceVolume]);

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
    // Cancellation token: React StrictMode (and any dep change) mounts → unmounts
    // → remounts this effect. init() is async, so a stale run must NOT keep going
    // and build a second PIXI app / WebGL context — that orphans the model's GL
    // objects in a dead context ("object does not belong to this context") and
    // the model fails to render. Each run bumps the token; after every await we
    // bail (tearing down anything we created) if a newer run has superseded us.
    const myRun = ++runIdRef.current;
    const superseded = () => runIdRef.current !== myRun;
    try {
      for (const src of SCRIPTS) {
        await loadScript(src);
      }
      if (superseded()) return;
      const w = window as unknown as Live2DWindow;
      const PIXI = w.PIXI;
      const Live2DModel = PIXI?.live2d?.Live2DModel;
      const host = stageHostRef.current;
      if (!PIXI || !Live2DModel || !host) throw new Error("Live2D runtime unavailable");

      // Cubism4 models with clipping masks crash under Pixi 7 without these two
      // patches: a memory-allocator mock and a no-op clipping-context manager.
      w.Live2DCubismCore = w.Live2DCubismCore ?? {};
      w.Live2DCubismCore.Memory = w.Live2DCubismCore.Memory ?? {
        initializeAmountOfMemory(size: number) {
          console.log("Mocked Live2DCubismCore.Memory.initializeAmountOfMemory called with size:", size);
        },
      };

      const Cubism4InternalModel = PIXI.live2d?.Cubism4InternalModel;
      if (Cubism4InternalModel) {
        const proto = Cubism4InternalModel.prototype;
        const originalUpdateWebGLContext = proto.updateWebGLContext;
        proto.updateWebGLContext = function (
          this: { renderer?: { _clippingManager?: unknown } },
          gl: unknown,
          glContextID: unknown,
        ) {
          if (this.renderer && !this.renderer._clippingManager) {
            this.renderer._clippingManager = new Proxy({} as Record<string | symbol, unknown>, {
              get(target, prop) {
                if (prop === "_currentFrameNo" || prop === "_maskTexture") {
                  return target[prop];
                }
                return function () {
                  if (prop === "getRenderTextureCount" || prop === "getClippingMaskBufferSize") {
                    return 0;
                  }
                  if (prop === "getClippingContextListForDraw") {
                    return [];
                  }
                  return undefined;
                };
              },
              set(target, prop, value) {
                target[prop] = value;
                return true;
              },
            });
          }
          originalUpdateWebGLContext.call(this, gl, glContextID);
        };
      }

      // Register the Pixi ticker — without it the model is frozen: blink,
      // physics, idle, and motions never advance.
      Live2DModel.registerTicker(PIXI.Ticker);

      if (superseded()) return;
      const app = new PIXI.Application({
        autoStart: true,
        backgroundAlpha: 0,
        resizeTo: host,
        antialias: true,
      });
      appRef.current = app;

      // Pixi owns this canvas; mount it into the React host exactly once.
      host.replaceChildren(app.view);

      const manifestUrl = `/api/assets/live2d-model?projectSlug=${encodeURIComponent(projectSlug)}${
        viewerSessionId ? `&viewerSessionId=${encodeURIComponent(viewerSessionId)}` : ""
      }`;
      const model = await Live2DModel.from(manifestUrl);
      // A newer run superseded us while the model was loading — tear down the
      // app + model we built so we don't leave a second live WebGL context.
      if (superseded()) {
        model.destroy();
        app.destroy(true, { children: true });
        if (appRef.current === app) appRef.current = null;
        return;
      }
      modelRef.current = model;

      model.anchor.set(0.5, 0.5);
      // Capture intrinsic size BEFORE scaling (default scale is 1 here).
      naturalRef.current = { w: model.width || 1, h: model.height || 1 };
      const { width, height } = app.renderer;
      const base = Math.min(width / naturalRef.current.w, height / naturalRef.current.h) * 0.9 || 0.2;
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
      // Flatten every motion into an individually playable entry (parity with the
      // landing demo, which lists each motion rather than just group names).
      const settingsMotions = im?.settings?.motions ?? {};
      const flatMotions: Array<{ group: string; index: number; label: string }> = [];
      for (const [group, list] of Object.entries(settingsMotions)) {
        (list ?? []).forEach((m, index) => {
          flatMotions.push({ group, index, label: motionLabel(m.File ?? m.file ?? `${group || ""}-${index + 1}`) });
        });
      }
      setMotionList(flatMotions);
      setExpressions((im?.settings?.expressions ?? []).map((e, i) => e.Name ?? e.name ?? t("expressionN", { n: i + 1 })));
      setPhase("ready");
    } catch (error) {
      console.error("Live2D init failed", error);
      setPhase("error");
    }
  }, [projectSlug, viewerSessionId, t]);

  useEffect(() => {
    // init() only setStates after awaiting CDN + model load (no sync cascade).
    init();
    return () => {
      // Invalidate any in-flight init() so its post-await continuation bails
      // instead of spinning up a second WebGL context.
      runIdRef.current++;
      modelRef.current?.destroy();
      modelRef.current = null;
      // Pixi owns the canvas, so removeView is safe — it detaches its own node.
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
    };
  }, [init, attempt]);

  // Triggered Live2D effects from chat tags: parameters + expression + voice.
  useEffect(() => {
    const model = modelRef.current;
    const core = model?.internalModel?.coreModel;
    for (const effect of activeEffects) {
      if (core) {
        for (const param of effect.params) {
          try {
            core.setParameterValueById(param.id, param.value);
          } catch {
            // unknown parameter id — ignore
          }
        }
      }
      // Apply the tag's expression, if it binds one.
      if (effect.expression) {
        try {
          model?.expression?.(effect.expression);
        } catch {
          // unknown expression — ignore
        }
      }
      // Play the project voice bound to this tag (same path as tap reactions).
      const voice = voiceForReaction(effect.tag);
      if (voice) playVoice(voice, effect.tag);
    }
  }, [activeEffects, playVoice, voiceForReaction]);

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

  // Idle: gentle baseline motion when auto idle is on AND random motion is off
  // (otherwise the random-motion loop below drives the body).
  useEffect(() => {
    if (phase !== "ready" || !idle || randomMotion) return;
    const id = setInterval(() => modelRef.current?.motion?.("", 0), 9000);
    return () => clearInterval(id);
  }, [phase, idle, randomMotion]);

  // Auto-perform: random motion / expression / voice on their own cadences while
  // idle. Each is independently toggled in the settings panel; the motion &
  // expression lists stay clickable for manual triggering regardless.
  useEffect(() => {
    if (phase !== "ready" || !randomMotion) return;
    const playRandom = () => {
      const m = modelRef.current;
      if (!m) return;
      if (motionList.length) {
        const pick = motionList[Math.floor(Math.random() * motionList.length)];
        m.motion?.(pick.group, pick.index);
      } else {
        m.motion?.("", Math.floor(Math.random() * 4));
      }
    };
    const id = setInterval(playRandom, 9000);
    return () => clearInterval(id);
  }, [phase, randomMotion, motionList]);

  useEffect(() => {
    if (phase !== "ready" || !randomExpr || expressions.length === 0) return;
    const id = setInterval(() => {
      const name = expressions[Math.floor(Math.random() * expressions.length)];
      modelRef.current?.expression?.(name);
    }, 13000);
    return () => clearInterval(id);
  }, [phase, randomExpr, expressions]);

  useEffect(() => {
    if (phase !== "ready" || !randomVoice || voices.length === 0) return;
    const id = setInterval(() => {
      const v = voices[Math.floor(Math.random() * voices.length)];
      if (v) playVoice(v);
    }, 17000);
    return () => clearInterval(id);
  }, [phase, randomVoice, voices, playVoice]);

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
    // While dragging the pet float, move the window instead of tracking gaze.
    const drag = petDragRef.current;
    if (drag) {
      setPetPos({ x: Math.max(8, e.clientX - drag.dx), y: Math.max(8, e.clientY - drag.dy) });
      return;
    }
    const model = modelRef.current;
    const host = stageHostRef.current;
    if (!model?.focus || !host || !gazeRef.current) return;
    const rect = host.getBoundingClientRect();
    model.focus(e.clientX - rect.left, e.clientY - rect.top);
  }, []);

  // Tap reaction: hit-test the tapped point against the model's named areas
  // (head / body / special) and react with motion + voice + subtitle. pixi-live2d
  // -display 0.4's built-in hit event relies on Pixi 6's InteractionManager, which
  // Pixi 7 removed, so we hit-test manually on pointer down (mouse + touch alike).
  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      // In pet mode, dragging the window takes over from tap reactions (matches
      // the landing desktop-pet: grab anywhere on the float to move it).
      if (petModeRef.current) {
        e.preventDefault();
        const pos = petPosRef.current;
        petDragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        return;
      }
      const model = modelRef.current;
      const host = stageHostRef.current;
      if (!model || !host) return;
      const rect = host.getBoundingClientRect();
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

  const motionItems = motionList.length
    ? motionList.map((m, i) => ({
        label: m.label || t("motionN", { n: i + 1 }),
        onSelect: () => modelRef.current?.motion?.(m.group, m.index),
      }))
    : (motionGroups.length ? motionGroups : [""]).map((g, i) => ({
        label: g || t("motionN", { n: i + 1 }),
        onSelect: () => modelRef.current?.motion?.(g, g ? undefined : i),
      }));
  const expressionItems = expressions.map((name) => ({
    label: name,
    onSelect: () => modelRef.current?.expression?.(name),
  }));
  const sceneItems = bgOptions.map((b, i) => ({
    label: b.kind === "image" ? t("creatorBackground") : t(b.labelKey),
    active: bgIdx === i,
    onSelect: () => setBgIdx(i),
  }));
  const settingsSections = [
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
        { label: t("gaze"), active: gaze, onSelect: () => setGaze((v) => !v) },
        { label: t("blink"), active: blink, onSelect: () => setBlink((v) => !v) },
        { label: t("physics"), active: physics, onSelect: () => setPhysics((v) => !v) },
        { label: t("idle"), active: idle, onSelect: () => setIdle((v) => !v) },
        { label: t("lipSync"), active: lipSync, onSelect: () => setLipSync((v) => !v) },
      ],
    },
    {
      title: t("sectionAuto"),
      items: [
        { label: t("autoMotion"), active: randomMotion, onSelect: () => setRandomMotion((v) => !v) },
        { label: t("autoExpr"), active: randomExpr, onSelect: () => setRandomExpr((v) => !v) },
        { label: t("autoVoice"), active: randomVoice, onSelect: () => setRandomVoice((v) => !v) },
      ],
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
  ];

  // Refit the model whenever the host resizes (layout toggle, pet float, window).
  // Resize the Pixi renderer to the host explicitly (CSS-driven size changes
  // don't fire a window resize), then rescale from the INTRINSIC model size.
  const refitModel = useCallback(() => {
    const model = modelRef.current;
    const app = appRef.current;
    const host = stageHostRef.current;
    if (!model || !app || !host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return;
    app.renderer.resize(w, h);
    const nat = naturalRef.current;
    const base = Math.min(w / (nat.w || w), h / (nat.h || h)) * 0.9 || 0.2;
    baseScaleRef.current = base;
    const s = base * scaleMul;
    model.scale.set(flip ? -s : s, s);
    model.position.set(w / 2, h / 2 + posOff);
  }, [scaleMul, flip, posOff]);

  useEffect(() => {
    if (phase !== "ready") return;
    const host = stageHostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => refitModel());
    ro.observe(host);
    return () => ro.disconnect();
  }, [phase, refitModel]);

  // Keep pet state in refs so the (stable) pointer handlers read fresh values.
  useEffect(() => {
    petModeRef.current = petMode;
  }, [petMode]);
  useEffect(() => {
    petPosRef.current = petPos;
  }, [petPos]);
  const onPetPointerUp = useCallback(() => {
    petDragRef.current = null;
  }, []);

  return (
    <div
      className={`${styles.root} ${petMode ? styles.petFloat : ""}`}
      style={petMode ? { left: petPos.x, top: petPos.y } : undefined}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPetPointerUp}
    >
      <div
        className={styles.bg}
        aria-hidden
        style={
          currentBg?.kind === "image"
            ? { backgroundImage: `url(${currentBg.url})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: currentBg?.css }
        }
      />
      <div ref={stageHostRef} className={`${styles.canvas} ${phase === "ready" ? styles.canvasReady : ""}`} />
      {phase === "ready" && subtitle ? (
        <div className={styles.subtitle} aria-live="polite">
          <span className={styles.subtitleTitle}>⚓ {subtitle.title}</span>
          {subtitle.text ? <span className={styles.subtitleText}>{subtitle.text}</span> : null}
        </div>
      ) : null}
      {phase === "ready" ? (
        // Controls render inside the stage root, so their pointer events would
        // bubble up to onPointerDown and fire a stray model tap reaction. Stop
        // propagation here so clicking a control never triggers a motion/voice.
        <div
          className={styles.controlsLayer}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
        >
          <Live2DStageControls
            motions={motionItems}
            expressions={expressionItems}
            scenes={sceneItems}
            settings={settingsSections}
            voiceVolume={voiceVolume}
            onVoiceVolume={setVoiceVolume}
            onRandom={() => reactToArea([])}
            bgmOn={bgmOn}
            onToggleBgm={() => setBgmOn((v) => !v)}
            petActive={petMode}
            onTogglePet={() => setPetMode((v) => !v)}
            variant={petMode || isMobile ? "pet" : "dock"}
            showPetToggle={!isMobile}
          />
        </div>
      ) : null}
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
