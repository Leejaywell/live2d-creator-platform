"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Live2DControls, type ControlPanel } from "@/components/live2d-controls";
import { Button } from "@/components/ui";

import styles from "./live2d-viewer.module.css";

export type Live2DEffect = { tag: string; params: Array<{ id: string; value: number }> };

type Props = {
  projectSlug: string;
  viewerSessionId: string;
  activeTags: string[];
  activeEffects: Live2DEffect[];
  isSpeaking: boolean;
};

// CDN runtime — PixiJS + Live2D Cubism Core + pixi-live2d-display (cubism4 bundle).
const SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js",
  "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
  "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js",
];

type CoreModel = { setParameterValueById(id: string, value: number): void };
type MotionManager = {
  definitions?: Record<string, unknown[]>;
  motionGroups?: Record<string, unknown[]>;
};
type Live2DModelInstance = {
  scale: { set(value: number): void };
  position: { set(x: number, y: number): void };
  anchor: { set(x: number, y: number): void };
  width: number;
  height: number;
  internalModel?: { coreModel?: CoreModel; motionManager?: MotionManager };
  motion?: (group: string, index?: number) => void;
  expression?: (name?: string) => void;
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

export function Live2DViewer({ projectSlug, viewerSessionId, activeEffects, isSpeaking }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PixiApp | null>(null);
  const modelRef = useRef<Live2DModelInstance | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [motionGroups, setMotionGroups] = useState<string[]>([]);

  const init = useCallback(async () => {
    try {
      for (const src of SCRIPTS) {
        // sequential: cubism core must register before the display bundle
        await loadScript(src);
      }
      const w = window as unknown as Live2DWindow;
      const PIXI = w.PIXI;
      const Live2DModel = PIXI?.live2d?.Live2DModel;
      const canvas = canvasRef.current;
      if (!PIXI || !Live2DModel || !canvas) {
        throw new Error("Live2D runtime unavailable");
      }

      const app = new PIXI.Application({
        view: canvas,
        autoStart: true,
        backgroundAlpha: 0,
        resizeTo: canvas.parentElement ?? undefined,
        antialias: true,
      });
      appRef.current = app;

      const manifestUrl = `/api/assets/live2d-model?projectSlug=${encodeURIComponent(projectSlug)}&viewerSessionId=${encodeURIComponent(viewerSessionId)}`;
      const model = await Live2DModel.from(manifestUrl);
      modelRef.current = model;

      model.anchor.set(0.5, 0.5);
      const fit = () => {
        const { width, height } = app.renderer;
        const scale = Math.min(width / (model.width || width), height / (model.height || height)) * 0.9;
        model.scale.set(scale || 0.2);
        model.position.set(width / 2, height / 2);
      };
      fit();
      app.stage.addChild(model);
      const mm = model.internalModel?.motionManager;
      const defs = mm?.definitions ?? mm?.motionGroups;
      setMotionGroups(defs ? Object.keys(defs) : []);
      setPhase("ready");
    } catch (error) {
      console.error("Live2D init failed", error);
      setPhase("error");
    }
  }, [projectSlug, viewerSessionId]);

  useEffect(() => {
    // init() only calls setState after awaiting the CDN runtime + model load,
    // so it cannot trigger a synchronous cascading render.
    init();
    return () => {
      modelRef.current?.destroy();
      modelRef.current = null;
      appRef.current?.destroy(false, { children: true });
      appRef.current = null;
    };
  }, [init, attempt]);

  // Apply triggered Live2D parameters.
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

  // Light mouth motion while speaking.
  useEffect(() => {
    if (!isSpeaking) return;
    let raf = 0;
    const animate = () => {
      const core = modelRef.current?.internalModel?.coreModel;
      if (core) {
        try {
          core.setParameterValueById("ParamMouthOpenY", 0.5 + 0.5 * Math.sin(Date.now() / 120));
        } catch {
          // ignore
        }
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [isSpeaking]);

  const motionGroupNames = motionGroups.length ? motionGroups : [""];
  const panels: ControlPanel[] = [
    {
      key: "act",
      title: "动作 / 表情",
      icon: "act",
      sections: [
        {
          title: "动作 / 表情",
          items: motionGroupNames.map((g, i) => ({
            label: g || `动作 ${i + 1}`,
            onSelect: () => modelRef.current?.motion?.(g),
          })),
        },
      ],
    },
  ];

  return (
    <div className={styles.root}>
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
