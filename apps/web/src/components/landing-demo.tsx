"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, cx } from "./ui";
import { useGlobalPet, type TabType } from "./global-pet-context";
import styles from "./landing-demo.module.css";

// Self-hosted runtime — PixiJS + Live2D Cubism Core + pixi-live2d-display (cubism4
// bundle). Vendored under /public so the landing demo never depends on a third-party
// CDN being reachable at runtime.
export const SCRIPTS = [
  "/vendor/pixi-7.4.2.min.js",
  "/live2dcubismcore.min.js",
  "/vendor/pixi-live2d-cubism4-0.4.0.min.js",
];

export type CharacterConfig = {
  key: string;
  nameCn: string;
  nameEn: string;
  skinId: string;
  modelPath: string;
  scale: number;
  offsetY: number;
  offsetX: number;
  bgTheme: string;
};

export const CHARACTERS: CharacterConfig[] = [
  {
    key: "shengluyisi_3",
    nameCn: "圣路易斯",
    nameEn: "St. Louis",
    skinId: "102132",
    modelPath: "/live2d/shengluyisi_3/shengluyisi_3.model3.json",
    scale: 0.16,
    offsetY: 60,
    offsetX: 0,
    bgTheme: "aurora"
  },
  {
    key: "beierfasite_2",
    nameCn: "贝尔法斯特",
    nameEn: "Belfast",
    skinId: "202121",
    modelPath: "/live2d/beierfasite_2/beierfasite_2.model3.json",
    scale: 0.20,
    offsetY: 90,
    offsetX: 0,
    bgTheme: "default"
  },
  {
    key: "aidang_2",
    nameCn: "爱宕",
    nameEn: "Atago",
    skinId: "303121",
    modelPath: "/live2d/aidang_2/aidang_2.model3.json",
    scale: 0.14,
    offsetY: 70,
    offsetX: 0,
    bgTheme: "studio"
  },
  {
    key: "aijier_3",
    nameCn: "埃吉尔",
    nameEn: "Ägir",
    skinId: "499052",
    modelPath: "/live2d/aijier_3/aijier_3.model3.json",
    scale: 0.12,
    offsetY: 10,
    offsetX: 0,
    bgTheme: "aurora"
  }
];

// All scenes are token-aligned CSS gradients — no external imagery, so the stage
// always matches the site palette and never waits on a remote photo to load.
export const BACKGROUNDS = [
  {
    key: "default",
    labelKey: "bgDefault",
    css: "radial-gradient(60% 50% at 50% 30%, rgba(255, 108, 158, 0.30), transparent 70%), radial-gradient(circle at 50% 50%, #170d2a 0%, #0b0816 70%, #060409 100%)",
  },
  {
    key: "aurora",
    labelKey: "bgAurora",
    css: "radial-gradient(52% 44% at 24% 26%, rgba(111, 231, 218, 0.24), transparent 64%), radial-gradient(52% 48% at 80% 72%, rgba(255, 108, 158, 0.24), transparent 64%), radial-gradient(circle at 50% 50%, #0e1226 0%, #070512 82%)",
  },
  {
    key: "studio",
    labelKey: "bgStudio",
    css: "radial-gradient(60% 50% at 50% 22%, rgba(242, 193, 78, 0.20), transparent 68%), radial-gradient(circle at 50% 62%, #1a1326 0%, #0a0712 80%)",
  },
  {
    key: "midnight",
    labelKey: "bgMidnight",
    css: "radial-gradient(circle at 50% 50%, #0d081b 0%, #040208 85%)",
  },
  { key: "transparent", labelKey: "bgTransparent", css: "transparent" },
];

type PixiApp = {
  stage: { addChild(c: unknown): void; removeChild(c: unknown): void };
  renderer: { width: number; height: number };
  destroy(removeView?: boolean, opts?: { children?: boolean }): void;
  destroyed?: boolean;
};

type ModelInstance = {
  scale: { set(x: number, y?: number): void };
  position: { set(x: number, y: number): void };
  anchor: { set(x: number, y?: number): void };
  width: number;
  height: number;
  internalModel?: {
    eyeBlink?: unknown;
    physics?: unknown;
    coreModel?: {
      parameters: {
        ids: string[];
        values: number[];
        minimumValues: number[];
        maximumValues: number[];
      };
    };
  };
  motion?: (group: string, index?: number) => void;
  expression?: (index: number) => void;
  focus?: (x: number, y: number) => void;
  destroy(): void;
  on(event: string, callback: (...args: any[]) => void): void;
};

