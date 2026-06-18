"use client";

import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";

import { Live2DControls, type ControlPanel } from "@/components/live2d-controls";
import { Button } from "@/components/ui";

import styles from "./live2d-viewer.module.css";

export type Live2DEffect = { tag: string; params: Array<{ id: string; value: number }> };

type Props = {
  projectSlug: string;
  viewerSessionId?: string;
  activeTags: string[];
  activeEffects: Live2DEffect[];
  isSpeaking: boolean;
  voices?: Array<{ name: string }>;
};

// CDN runtime — PixiJS + Live2D Cubism Core + pixi-live2d-display (cubism4 bundle).
const SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js",
  "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
  "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js",
];

type CoreModel = { setParameterValueById(id: string, value: number): void };
type MotionManager = { definitions?: Record<string, unknown[]>; motionGroups?: Record<string, unknown[]> };
type InternalModel = {
  coreModel?: CoreModel;
  motionManager?: MotionManager;
  eyeBlink?: unknown;
  physics?: unknown;
  settings?: { expressions?: Array<{ Name?: string; name?: string }> };
};
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

export function Live2DViewer({ projectSlug, viewerSessionId, activeEffects, isSpeaking, voices = [] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PixiApp | null>(null);
  const modelRef = useRef<Live2DModelInstance | null>(null);
  const baseScaleRef = useRef(0.2);
  const eyeBlinkRef = useRef<unknown>(undefined);
  const physicsRef = useRef<unknown>(undefined);
  const gazeRef = useRef(true);

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [motionGroups, setMotionGroups] = useState<string[]>([]);
  const [expressions, setExpressions] = useState<string[]>([]);

  // Model-setting controls (parity with the landing showcase).
  const [scaleMul, setScaleMul] = useState(1);
  const [posOff, setPosOff] = useState(0);
  const [flip, setFlip] = useState(false);
  const [gaze, setGaze] = useState(true);
  const [blink, setBlink] = useState(true);
  const [physics, setPhysics] = useState(true);
  const [idle, setIdle] = useState(true);
  const [lipSync, setLipSync] = useState(true);

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
      setExpressions((im?.settings?.expressions ?? []).map((e, i) => e.Name ?? e.name ?? `表情 ${i + 1}`));
      setPhase("ready");
    } catch (error) {
      console.error("Live2D init failed", error);
      setPhase("error");
    }
  }, [projectSlug, viewerSessionId]);

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

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const model = modelRef.current;
    const canvas = canvasRef.current;
    if (!model?.focus || !canvas || !gazeRef.current) return;
    const rect = canvas.getBoundingClientRect();
    model.focus(e.clientX - rect.left, e.clientY - rect.top);
  }, []);
  const tapIdx = useRef(0);
  const onPointerDown = useCallback(() => {
    modelRef.current?.motion?.("", tapIdx.current++ % 4);
  }, []);

  const motionNames = motionGroups.length ? motionGroups : [""];
  const panels: ControlPanel[] = [
    {
      key: "act",
      title: "动作 / 表情",
      icon: "act",
      sections: [
        {
          title: "动作",
          items: motionNames.map((g, i) => ({
            label: g || `动作 ${i + 1}`,
            onSelect: () => modelRef.current?.motion?.(g, g ? undefined : i),
          })),
        },
        {
          title: "表情",
          items: expressions.map((name) => ({ label: name, onSelect: () => modelRef.current?.expression?.(name) })),
        },
      ],
    },
    {
      key: "voice",
      title: "声音",
      icon: "voice",
      sections: [
        {
          title: "预置语音",
          items: voices.map((v) => ({ label: v.name, onSelect: () => modelRef.current?.motion?.("", 0) })),
        },
      ],
    },
    {
      key: "settings",
      title: "模型设置",
      icon: "settings",
      sections: [
        {
          title: "缩放",
          items: [
            { label: "放大", active: scaleMul > 1, onSelect: () => setScaleMul(1.25) },
            { label: "标准", active: scaleMul === 1, onSelect: () => setScaleMul(1) },
            { label: "缩小", active: scaleMul < 1, onSelect: () => setScaleMul(0.8) },
          ],
        },
        {
          title: "位置",
          items: [
            { label: "上移", active: posOff < 0, onSelect: () => setPosOff(-40) },
            { label: "居中", active: posOff === 0, onSelect: () => setPosOff(0) },
            { label: "下移", active: posOff > 0, onSelect: () => setPosOff(40) },
            { label: "镜像翻转", active: flip, onSelect: () => setFlip((v) => !v) },
          ],
        },
        {
          title: "动态参数",
          items: [
            { label: `视线跟随 · ${gaze ? "开" : "关"}`, active: gaze, onSelect: () => setGaze((v) => !v) },
            { label: `自动眨眼 · ${blink ? "开" : "关"}`, active: blink, onSelect: () => setBlink((v) => !v) },
            { label: `物理摆动 · ${physics ? "开" : "关"}`, active: physics, onSelect: () => setPhysics((v) => !v) },
            { label: `自动待机 · ${idle ? "开" : "关"}`, active: idle, onSelect: () => setIdle((v) => !v) },
            { label: `口型同步 · ${lipSync ? "开" : "关"}`, active: lipSync, onSelect: () => setLipSync((v) => !v) },
          ],
        },
        {
          title: "操作",
          items: [
            { label: "随机动作", onSelect: () => modelRef.current?.motion?.("", Math.floor(Math.random() * 4)) },
            {
              label: "重置全部",
              onSelect: () => {
                setScaleMul(1);
                setPosOff(0);
                setFlip(false);
                setGaze(true);
                setBlink(true);
                setPhysics(true);
              },
            },
          ],
        },
      ],
    },
  ];

  return (
    <div className={styles.root} onPointerMove={onPointerMove} onPointerDown={onPointerDown}>
      <canvas ref={canvasRef} className={`${styles.canvas} ${phase === "ready" ? styles.canvasReady : ""}`} />
      {phase === "ready" ? <Live2DControls panels={panels} /> : null}
      {phase === "loading" ? (
        <div className={styles.status}>
          <div className={styles.spinner} aria-hidden />
          <span className={styles.statusText}>舞台加载中…</span>
        </div>
      ) : null}
      {phase === "error" ? (
        <div className={`${styles.status} ${styles.error}`}>
          <div className={styles.slot}>
            LIVE2D
            <br />
            加载失败
          </div>
          <span className={styles.statusText}>模型资源无法加载，请检查网络</span>
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
            重试
          </Button>
        </div>
      ) : null}
    </div>
  );
}
