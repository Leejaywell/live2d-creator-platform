"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./live2d-viewer.module.css";

declare global {
  interface Window {
    PIXI?: Live2DWindowPixi;
    Live2DCubismCore?: unknown;
  }
}

type Live2DWindowPixi = {
  Application: new (options: Record<string, unknown>) => Live2DApplication;
  live2d?: {
    Live2DModel: {
      from: (url: string) => Promise<Live2DModel>;
    };
  };
};

type Live2DApplication = {
  stage: {
    addChild: (model: Live2DModel) => void;
  };
  renderer: {
    width: number;
    height: number;
  };
  destroy: (removeView?: boolean, options?: Record<string, unknown>) => void;
};

type Live2DModel = {
  anchor?: {
    set: (x: number, y: number) => void;
  };
  x: number;
  y: number;
  scale: {
    set: (value: number) => void;
  };
  focus?: (x: number, y: number) => void;
  motion?: (group: string, index?: number, priority?: number) => unknown;
  expression?: (name: string | number) => void;
  internalModel?: {
    width?: number;
    height?: number;
    coreModel?: Live2DCoreModel;
    settings?: {
      motions?: Record<string, Array<{ File?: string }>>;
      expressions?: Array<{ Name?: string; File?: string }>;
    };
    on?: (event: string, handler: () => void) => void;
  };
  width?: number;
  height?: number;
};

type Live2DCoreModel = {
  parameters?: {
    ids: string[];
    values: number[];
  };
  setParameterValueById?: (id: string, value: number) => void;
  getParameterValueById?: (id: string) => number;
};

export type Live2DEffect = {
  tag: string;
  params: Array<{ id: string; value: number }>;
  expression?: string;
};