const scriptCache = new Map<string, Promise<void>>();
export function loadScript(src: string) {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const cached = scriptCache.get(src);
  if (cached) return cached;
  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
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

export function LandingDemo() {
  const t = useTranslations("landing");
  const locale = useLocale();
  // React owns this host element only. PixiJS creates and owns the actual <canvas>
  // inside it, so destroying the Pixi app (removeView) never touches a React-managed
  // node — avoids "removeChild" crashes and stale-WebGL-context reuse under
  // StrictMode double-mount.
  const stageHostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<PixiApp | null>(null);
  const modelRef = useRef<ModelInstance | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  
  const bgmPlayerRef = useRef<HTMLAudioElement | null>(null);
  const voicePlayerRef = useRef<HTMLAudioElement | null>(null);
  const subtitleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charMenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  

  const {
    layoutMode,
    setLayoutMode,
    charIdx,
    setCharIdx,
    voiceVolume,
    setVoiceVolume,
    bgmPlaying,
    setBgmPlaying,
    bgTheme,
    setBgTheme,
    sidebarOpen,
    setSidebarOpen,
    activeTab,
    setActiveTab,
    setWidgetPos
  } = useGlobalPet();

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [audioConfig, setAudioConfig] = useState<any>(null);
  const [subtitle, setSubtitle] = useState<{ title: string; text: string } | null>(null);
  const [subtitlePos, setSubtitlePos] = useState({ left: "50%", top: "10%" });
  const [motionsList, setMotionsList] = useState<string[]>([]);
  const [expressionsList, setExpressionsList] = useState<string[]>([]);
  const [charMenuOpen, setCharMenuOpen] = useState(false);

  // model parameter settings
  const scaleMul = 1;
  const posOff = 0;
  const flip = false;
  const gaze = true;
  const blink = true;
  const physics = true;

  const eyeBlinkRef = useRef<unknown>(null);
  const physicsRef = useRef<unknown>(null);
  const charIdxRef = useRef(charIdx);
  useEffect(() => {
    charIdxRef.current = charIdx;
  }, [charIdx]);
  // Volatile values read by playVoice via refs so its identity (and therefore
  // loadModel's) stays stable — otherwise dragging the volume slider or switching
  // characters would tear down and rebuild the whole Pixi stage.
  const voiceVolumeRef = useRef(voiceVolume);
  useEffect(() => {
    voiceVolumeRef.current = voiceVolume;
  }, [voiceVolume]);
  const loadedCharIdxRef = useRef<number | null>(null);

  // Stop current voice line audio
  const stopCurrentVoice = useCallback(() => {
    if (voicePlayerRef.current) {
      voicePlayerRef.current.pause();
      voicePlayerRef.current.currentTime = 0;
    }
    setSubtitle(null);
    if (subtitleTimeoutRef.current) {
      clearTimeout(subtitleTimeoutRef.current);
      subtitleTimeoutRef.current = null;
    }
  }, []);

  const resetDragStyles = useCallback(() => {
    const stageEl = stageRef.current;
    if (stageEl) {
      stageEl.style.left = "";
      stageEl.style.top = "";
      stageEl.style.right = "";
      stageEl.style.bottom = "";
      stageEl.style.margin = "";
    }
  }, []);

  // Resize app and clean audio on layout changes
  useEffect(() => {
    const app = appRef.current;
    if (app) {
      (app as any).resize();
    }
    if (layoutMode === 'widget') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      stopCurrentVoice();
    }
  }, [layoutMode, stopCurrentVoice]);

  // Play character voice line
  const playVoice = useCallback((eventKey: string) => {
    if (!audioConfig) return;
    const charKey = CHARACTERS[charIdxRef.current].key;
    const charMeta = audioConfig[charKey];
    if (!charMeta) return;

    let voiceData = charMeta[eventKey];
    if (!voiceData && eventKey === 'headtouch') voiceData = charMeta['touch'];
    if (!voiceData && eventKey === 'touch2') voiceData = charMeta['touch'];

    if (!voiceData) {
      console.warn(`No voice line found for event: ${eventKey}`);
      return;
    }

    stopCurrentVoice();

    const textVal = voiceData.text;
    let displaySpeech = "";
    if (typeof textVal === "object" && textVal !== null) {
      displaySpeech = textVal[locale] || textVal["zh"] || textVal["en"] || "";
    } else {
      const localeKey = `text_${locale}`;
      displaySpeech = voiceData[localeKey] || voiceData["text_zh"] || voiceData.text || "";
    }

    setSubtitle({
      title: eventKey.toUpperCase(),
      text: displaySpeech
    });

    const audio = new Audio(voiceData.audio);
    audio.volume = voiceVolumeRef.current;
    voicePlayerRef.current = audio;

    audio.play().catch((e) => console.warn("Voice autoplay blocked:", e));

    audio.onended = () => {
      setSubtitle(null);
    };

    if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
    subtitleTimeoutRef.current = setTimeout(() => {
      setSubtitle(null);
    }, 8000);
  }, [audioConfig, stopCurrentVoice, locale]);

  // Trigger motions
  const triggerMotion = useCallback((motionName: string) => {
    const model = modelRef.current;
    if (!model) return;

    const motions = (model as any).internalModel?.settings?.motions;
    if (motions) {
      let found = false;
      for (const [group, list] of Object.entries(motions) as any) {
        const index = list.findIndex((m: any) => {
          const file = m.File || m.file || "";
          return file.includes(motionName);
        });
        if (index !== -1) {
          (model as any).motion(group, index);
          found = true;
          break;
        }
      }
      if (!found) {
        (model as any).motion(motionName);
      }
    } else {
      (model as any).motion?.(motionName);
    }
  }, []);

  const triggerVoiceAndMotion = useCallback((eventKey: string) => {
    playVoice(eventKey);

    const motionMapping: Record<string, string> = {
      "login": "login",
      "home": "home",
      "headtouch": "touch_head",
      "touch": "touch_body",
      "touch2": "touch_special",
      "main1": "main_1",
      "main2": "main_2",
      "main3": "main_3",
      "mission_complete": "mission_complete",
      "mission": "mission"
    };

    const motionName = motionMapping[eventKey] || "idle";
    triggerMotion(motionName);
  }, [playVoice, triggerMotion]);

  const triggerExpression = useCallback((index: number) => {
    const model = modelRef.current;
    if (model && (model as any).expression) {
      (model as any).expression(index);
    }
  }, []);

  // Map a set of hit-area names to a voiced reaction.
  const reactToHit = useCallback((hitAreas: string[]) => {
    if (hitAreas.includes("special") || hitAreas.includes("Special")) {
      triggerVoiceAndMotion("touch2");
    } else if (hitAreas.includes("body") || hitAreas.includes("Body")) {
      triggerVoiceAndMotion("touch");
    } else if (hitAreas.includes("head") || hitAreas.includes("Head")) {
      triggerVoiceAndMotion("headtouch");
    } else {
      const randomEvents = ["main1", "main2", "main3", "home"];
      triggerVoiceAndMotion(randomEvents[Math.floor(Math.random() * randomEvents.length)]);
    }
  }, [triggerVoiceAndMotion]);

  // Manual hit-testing. pixi-live2d-display 0.4's built-in `hit` event relies on
  // Pixi 6's InteractionManager, which Pixi 7 replaced — so we hit-test ourselves
  // on pointer down. Works identically for mouse click and touch tap.
  const handleStageTap = useCallback((clientX: number, clientY: number) => {
    const model = modelRef.current as any;
    const host = stageHostRef.current;
    if (!model?.hitTest || !host) return;
    const rect = host.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const hits: string[] = model.hitTest(x, y) || [];
    if (hits.length > 0) {
      reactToHit(hits);
      return;
    }
    // No named area, but if the tap landed on the model's silhouette, still react.
    try {
      const b = model.getBounds();
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        reactToHit([]);
      }
    } catch {
      /* bounds unavailable — ignore */
    }
  }, [reactToHit]);

  // Fetch audio config once
  useEffect(() => {
    fetch("/live2d/audio_config.json")
      .then((res) => res.json())
      .then((data) => setAudioConfig(data))
      .catch((err) => console.error("Failed to load audio config", err));
  }, []);

  // Load (or hot-swap) a model into the existing pixi app.
  const loadModel = useCallback(async (url: string, charData: CharacterConfig) => {
    const w = window as any;
    const Live2DModel = w.PIXI?.live2d?.Live2DModel;
    const app = appRef.current;
    if (!Live2DModel || !app) return;

    try {
      setPhase("loading");
      modelRef.current?.destroy();
      modelRef.current = null;
      stopCurrentVoice();

      const model = await Live2DModel.from(url);
      if (app.destroyed || !app.stage) {
        // App was torn down while the model was loading — destroy the orphan.
        try { model.destroy(); } catch {}
        return;
      }
      modelRef.current = model;

      // Auto-focus on pointer (gaze tracking)
      model.trackPointer = gaze;
      model.anchor.set(0.5, 0.5);
      
      app.stage.addChild(model);
      
      eyeBlinkRef.current = model.internalModel?.eyeBlink ?? null;
      physicsRef.current = model.internalModel?.physics ?? null;
      
      // Position and scale
      let scale = charData.scale * scaleMul;
      if (window.innerWidth < 768) {
        scale = scale * 0.75;
      }
      model.scale.set(flip ? -scale : scale);
      
      if (layoutMode === 'widget') {
        model.position.set(app.renderer.width / 2, app.renderer.height / 2 + (charData.offsetY * 0.4) + posOff);
        model.scale.set(flip ? -scale * 0.6 : scale * 0.6);
      } else {
        model.position.set(app.renderer.width / 2 + charData.offsetX, app.renderer.height / 2 + charData.offsetY + posOff);
      }

      // Build motions and expressions lists
      const motions = model.internalModel?.settings?.motions || {};
      const uniqueMotions = new Set<string>();
      for (const [, list] of Object.entries(motions) as any) {
        list.forEach((m: any) => {
          const file = m.File || m.file;
          if (file) {
            const parts = file.split('/');
            const name = parts[parts.length - 1].replace('.motion3.json', '');
            uniqueMotions.add(name);
          }
        });
      }
      if (uniqueMotions.size === 0) {
        uniqueMotions.add("idle");
        uniqueMotions.add("home");
      }
      setMotionsList(Array.from(uniqueMotions));

      const expressions = model.internalModel?.settings?.expressions || [];
      setExpressionsList(expressions.map((exp: any, index: number) => exp.Name || exp.name || `表情 ${index + 1}`));

      setTimeout(() => {
        triggerVoiceAndMotion("login");
      }, 800);

      setPhase("ready");
    } catch (error) {
      console.error("Landing demo model load failed", error);
      setPhase("error");
    }
  }, [gaze, scaleMul, flip, layoutMode, posOff, stopCurrentVoice, triggerVoiceAndMotion]);

  // Initial load / cleanup on layoutMode changes
  useEffect(() => {
    if (layoutMode !== "sidebar") return;

    let active = true;

    const init = async () => {
      try {
        for (const src of SCRIPTS) await loadScript(src);
        if (!active) return;

        const w = window as any;
        const PIXI = w.PIXI;
        const host = stageHostRef.current;
        if (!PIXI?.live2d?.Live2DModel || !host) throw new Error("Live2D runtime unavailable");

        // Mock Live2DCubismCore memory allocator if not defined
        w.Live2DCubismCore = w.Live2DCubismCore || {};
        w.Live2DCubismCore.Memory = w.Live2DCubismCore.Memory || {
          initializeAmountOfMemory: function(size: number) {
            console.log('Mocked Live2DCubismCore.Memory.initializeAmountOfMemory called with size:', size);
          }
        };

        // Patch clipping context list to prevent crashing on WebGL contexts
        const Cubism4InternalModel = w.PIXI.live2d?.Cubism4InternalModel;
        if (Cubism4InternalModel) {
          const originalUpdateWebGLContext = Cubism4InternalModel.prototype.updateWebGLContext;
          Cubism4InternalModel.prototype.updateWebGLContext = function (gl: any, glContextID: any) {
            if (this.renderer && !this.renderer._clippingManager) {
              this.renderer._clippingManager = new Proxy({}, {
                get(target: any, prop: any) {
                  if (prop === '_currentFrameNo' || prop === '_maskTexture') {
                    return target[prop];
                  }
                  return function() {
                    if (prop === 'getRenderTextureCount' || prop === 'getClippingMaskBufferSize') {
                      return 0;
                    }
                    if (prop === 'getClippingContextListForDraw') {
                      return [];
                    }
                    return undefined;
                  };
                },
                set(target: any, prop: any, value: any) {
                  target[prop] = value;
                  return true;
                }
              });
            }
            originalUpdateWebGLContext.call(this, gl, glContextID);
          };
        }

        if (w.PIXI.live2d?.Live2DModel) {
          w.PIXI.live2d.Live2DModel.registerTicker(PIXI.Ticker);
        }

        // Destroy any existing application to be safe
        if (appRef.current) {
          try {
            appRef.current.destroy(true, { children: true });
          } catch {}
          appRef.current = null;
        }

        const app = new PIXI.Application({
          autoStart: true,
          backgroundAlpha: 0,
          resizeTo: host,
          antialias: true,
        });

        if (!active) {
          app.destroy(true, { children: true });
          return;
        }

        // Pixi owns this canvas; mount it into our React host once.
        const view = app.view as HTMLCanvasElement;
        viewRef.current = view;
        host.replaceChildren(view);

        appRef.current = app;

        const char = CHARACTERS[charIdxRef.current];
        setBgTheme(char.bgTheme);
        await loadModel(char.modelPath, char);
        loadedCharIdxRef.current = charIdxRef.current;
      } catch (error) {
        console.error("Landing demo init failed", error);
        if (active) {
          setPhase("error");
        }
      }
    };

    init();

    return () => {
      active = false;
      if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
      stopCurrentVoice();
      modelRef.current?.destroy();
      modelRef.current = null;
      if (appRef.current) {
        try {
          appRef.current.destroy(true, { children: true });
        } catch (e) {
          console.warn("Error destroying Pixi app in landing demo:", e);
        }
        appRef.current = null;
      }
    };
  }, [layoutMode, loadModel, setBgTheme, stopCurrentVoice]);

  // Hot-swap character when selection changes. Note: we deliberately do NOT reset
  // the background here — only the initial load applies a character's default
  // scene, so a user's chosen scene survives character switches.
  useEffect(() => {
    if (layoutMode !== "sidebar") return;
    if (loadedCharIdxRef.current === charIdx) return;

    const char = CHARACTERS[charIdx];
    loadModel(char.modelPath, char);
    loadedCharIdxRef.current = charIdx;
  }, [charIdx, loadModel, layoutMode]);

  // Handle transformations
  useEffect(() => {
    if (layoutMode !== "sidebar") return;
    const model = modelRef.current;
    const app = appRef.current;
    if (phase !== "ready" || !model || !app) return;
    
    const charData = CHARACTERS[charIdx];
    let scale = charData.scale * scaleMul;
    if (window.innerWidth < 768) {
      scale = scale * 0.75;
    }
    model.scale.set(flip ? -scale : scale);
    model.position.set(app.renderer.width / 2 + charData.offsetX, app.renderer.height / 2 + charData.offsetY + posOff);
  }, [phase, scaleMul, flip, posOff, charIdx, layoutMode]);

  // Live2D Settings Toggles
  useEffect(() => {
    if (layoutMode !== "sidebar") return;
    if (phase !== "ready") return;
    const im = modelRef.current?.internalModel;
    // eslint-disable-next-line react-hooks/immutability
    if (im) im.eyeBlink = blink ? eyeBlinkRef.current : undefined;
  }, [phase, blink, layoutMode]);

  useEffect(() => {
    if (layoutMode !== "sidebar") return;
    if (phase !== "ready") return;
    const im = modelRef.current?.internalModel;
    // eslint-disable-next-line react-hooks/immutability
    if (im) im.physics = physics ? physicsRef.current : undefined;
  }, [phase, physics, layoutMode]);

  useEffect(() => {
    if (layoutMode !== "sidebar") return;
    if (modelRef.current) {
      (modelRef.current as any).trackPointer = gaze;
    }
  }, [gaze, layoutMode]);

  // Gaze cursor tracking on canvas pointermove
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const model = modelRef.current;
    const canvas = stageHostRef.current;
    if (!model?.focus || !canvas || !gaze) return;
    const rect = canvas.getBoundingClientRect();
    model.focus(e.clientX - rect.left, e.clientY - rect.top);
  }, [gaze]);

  // Stage tap/click → model touch reaction. (The widget/desktop-pet branch
  // renders a placeholder card and never mounts this stage, so there is no
  // in-stage drag handling here — dragging lives in desktop-pet.)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    handleStageTap(e.clientX, e.clientY);
  };

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      const model = modelRef.current;
      const app = appRef.current;
      if (app) {
        (app as any).resize();
      }
      if (model && app) {
        const charData = CHARACTERS[charIdx];
        let scale = charData.scale * scaleMul;
        if (window.innerWidth < 768) {
          scale = scale * 0.75;
        }
        model.scale.set(flip ? -scale : scale);
        if (layoutMode === "widget") {
          model.position.set(app.renderer.width / 2, app.renderer.height / 2 + (charData.offsetY * 0.4) + posOff);
        } else {
          model.position.set(app.renderer.width / 2 + charData.offsetX, app.renderer.height / 2 + charData.offsetY + posOff);
        }
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [charIdx, scaleMul, flip, layoutMode, posOff]);


  // Subtitle positioning relative to model bounds
  useEffect(() => {
    if (!subtitle || !modelRef.current || layoutMode === 'widget') {
      setSubtitlePos({ left: '50%', top: '10%' });
      return;
    }
    try {
      const bounds = (modelRef.current as any).getBounds();
      setSubtitlePos({
        left: `${bounds.x + bounds.width / 2}px`,
        top: `${bounds.y - 120}px`
      });
    } catch {
      setSubtitlePos({ left: '50%', top: '10%' });
    }
  }, [subtitle, layoutMode]);

  // Handle BGM play state
  useEffect(() => {
    const player = bgmPlayerRef.current;
    if (!player) return;
    if (bgmPlaying) {
      player.play().catch((err) => console.warn("BGM play blocked:", err));
    } else {
      player.pause();
    }
  }, [bgmPlaying]);

  const translateMotionName = (name: string) => {
    const dict: Record<string, string> = {
      "idle": "空闲等待",
      "idle1": "随性站姿",
      "home": "主界面动作",
      "login": "登录迎接",
      "mail": "收到邮件",
      "mission": "查看任务",
      "mission_complete": "任务完成",
      "complete": "互动完成",
      "wedding": "誓约珍藏",
      "touch_head": "摸头反馈",
      "touch_body": "身体触碰",
      "touch_special": "特别触碰",
      "touch_idle": "触碰待机",
      "main_1": "对话主线 1",
      "main_2": "对话主线 2",
      "main_3": "对话主线 3",
      "effect": "特效触发"
    };
    return dict[name] || name;
  };

  const bgThemeObj = BACKGROUNDS.find((b) => b.key === bgTheme) || BACKGROUNDS[0];

  if (layoutMode === "widget") {
    return (
      <div className={styles.placeholderCard}>
        <div className={styles.placeholderIcon} aria-hidden>🧸</div>
        <h3 className={styles.placeholderTitle}>{t("demo.widgetTitle")}</h3>
        <p className={styles.placeholderText}>{t("demo.widgetText")}</p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setLayoutMode("sidebar");
            resetDragStyles();
          }}
        >
          {t("demo.toStage")}
        </Button>
      </div>
    );
  }

  const CATS: { key: TabType; label: string; icon: IconName }[] = [
    { key: "motions", label: t("demo.tabMotions"), icon: "motions" },
    { key: "expressions", label: t("demo.tabExpressions"), icon: "expressions" },
    { key: "audio", label: t("demo.tabAudio"), icon: "audio" },
    { key: "scenes", label: t("demo.tabScenes"), icon: "scenes" },
  ];

  // Normalize any stale persisted tab (e.g. the removed "skins"/"characters").
  const tab: TabType = CATS.some((c) => c.key === activeTab) ? activeTab : "motions";

  const onTabClick = (key: TabType) => {
    if (sidebarOpen && tab === key) {
      setSidebarOpen(false);
    } else {
      setActiveTab(key);
      setSidebarOpen(true);
    }
  };

  return (
    <div className={styles.root}>
      <div 
        ref={stageRef}
        className={styles.stage} 
        onPointerMove={onPointerMove} 
        onPointerDown={handlePointerDown}
      >
        <div
          className={styles.bg}
          style={{ background: bgThemeObj.css }}
          aria-hidden
        />
        <div ref={stageHostRef} className={styles.canvas} />

        {phase === "loading" ? <div className={styles.hint}>{t("modelLoading")}</div> : null}
        {phase === "error" ? <div className={styles.hint}>{t("modelLoadFailed")}</div> : null}

        {phase === "ready" ? (
          <>
            {/* Bilingual Subtitle Speech Bubble */}
            {subtitle && (
              <div 
                className={styles.speechBubble} 
                style={{
                  left: subtitlePos.left,
                  top: subtitlePos.top,
                }}
              >
                <div className={styles.bubbleArrow} />
                <div className={styles.speechTextJp}>⚓ {subtitle.title}</div>
                <div className={styles.speechTextZh}>{subtitle.text}</div>
              </div>
            )}

            {/* Disclaimer marker (bottom-right) */}
            <span className={styles.demoTag}>{t("demoTag")}</span>
          </>
        ) : null}
      </div>

      {/* Hover-revealed control overlay — buttons appear when the card is hovered
          (always visible on touch devices via @media (hover: none)). */}
      <div className={styles.controls}>
        {/* Top-left: character switch (dropdown list) */}
        <div 
          className={cx(styles.dropdownContainer, styles.cornerTL)}
          onMouseEnter={() => {
            if (charMenuTimeoutRef.current) {
              clearTimeout(charMenuTimeoutRef.current);
              charMenuTimeoutRef.current = null;
            }
            setCharMenuOpen(true);
          }}
          onMouseLeave={() => {
            charMenuTimeoutRef.current = setTimeout(() => {
              setCharMenuOpen(false);
            }, 300);
          }}
        >
          <button
            type="button"
            className={styles.dropdownBtn}
            title={t("switchCharacter")}
            aria-label={t("switchCharacter")}
            onClick={() => setCharMenuOpen(true)}
            aria-expanded={charMenuOpen}
          >
            <Icon name="character" size={16} />
            <span className={styles.charLabel}>{CHARACTERS[charIdx].nameCn}</span>
            <span className={styles.caret}>▾</span>
          </button>
          {charMenuOpen && (
            <div className={styles.dropdownMenu}>
              {CHARACTERS.map((char, idx) => (
                <button
                  key={char.key}
                  type="button"
                  className={cx(styles.dropdownItem, charIdx === idx && styles.dropdownItemActive)}
                  onClick={() => {
                    setCharIdx(idx);
                    setCharMenuOpen(false);
                  }}
                >
                  {char.nameCn}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Top-right: desktop-pet toggle */}
        <button
          type="button"
          className={cx(styles.cornerBtn, styles.cornerTR)}
          title={t("demo.toWidget")}
          aria-label={t("demo.toWidget")}
          onClick={() => {
            if (stageHostRef.current) {
              const rect = stageHostRef.current.getBoundingClientRect();
              setWidgetPos({ x: rect.left, y: rect.top });
            }
            setLayoutMode("widget");
          }}
        >
          <Icon name="pet" />
        </button>

        {/* Bottom dock and panel wrapper */}
        <div 
          className={styles.dockWrapper}
          onMouseEnter={() => {
            if (sidebarTimeoutRef.current) {
              clearTimeout(sidebarTimeoutRef.current);
              sidebarTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            sidebarTimeoutRef.current = setTimeout(() => {
              setSidebarOpen(false);
            }, 300);
          }}
        >
          {/* Popover control panel — floats above the dock so the model stays the star. */}
          {sidebarOpen && (
            <div 
              className={styles.panel} 
              role="group" 
              aria-label={t("demo.consoleTitle")}
            >
              <div className={styles.panelTop}>
                <span className={styles.panelTitle}>
                  {CATS.find((c) => c.key === tab)?.label}
                </span>
              </div>

              <div className={styles.panelBody}>
                {/* Motions */}
                {tab === "motions" && (
                  <div className={styles.chipGrid}>
                    {motionsList.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={styles.chip}
                        onClick={() => {
                          triggerMotion(m);
                          const motionMapping: Record<string, string> = {
                            login: "login",
                            home: "home",
                            touch_head: "headtouch",
                            touch_body: "touch",
                            touch_special: "touch2",
                            main_1: "main1",
                            main_2: "main2",
                            main_3: "main3",
                            mission_complete: "mission_complete",
                            mission: "mission",
                          };
                          const revMapping = Object.fromEntries(
                            Object.entries(motionMapping).map(([k, v]) => [v, k])
                          );
                          const voiceKey = revMapping[m];
                          if (voiceKey) playVoice(voiceKey);
                        }}
                      >
                        {translateMotionName(m)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Expressions */}
                {tab === "expressions" && (
                  <div className={styles.chipGrid}>
                    {expressionsList.length > 0 ? (
                      expressionsList.map((exp, idx) => (
                        <button
                          key={exp}
                          type="button"
                          className={cx(styles.chip, styles.chipMuted)}
                          onClick={() => triggerExpression(idx)}
                        >
                          {exp.replace(".exp3.json", "")}
                        </button>
                      ))
                    ) : (
                      <span className={styles.emptyHint}>{t("demo.expressionsHeading")}—</span>
                    )}
                  </div>
                )}

                {/* Audio */}
                {tab === "audio" && (
                  <div className={styles.stack}>
                    <div className={styles.sliderRow}>
                      <span className={styles.sliderLabel}>{t("demo.voiceVolume")}</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={voiceVolume}
                        onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                        aria-label={t("demo.voiceVolume")}
                      />
                    </div>
                    <div className={styles.audioButtons}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const randomEvents = ["home", "login", "touch", "main1", "main2", "main3"];
                          const rnd = randomEvents[Math.floor(Math.random() * randomEvents.length)];
                          triggerVoiceAndMotion(rnd);
                        }}
                      >
                        {t("demo.randomInteract")}
                      </Button>
                      <Button
                        variant={bgmPlaying ? "primary" : "tintPink"}
                        size="sm"
                        onClick={() => setBgmPlaying(!bgmPlaying)}
                      >
                        {bgmPlaying ? t("demo.bgmPause") : t("demo.bgmPlay")}
                      </Button>
                    </div>
                    <div className={styles.statusRow}>
                      <span>{t("demo.bgmStatusLabel")}</span>
                      <span className={cx(styles.statusVal, bgmPlaying && styles.statusOn)}>
                        {bgmPlaying ? t("demo.bgmOn") : t("demo.bgmOff")}
                      </span>
                    </div>
                  </div>
                )}

                {/* Scenes */}
                {tab === "scenes" && (
                  <div className={styles.chipGrid}>
                    {BACKGROUNDS.map((bg) => (
                      <button
                        key={bg.key}
                        type="button"
                        className={cx(styles.chip, bgTheme === bg.key && styles.chipActive)}
                        onClick={() => setBgTheme(bg.key)}
                      >
                        {t(`demo.${bg.labelKey}`)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={styles.dock}>
            {CATS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={cx(styles.dockTab, sidebarOpen && tab === c.key && styles.dockTabActive)}
                title={c.label}
                aria-label={c.label}
                onClick={() => onTabClick(c.key)}
                onMouseEnter={() => {
                  setActiveTab(c.key);
                  setSidebarOpen(true);
                }}
              >
                <Icon name={c.icon} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Self-hosted ambient BGM */}
      <audio ref={bgmPlayerRef} loop src="/audio/ambient.ogg" />
    </div>
  );
}

// Modern line-icon set (Lucide geometry), shared by the demo stage and the desktop pet.
export type IconName =
  | "character"
  | "pet"
  | "motions"
  | "expressions"
  | "audio"
  | "scenes"
  | "chat"
  | "voice"
  | "shuffle"
  | "close"
  | "settings"
  | "shirt";

const ICON_PATHS: Record<IconName, ReactNode> = {
  character: (
    <>
      <path d="M12 2 2 7v10l10 5 10-5V7Z" />
      <circle cx="12" cy="11" r="3" />
      <path d="M8 17a4 4 0 0 1 8 0" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </>
  ),
  pet: (
    <>
      <path d="M3 10V5l4 4h10l4-4v5l-2 3v4l-4 3H9l-4-3v-4Z" />
      <rect x="7" y="11" width="3" height="2" rx="0.5" />
      <rect x="14" y="11" width="3" height="2" rx="0.5" />
      <path d="M11 15h2l-1 1Z" />
    </>
  ),
  motions: (
    <>
      <path d="M4 8V4h4" />
      <path d="M16 4h4v4" />
      <path d="M4 16v4h4" />
      <path d="M16 20h4v-4" />
      <line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth={2.5} />
      <line x1="12" y1="7" x2="12" y2="17" />
      <circle cx="12" cy="5" r="1.5" />
      <path d="m9 10 3 1 3-1" />
      <path d="m10 17 2-3 2 3" />
    </>
  ),
  expressions: (
    <>
      <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8Z" />
      <line x1="8" y1="10" x2="10" y2="10" />
      <line x1="14" y1="10" x2="16" y2="10" />
      <path d="M9 14h6" />
      <path d="M9 14v1a3 3 0 0 0 6 0v-1" />
    </>
  ),
  audio: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
    </>
  ),
  scenes: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="4" />
      <line x1="3" y1="13" x2="21" y2="13" />
      <line x1="12" y1="13" x2="12" y2="21" />
      <line x1="12" y1="13" x2="6" y2="21" />
      <line x1="12" y1="13" x2="18" y2="21" />
      <circle cx="12" cy="9" r="3" />
    </>
  ),
  chat: (
    <>
      <path d="M4 6h16v10h-4l-4 4-4-4H4V6Z" />
      <circle cx="8" cy="11" r="1" />
      <circle cx="12" cy="11" r="1" />
      <circle cx="16" cy="11" r="1" />
    </>
  ),
  voice: (
    <>
      <path d="M3 10v4" />
      <path d="M6 6v12" />
      <path d="M9 11v2" />
      <path d="M12 3v18" />
      <path d="M15 8v8" />
      <path d="M18 5v14" />
      <path d="M21 9v6" />
      <path d="M12 3h2" />
      <path d="M12 21h-2" />
    </>
  ),
  shuffle: (
    <>
      <path d="M18 8h4v-4" />
      <path d="M22 8 15 15" />
      <path d="M6 16H2v4" />
      <path d="M2 16 9 9" />
      <circle cx="4" cy="6" r="2" />
      <circle cx="20" cy="18" r="2" />
      <path d="M6 6h6l8 8" />
    </>
  ),
  close: (
    <>
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
      <path d="M4 8V4h4" />
      <path d="M16 4h4v4" />
      <path d="M4 16v4h4" />
      <path d="M16 20h4v-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="9" strokeDasharray="4 2" />
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <circle cx="6" cy="6" r="1" />
      <circle cx="18" cy="18" r="1" />
    </>
  ),
  shirt: (
    <>
      <path d="M12 2 6 5v4l3 3v6l3 2 3-2v-6l3-3V5Z" />
      <circle cx="12" cy="9" r="1.5" />
      <path d="M9 5h6" />
      <line x1="6" y1="9" x2="18" y2="9" />
    </>
  ),
};

export function Icon({ name, size = 19 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