export function Live2DViewer({
  projectSlug,
  viewerSessionId,
  modelJsonUrl,
  activeTags,
  activeEffects,
  isSpeaking,
}: {
  projectSlug?: string;
  viewerSessionId?: string;
  modelJsonUrl?: string;
  activeTags: string[];
  activeEffects: Live2DEffect[];
  isSpeaking?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const appRef = useRef<Live2DApplication | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const activeRef = useRef<Record<string, number>>({});
  const effectParamsRef = useRef<Record<string, Array<{ id: string; value: number }>>>({});

  function handleTap(event: { clientX: number; clientY: number }) {
    const model = modelRef.current;
    const canvas = canvasRef.current;
    if (!model || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relativeY = (event.clientY - rect.top) / Math.max(rect.height, 1);
    playTapMotion(model, relativeY < 0.45 ? "head" : "body");
  }

  const isSpeakingRef = useRef(isSpeaking);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  function driveMouth(core?: Live2DCoreModel) {
    if (!core) return;
    let target = 0;
    if (isSpeakingRef.current) {
      const elapsed = performance.now();
      target = Math.abs(Math.sin(elapsed / 80) * 0.4 + Math.sin(elapsed / 30) * 0.3);
      if (Math.sin(elapsed / 400) < -0.7) {
        target = 0;
      }
    }
    const current = getParam(core, "ParamMouthOpenY") || 0;
    const easing = target > current ? 0.86 : 0.62;
    setParam(core, "ParamMouthOpenY", current + (target - current) * easing);
  }

  function applyExpressionState(core?: Live2DCoreModel) {
    if (!core) return;
    const now = performance.now();
    const paramSets = effectParamsRef.current;
    
    const targetValues: Record<string, number> = {};
    
    Object.entries(paramSets).forEach(([name, params]) => {
      const isActive = (activeRef.current[name] ?? 0) > now;
      if (isActive) {
        params.forEach((param) => {
          const existing = targetValues[param.id] ?? 0;
          if (Math.abs(param.value) > Math.abs(existing)) {
            targetValues[param.id] = param.value;
          }
        });
      }
    });

    const allControlledParamIds = new Set<string>();
    Object.values(paramSets).forEach((params) => {
      params.forEach((p) => allControlledParamIds.add(p.id));
    });

    allControlledParamIds.forEach((paramId) => {
      const target = targetValues[paramId] ?? 0;
      const current = getParam(core, paramId);
      const next = current + (target - current) * 0.12;
      setParam(core, paramId, next);
    });
  }

  useEffect(() => {
    const sourceUrl = modelJsonUrl ?? (projectSlug && viewerSessionId ? `/api/assets/live2d-model?${new URLSearchParams({ projectSlug, viewerSessionId }).toString()}` : "");
    if (!sourceUrl || !canvasRef.current || !rootRef.current) return;
    let disposed = false;
    setPhase("loading");

    async function boot() {
      await withTimeout(
        Promise.all([
          loadScript("https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"),
          loadScript("https://cdnjs.cloudflare.com/ajax/libs/pixi.js/6.5.10/browser/pixi.min.js"),
        ]).then(() => loadScript("https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js")),
        10000,
        "Live2D resources loading timed out",
      );

      if (disposed || !window.PIXI?.live2d || !canvasRef.current || !rootRef.current) return;

      appRef.current?.destroy(true, { children: true, texture: false, baseTexture: false });
      const isMobile = typeof window !== "undefined" && window.innerWidth < 920;
      const app = new window.PIXI.Application({
        view: canvasRef.current,
        transparent: true,
        backgroundAlpha: 0,
        resizeTo: rootRef.current,
        antialias: true,
        autoDensity: true,
        resolution: isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2),
      });
      appRef.current = app;

      const model = await window.PIXI.live2d.Live2DModel.from(sourceUrl);
      if (disposed) return;
      modelRef.current = model;
      app.stage.addChild(model);
      model.anchor?.set(0.5, 1);
      layoutModel();
      model.internalModel?.on?.("beforeModelUpdate", () => {
        applyExpressionState(model.internalModel?.coreModel);
        driveMouth(model.internalModel?.coreModel);
      });
      window.addEventListener("resize", layoutModel);
      window.addEventListener("pointermove", followPointer);
      setPhase("ready");
    }

    function layoutModel() {
      const app = appRef.current;
      const model = modelRef.current;
      const root = rootRef.current;
      if (!app || !model || !root) return;
      const rect = root.getBoundingClientRect();
      const viewWidth = rect.width;
      const viewHeight = rect.height;
      const baseWidth = model.internalModel?.width || model.width || 1;
      const baseHeight = model.internalModel?.height || model.height || 1400;
      // Contain the whole model inside the canvas so tall full-body models are
      // not cropped the way bust-framed models can be when filling height alone.
      const scale = Math.min(viewWidth / Math.max(baseWidth, 1), viewHeight / Math.max(baseHeight, 1)) * 0.92;
      model.scale.set(scale);
      model.x = viewWidth / 2;
      model.y = viewHeight;
    }

    function followPointer(event: PointerEvent) {
      modelRef.current?.focus?.(event.clientX, event.clientY);
    }

    boot().catch((error) => {
      console.error(error);
      if (!disposed) {
        setPhase("error");
      }
    });

    return () => {
      disposed = true;
      window.removeEventListener("resize", layoutModel);
      window.removeEventListener("pointermove", followPointer);
      appRef.current?.destroy(true, { children: true, texture: false, baseTexture: false });
      appRef.current = null;
      modelRef.current = null;
    };
  }, [modelJsonUrl, projectSlug, viewerSessionId]);

  useEffect(() => {
    // The runtime only applies expression params the server sent for the matched
    // tags (built from each tag's live2dParams/expression) — no model-specific
    // hardcoding, so any uploaded model works.
    activeEffects.forEach((effect) => {
      if (effect.expression && modelRef.current) {
        const model = modelRef.current;
        const expressions = model.internalModel?.settings?.expressions;
        const exists = Array.isArray(expressions) && expressions.some(
          (exp) => exp.Name?.toLowerCase() === effect.expression?.toLowerCase()
        );
        if (exists) {
          try {
            model.expression?.(effect.expression);
          } catch (err) {
            console.error("Failed to play expression", effect.expression, err);
          }
        }
      }

      if (effect.params.length) {
        effectParamsRef.current[effect.tag] = effect.params;
        activeRef.current[effect.tag] = performance.now() + 4200;
      }
    });
  }, [activeEffects, activeTags]);

  return (
    <div ref={rootRef} className={styles.root} data-testid="live2d-viewer">
      <link rel="preload" href="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js" as="script" />
      <link rel="preload" href="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/6.5.10/browser/pixi.min.js" as="script" />
      <link rel="preload" href="https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js" as="script" />
      <canvas
        ref={canvasRef}
        className={phase === "ready" ? `${styles.canvas} ${styles.canvasReady}` : styles.canvas}
        data-testid="live2d-canvas"
        aria-label="Live2D 模型画布"
        style={{ cursor: phase === "ready" ? "pointer" : "default" }}
        onPointerDown={handleTap}
      />
      {phase === "loading" ? (
        <div className={styles.status} aria-live="polite">
          <div className={styles.spinner} aria-hidden />
          <span>模型加载中…</span>
        </div>
      ) : null}
      {phase === "error" ? (
        <div className={`${styles.status} ${styles.statusError}`} aria-live="polite">
          <span>模型加载失败,聊天不受影响</span>
        </div>
      ) : null}
    </div>
  );
}

function playTapMotion(model: Live2DModel, region: "head" | "body") {
  const groups = model.internalModel?.settings?.motions;
  if (!groups || typeof model.motion !== "function") return;
  const groupNames = Object.keys(groups);
  if (!groupNames.length) return;

  // A dedicated "Tap" motion group (e.g. Cubism sample models) wins outright.
  const tapGroup = groupNames.find((name) => /tap/i.test(name));
  if (tapGroup) {
    const list = groups[tapGroup] ?? [];
    model.motion(tapGroup, Math.floor(Math.random() * Math.max(list.length, 1)), 3);
    return;
  }

  // Otherwise use the default group, preferring touch_head/touch_body by region.
  const group = groupNames.includes("") ? "" : groupNames[0];
  const list = groups[group] ?? [];
  const wanted = region === "head" ? "touch_head" : "touch_body";
  let index = list.findIndex((motion) => motion.File?.toLowerCase().includes(wanted));
  if (index < 0) index = list.findIndex((motion) => /touch|tap/i.test(motion.File ?? ""));
  if (index < 0) index = Math.floor(Math.random() * Math.max(list.length, 1));
  model.motion(group, index, 3);
}

function getParam(core: Live2DCoreModel, id: string) {
  const index = core.parameters?.ids.indexOf(id) ?? -1;
  if (index >= 0 && core.parameters) return core.parameters.values[index] ?? 0;
  return core.getParameterValueById?.(id) ?? 0;
}

function setParam(core: Live2DCoreModel, id: string, value: number) {
  const index = core.parameters?.ids.indexOf(id) ?? -1;
  if (index >= 0 && core.parameters) {
    core.parameters.values[index] = value;
    return;
  }
  core.setParameterValueById?.(id, value);
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(script);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, ms);
    promise.then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
