"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useGlobalPet } from "./global-pet-context";
import { CHARACTERS, SCRIPTS, loadScript, CharacterConfig, Icon, CHARACTER_SKINS } from "./landing-demo";
import styles from "./desktop-pet.module.css";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/refs, react-hooks/immutability */

type PixiApp = {
  stage: { addChild(c: unknown): void; removeChild(c: unknown): void };
  renderer: { width: number; height: number };
  destroy(removeView?: boolean, opts?: { children?: boolean }): void;
  resize(): void;
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
  };
  motion?: (group: string, index?: number) => void;
  expression?: (index: number) => void;
  focus?: (x: number, y: number) => void;
  destroy(): void;
  on(event: string, callback: (...args: any[]) => void): void;
};

export function DesktopPet() {
  const pathname = usePathname();
  const locale = useLocale();
  
  const {
    layoutMode,
    setLayoutMode,
    petOpen,
    setPetOpen,
    charIdx,
    setCharIdx,
    voiceVolume,
    widgetPos,
    setWidgetPos,
    bgmPlaying,
    setBgmPlaying,
    petScale,
    setPetScale,
    petOffsetX,
    setPetOffsetX,
    petOffsetY,
    setPetOffsetY,
    petGaze,
    setPetGaze,
    petBlink,
    setPetBlink,
    petPhysics,
    setPetPhysics,
    randomExpression,
    setRandomExpression,
    randomMotion,
    setRandomMotion,
    randomVoice,
    setRandomVoice
  } = useGlobalPet();

  // React owns this host div; PixiJS creates and owns the <canvas> inside it so
  // destroying the app never touches a React-managed node (see landing-demo.tsx).
  const viewHostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PixiApp | null>(null);
  const modelRef = useRef<ModelInstance | null>(null);
  const voicePlayerRef = useRef<HTMLAudioElement | null>(null);
  const bgmPlayerRef = useRef<HTMLAudioElement | null>(null);
  const subtitleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eyeBlinkRef = useRef<any>(null);
  const physicsRef = useRef<any>(null);
  const petCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charIdxRef = useRef(charIdx);
  useEffect(() => {
    charIdxRef.current = charIdx;
  }, [charIdx]);
  const loadedCharIdxRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [audioConfig, setAudioConfig] = useState<any>(null);
  const [subtitle, setSubtitle] = useState<{ title: string; text: string } | null>(null);
  const [subtitlePos, setSubtitlePos] = useState({ left: "50%", top: "-10px" });

  // Motions/Expressions dynamic lists
  const [petMotions, setPetMotions] = useState<string[]>([]);
  const [petExpressions, setPetExpressions] = useState<string[]>([]);

  // Expanded lists / settings states
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeList, setActiveList] = useState<"expressions" | "motions" | "voices" | "skins" | "characters" | null>(null);
  const [selectedSkinIdMap, setSelectedSkinIdMap] = useState<Record<string, string>>({
    "shengluyisi_3": "skin1",
    "beierfasite_2": "skin1",
    "aidang_2": "skin1",
    "aijier_3": "skin1"
  });

  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const isResizingRef = useRef(false);
  const resizeStartScaleRef = useRef(1.0);
  const resizeStartPosRef = useRef({ x: 0, y: 0 });

  // Only render if in widget mode, and only on admin or home routes
  const isHomePage = pathname === "/";
  const isAdminPage = pathname.startsWith("/admin");
  const shouldRender = layoutMode === "widget" && (isHomePage || isAdminPage);

  // Stop active voice lines
  const stopCurrentVoice = useCallback(() => {
    if (voicePlayerRef.current) {
      voicePlayerRef.current.pause();
      voicePlayerRef.current.src = "";
      voicePlayerRef.current = null;
    }
    setSubtitle(null);
  }, []);

  // Fetch audio config once
  useEffect(() => {
    if (!shouldRender) return;
    fetch("/live2d/audio_config.json")
      .then((res) => res.json())
      .then((data) => setAudioConfig(data))
      .catch((err) => console.error("Failed to load audio config in desktop pet", err));
  }, [shouldRender]);

  // Translate motion keys
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

  // Play character voice line
  const playVoice = useCallback((eventKey: string) => {
    if (!audioConfig) return;
    const charKey = CHARACTERS[charIdx].key;
    const charMeta = audioConfig[charKey];
    if (!charMeta) return;

    let voiceData = charMeta[eventKey];
    if (!voiceData && eventKey === "headtouch") voiceData = charMeta["touch"];
    if (!voiceData && eventKey === "touch2") voiceData = charMeta["touch"];

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
    audio.volume = voiceVolume;
    voicePlayerRef.current = audio;
    
    audio.play().catch((e) => console.warn("Pet voice autoplay blocked:", e));

    audio.onended = () => {
      setSubtitle(null);
    };

    if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
    subtitleTimeoutRef.current = setTimeout(() => {
      setSubtitle(null);
    }, 8000);
  }, [audioConfig, charIdx, voiceVolume, stopCurrentVoice, locale]);

  // Trigger motions
  const triggerMotion = useCallback((motionName: string) => {
    const model = modelRef.current;
    if (!model) return;
    const motions = (model as any).internalModel?.settings?.motions || {};
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

  // Load character model
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
      if (app.destroyed || !app.stage) return;
      modelRef.current = model;
      
      model.trackPointer = true;
      model.anchor.set(0.5, 0.5);
      
      app.stage.addChild(model);
      
      eyeBlinkRef.current = model.internalModel?.eyeBlink ?? null;
      physicsRef.current = model.internalModel?.physics ?? null;
      
      // Position character center in the app window + offsets
      model.position.set(
        app.renderer.width / 2 + petOffsetX, 
        app.renderer.height / 2 + (charData.offsetY * 0.4) + petOffsetY
      );
      
      // Scale down to 60% of original scale * user preference multiplier
      const scale = charData.scale * 0.6;
      model.scale.set(scale);

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
      setPetMotions(Array.from(uniqueMotions));

      const expressions = model.internalModel?.settings?.expressions || [];
      setPetExpressions(expressions.map((exp: any, index: number) => exp.Name || exp.name || `表情 ${index + 1}`));

      setTimeout(() => {
        triggerVoiceAndMotion("login");
      }, 600);

      setPhase("ready");
    } catch (error) {
      console.error("Pet model load failed", error);
      setPhase("error");
    }
  }, [stopCurrentVoice, triggerVoiceAndMotion, petOffsetX, petOffsetY]);

  // Load pet when enabled
  useEffect(() => {
    if (!shouldRender || !petOpen) return;
    
    let active = true;

    const initPet = async () => {
      try {
        for (const src of SCRIPTS) await loadScript(src);
        if (!active) return;
        
        const w = window as any;
        const PIXI = w.PIXI;
        const host = viewHostRef.current;
        if (!PIXI?.live2d?.Live2DModel || !host) throw new Error("Live2D runtime unavailable for pet");

        // Memory allocator mock
        w.Live2DCubismCore = w.Live2DCubismCore || {};
        w.Live2DCubismCore.Memory = w.Live2DCubismCore.Memory || {
          initializeAmountOfMemory: function(size: number) {
            console.log("Mocked Cubism Core Memory initialization:", size);
          }
        };

        // Patch clipping mask bug
        const Cubism4InternalModel = w.PIXI.live2d?.Cubism4InternalModel;
        if (Cubism4InternalModel) {
          const originalUpdateWebGLContext = Cubism4InternalModel.prototype.updateWebGLContext;
          Cubism4InternalModel.prototype.updateWebGLContext = function (gl: any, glContextID: any) {
            if (this.renderer && !this.renderer._clippingManager) {
              this.renderer._clippingManager = new Proxy({}, {
                get(target: any, prop: any) {
                  if (prop === "_currentFrameNo" || prop === "_maskTexture") return target[prop];
                  return function() {
                    if (prop === "getRenderTextureCount" || prop === "getClippingMaskBufferSize") return 0;
                    if (prop === "getClippingContextListForDraw") return [];
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
          width: 300,
          height: 400,
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
        await loadModel(char.modelPath, char);
        loadedCharIdxRef.current = charIdxRef.current;
      } catch (error) {
        console.error("Pet init failed", error);
        if (active) {
          setPhase("error");
        }
      }
    };

    initPet();

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
          console.warn("Error destroying Pixi app in desktop pet:", e);
        }
        appRef.current = null;
      }
    };
  }, [shouldRender, petOpen, loadModel, stopCurrentVoice]);

  // Swap character model
  useEffect(() => {
    if (!shouldRender || !petOpen) return;
    if (loadedCharIdxRef.current === charIdx) return;
    
    const char = CHARACTERS[charIdx];
    loadModel(char.modelPath, char);
    loadedCharIdxRef.current = charIdx;
  }, [charIdx, loadModel, shouldRender, petOpen]);

  // Dynamically update model scale and position when settings change
  useEffect(() => {
    const model = modelRef.current;
    const app = appRef.current;
    if (phase !== "ready" || !model || !app) return;
    
    const char = CHARACTERS[charIdx];
    const baseScale = char.scale * 0.6;
    
    model.scale.set(baseScale);
    model.position.set(
      app.renderer.width / 2 + petOffsetX, 
      app.renderer.height / 2 + (char.offsetY * 0.4) + petOffsetY
    );
  }, [phase, charIdx, petOffsetX, petOffsetY]);

  // Dynamic eyeBlink and physics updates
  useEffect(() => {
    if (phase !== "ready") return;
    const im = modelRef.current?.internalModel;
    if (im) im.eyeBlink = petBlink ? eyeBlinkRef.current : undefined;
  }, [phase, petBlink]);

  useEffect(() => {
    if (phase !== "ready") return;
    const im = modelRef.current?.internalModel;
    if (im) im.physics = petPhysics ? physicsRef.current : undefined;
  }, [phase, petPhysics]);

  // Tracking gaze pointer movements
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!petGaze) return;
    const model = modelRef.current;
    const canvas = viewHostRef.current;
    if (!model?.focus || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    model.focus(e.clientX - rect.left, e.clientY - rect.top);
  }, [petGaze]);

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

  // Tap (not drag) on the pet → manual hit-test
  const handleViewPointerUp = useCallback((e: React.PointerEvent) => {
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.hypot(dx, dy) > 6) return;
    const model = modelRef.current as any;
    const host = viewHostRef.current;
    if (!model?.hitTest || !host) return;
    const rect = host.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hits: string[] = model.hitTest(x, y) || [];
    if (hits.length > 0) {
      reactToHit(hits);
      return;
    }
    try {
      const b = model.getBounds();
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        reactToHit([]);
      }
    } catch {
      /* bounds unavailable — ignore */
    }
  }, [reactToHit]);

  // Position Subtitles bubble
  useEffect(() => {
    if (!subtitle || !modelRef.current) return;
    try {
      const bounds = (modelRef.current as any).getBounds();
      setSubtitlePos({
        left: "50%",
        top: `${bounds.y - 40}px`
      });
    } catch {
      setSubtitlePos({ left: "50%", top: "-10px" });
    }
  }, [subtitle]);

  // Handle BGM play state
  useEffect(() => {
    if (!shouldRender || !petOpen) return;
    const player = bgmPlayerRef.current;
    if (!player) return;
    if (bgmPlaying) {
      player.play().catch((err) => console.warn("Pet BGM play blocked:", err));
    } else {
      player.pause();
    }
  }, [bgmPlaying, shouldRender, petOpen]);

  // Dragging event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Prevent dragging when clicking buttons, lists, or settings
    const target = e.target as HTMLElement;
    if (
      target.closest(`.${styles.petSideLeft}`) || 
      target.closest(`.${styles.petSideRight}`) || 
      target.closest(`.${styles.settingsPanel}`) || 
      target.closest(`.${styles.floatingList}`) ||
      target.closest(`.${styles.petCornerTL}`) ||
      target.closest("button")
    ) {
      return;
    }

    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      dragOffsetRef.current = { x: rect.left, y: rect.top };
      container.style.left = `${rect.left}px`;
      container.style.top = `${rect.top}px`;
    }
  };

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    isResizingRef.current = true;
    resizeStartScaleRef.current = petScale;
    resizeStartPosRef.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (isResizingRef.current) {
        const dx = e.clientX - resizeStartPosRef.current.x;
        // base width of widget container is 400px (with padding).
        // scale change = dx / 400
        const newScale = resizeStartScaleRef.current + (dx / 400);
        const clampedScale = Math.max(0.5, Math.min(1.8, newScale));
        setPetScale(clampedScale);
        return;
      }

      if (!isDraggingRef.current) return;
      const container = containerRef.current;
      if (container) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        const newLeft = dragOffsetRef.current.x + dx;
        const newTop = dragOffsetRef.current.y + dy;

        // Keep inside window bounds (using container width 400px, height 450px)
        const boundedLeft = Math.max(0, Math.min(window.innerWidth - (400 * petScale), newLeft));
        const boundedTop = Math.max(0, Math.min(window.innerHeight - (450 * petScale), newTop));

        container.style.left = `${boundedLeft}px`;
        container.style.top = `${boundedTop}px`;
      }
    };

    const handleGlobalPointerUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        if (typeof window !== "undefined") {
          localStorage.setItem("pet_scale", String(petScale));
        }
      }
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          setWidgetPos({ x: rect.left, y: rect.top });
        }
      }
    };

    if (shouldRender && petOpen) {
      window.addEventListener("pointermove", handleGlobalPointerMove);
      window.addEventListener("pointerup", handleGlobalPointerUp);
    }

    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
    };
  }, [shouldRender, petOpen, setWidgetPos, petScale, setPetScale]);

  // Handle closing / minimizing
  const handleClose = () => {
    stopCurrentVoice();
    if (pathname === "/") {
      setLayoutMode("sidebar");
      setPetOpen(true);
    } else {
      setPetOpen(false);
    }
  };

  // Close lists and settings on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(`.${styles.petIconBtn}`) && 
        !target.closest(`.${styles.floatingList}`) &&
        !target.closest(`.${styles.petCornerBtn}`) &&
        !target.closest(`.${styles.settingsPanel}`)
      ) {
        setActiveList(null);
        setSettingsOpen(false);
      }
    };
    if (activeList || settingsOpen) {
      window.addEventListener("mousedown", handleOutsideClick);
    }
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [activeList, settingsOpen]);

  // If path becomes homepage, auto-restore if closed
  useEffect(() => {
    if (pathname === "/" && !petOpen) {
      setPetOpen(true);
    }
  }, [pathname, petOpen, setPetOpen]);

  if (!shouldRender) return null;

  // Render minimized icon trigger on the right side if closed (only on non-homepage routes)
  if (!petOpen) {
    if (pathname === "/") return null;
    return (
      <button
        type="button"
        className={styles.restoreBtn}
        onClick={() => setPetOpen(true)}
        title="召回桌宠"
      >
        🧸
      </button>
    );
  }

  // Position settings
  const defaultLeft = typeof window !== "undefined" ? window.innerWidth - 340 : 100;
  const defaultTop = typeof window !== "undefined" ? window.innerHeight - 480 : 100;
  
  const leftPos = widgetPos ? `${widgetPos.x}px` : `${defaultLeft}px`;
  const topPos = widgetPos ? `${widgetPos.y}px` : `${defaultTop}px`;

  const xCoordinate = widgetPos ? widgetPos.x : defaultLeft;
  // Left list edge-detected direction: if true, pop inward (right), else pop outward (left)
  const popLeftInward = typeof window !== "undefined" && (xCoordinate - 130 * petScale < 10);
  // Right list edge-detected direction: if true, pop inward (left), else pop outward (right)
  const popRightInward = typeof window !== "undefined" && (xCoordinate + (400 + 130) * petScale > window.innerWidth - 10);
  // Settings panel edge-detected direction: if true, pop to the left, else pop to the right
  const popSettingsLeft = typeof window !== "undefined" && (xCoordinate + (400 + 282) * petScale > window.innerWidth - 10);

  // Available voices list keys from config
  const charKey = CHARACTERS[charIdx].key;
  const charMeta = audioConfig?.[charKey] || {};
  const voicesList = Object.keys(charMeta);

  // Handlers for side action clicks
  const handleExpressionClick = () => {
    if (randomExpression) {
      if (petExpressions.length > 0) {
        const idx = Math.floor(Math.random() * petExpressions.length);
        modelRef.current?.expression?.(idx);
      }
    } else {
      setActiveList(activeList === "expressions" ? null : "expressions");
    }
  };

  const handleActionClick = () => {
    if (randomMotion) {
      if (petMotions.length > 0) {
        const idx = Math.floor(Math.random() * petMotions.length);
        triggerMotion(petMotions[idx]);
      }
    } else {
      setActiveList(activeList === "motions" ? null : "motions");
    }
  };

  const handleVoiceClick = () => {
    if (randomVoice) {
      const randomEvents = ["home", "login", "touch", "main1", "main2", "main3"];
      triggerVoiceAndMotion(randomEvents[Math.floor(Math.random() * randomEvents.length)]);
    } else {
      setActiveList(activeList === "voices" ? null : "voices");
    }
  };

  const handleSkinClick = () => {
    setActiveList(activeList === "skins" ? null : "skins");
  };

  const handleChatClick = () => {
    const chatLines = ["main1", "main2", "main3"];
    triggerVoiceAndMotion(chatLines[Math.floor(Math.random() * chatLines.length)]);
  };

  const handleSettingsClick = () => {
    setSettingsOpen(!settingsOpen);
    setActiveList(null); // Close any active list popovers
  };

  return (
    <div
      ref={containerRef}
      className={styles.petContainer}
      style={{ 
        left: leftPos, 
        top: topPos,
        transform: `scale(${petScale})`,
        transformOrigin: "top left"
      }}
      onPointerDown={handlePointerDown}
    >
      {/* Subtitle bubble */}
      {subtitle && (
        <div 
          className={styles.speechBubble}
          style={{ top: subtitlePos.top }}
        >
          <div className={styles.bubbleArrow} />
          <div className={styles.speechTextJp}>⚓ {subtitle.title}</div>
          <div className={styles.speechTextZh}>{subtitle.text}</div>
        </div>
      )}

      {/* Live2D view */}
      <div
        className={styles.canvasWrapper}
        onPointerMove={onPointerMove}
        onPointerUp={handleViewPointerUp}
      >
        <div ref={viewHostRef} className={styles.petCanvas} />
        {phase === "loading" && <div className={styles.hint}>加载中...</div>}
        {phase === "error" && <div className={styles.hint}>加载失败</div>}
      </div>

      {/* Close button — top-right corner */}
      <button
        type="button"
        className={styles.petClose}
        title={pathname === "/" ? "返回侧栏面板展示" : "关闭桌宠"}
        aria-label="关闭桌宠"
        onClick={handleClose}
      >
        <Icon name="close" size={15} />
      </button>

      {/* Top-left character switch button (opens list) */}
      <div 
        className={styles.petCornerTL}
        onMouseEnter={() => {
          if (petCloseTimeoutRef.current) {
            clearTimeout(petCloseTimeoutRef.current);
            petCloseTimeoutRef.current = null;
          }
          setActiveList("characters");
        }}
        onMouseLeave={() => {
          petCloseTimeoutRef.current = setTimeout(() => {
            if (activeList === "characters") setActiveList(null);
          }, 300);
        }}
      >
        <button
          type="button"
          className={styles.petDropdownBtn}
          title="切换角色"
          aria-label="切换角色"
          onClick={() => setActiveList("characters")}
          aria-expanded={activeList === "characters"}
        >
          <Icon name="character" size={14} />
          <span className={styles.petCharLabel}>{CHARACTERS[charIdx].nameCn}</span>
          <span className={styles.petCaret}>▾</span>
        </button>
        {activeList === "characters" && (
          <div className={`${styles.floatingList} ${styles.floatingListTopLeft}`}>
            {CHARACTERS.map((char, idx) => (
              <button
                key={char.key}
                type="button"
                className={`${styles.floatingListItem} ${charIdx === idx ? styles.floatingListItemActive : ""}`}
                onClick={() => {
                  setCharIdx(idx);
                  setActiveList(null);
                }}
              >
                {char.nameCn}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Left-side controls (Expression, Action, Voice) */}
      <div className={styles.petSideLeft}>
        {/* Expressions */}
        <div 
          className={styles.petBtnWrapper}
          onMouseEnter={() => {
            if (petCloseTimeoutRef.current) {
              clearTimeout(petCloseTimeoutRef.current);
              petCloseTimeoutRef.current = null;
            }
            if (!randomExpression) {
              setActiveList("expressions");
            }
          }}
          onMouseLeave={() => {
            petCloseTimeoutRef.current = setTimeout(() => {
              if (activeList === "expressions") setActiveList(null);
            }, 300);
          }}
        >
          <button
            type="button"
            className={styles.petIconBtn}
            title={randomExpression ? "随机表情 (随机模式)" : "选择表情 (列表模式)"}
            aria-label="表情"
            onClick={handleExpressionClick}
          >
            <Icon name="expressions" size={17} />
          </button>
          {!randomExpression && activeList === "expressions" && (
            <div className={`${styles.floatingList} ${popLeftInward ? styles.floatingListInwardLeft : styles.floatingListOutwardLeft}`}>
              {petExpressions.length > 0 ? (
                petExpressions.map((exp, idx) => (
                  <button
                    key={exp}
                    type="button"
                    className={styles.floatingListItem}
                    onClick={() => {
                      modelRef.current?.expression?.(idx);
                      setActiveList(null);
                    }}
                  >
                    {exp.replace(".exp3.json", "")}
                  </button>
                ))
              ) : (
                <div className={styles.emptyListHint}>无可用表情</div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div 
          className={styles.petBtnWrapper}
          onMouseEnter={() => {
            if (petCloseTimeoutRef.current) {
              clearTimeout(petCloseTimeoutRef.current);
              petCloseTimeoutRef.current = null;
            }
            if (!randomMotion) {
              setActiveList("motions");
            }
          }}
          onMouseLeave={() => {
            petCloseTimeoutRef.current = setTimeout(() => {
              if (activeList === "motions") setActiveList(null);
            }, 300);
          }}
        >
          <button
            type="button"
            className={styles.petIconBtn}
            title={randomMotion ? "随机动作 (随机模式)" : "选择动作 (列表模式)"}
            aria-label="动作"
            onClick={handleActionClick}
          >
            <Icon name="motions" size={17} />
          </button>
          {!randomMotion && activeList === "motions" && (
            <div className={`${styles.floatingList} ${popLeftInward ? styles.floatingListInwardLeft : styles.floatingListOutwardLeft}`}>
              {petMotions.length > 0 ? (
                petMotions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={styles.floatingListItem}
                    onClick={() => {
                      triggerMotion(m);
                      setActiveList(null);
                    }}
                  >
                    {translateMotionName(m)}
                  </button>
                ))
              ) : (
                <div className={styles.emptyListHint}>无可用动作</div>
              )}
            </div>
          )}
        </div>

        {/* Voices */}
        <div 
          className={styles.petBtnWrapper}
          onMouseEnter={() => {
            if (petCloseTimeoutRef.current) {
              clearTimeout(petCloseTimeoutRef.current);
              petCloseTimeoutRef.current = null;
            }
            if (!randomVoice) {
              setActiveList("voices");
            }
          }}
          onMouseLeave={() => {
            petCloseTimeoutRef.current = setTimeout(() => {
              if (activeList === "voices") setActiveList(null);
            }, 300);
          }}
        >
          <button
            type="button"
            className={styles.petIconBtn}
            title={randomVoice ? "随机语音 (随机模式)" : "选择语音 (列表模式)"}
            aria-label="语音"
            onClick={handleVoiceClick}
          >
            <Icon name="voice" size={17} />
          </button>
          {!randomVoice && activeList === "voices" && (
            <div className={`${styles.floatingList} ${popLeftInward ? styles.floatingListInwardLeft : styles.floatingListOutwardLeft}`}>
              {voicesList.length > 0 ? (
                voicesList.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={styles.floatingListItem}
                    onClick={() => {
                      triggerVoiceAndMotion(v);
                      setActiveList(null);
                    }}
                  >
                    {v.toUpperCase()}
                  </button>
                ))
              ) : (
                <div className={styles.emptyListHint}>无可用语音</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right-side controls (Skin, Chat, Settings) */}
      <div className={styles.petSideRight}>
        {/* Skins */}
        <div 
          className={styles.petBtnWrapper}
          onMouseEnter={() => {
            if (petCloseTimeoutRef.current) {
              clearTimeout(petCloseTimeoutRef.current);
              petCloseTimeoutRef.current = null;
            }
            setActiveList("skins");
          }}
          onMouseLeave={() => {
            petCloseTimeoutRef.current = setTimeout(() => {
              if (activeList === "skins") setActiveList(null);
            }, 300);
          }}
        >
          <button
            type="button"
            className={styles.petIconBtn}
            title="管理皮肤"
            aria-label="皮肤"
            onClick={handleSkinClick}
          >
            <Icon name="shirt" size={17} />
          </button>
          {activeList === "skins" && (
            <div className={`${styles.floatingList} ${popRightInward ? styles.floatingListInwardRight : styles.floatingListOutwardRight}`}>
              {CHARACTER_SKINS[CHARACTERS[charIdx].key]?.map((skin) => {
                const charKey = CHARACTERS[charIdx].key;
                const activeSkinId = selectedSkinIdMap[charKey] || "skin1";
                return (
                  <button
                    key={skin.id}
                    type="button"
                    className={`${styles.floatingListItem} ${activeSkinId === skin.id ? styles.floatingListItemActive : ""}`}
                    onClick={() => {
                      setSelectedSkinIdMap((prev) => ({
                        ...prev,
                        [charKey]: skin.id
                      }));
                      setActiveList(null);
                    }}
                  >
                    {skin.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Chat */}
        <button
          type="button"
          className={styles.petIconBtn}
          title="聊天互动"
          aria-label="聊天"
          onClick={handleChatClick}
        >
          <Icon name="chat" size={17} />
        </button>

        {/* Settings */}
        <div className={styles.petBtnWrapper}>
          <button
            type="button"
            className={styles.petIconBtn}
            title="桌宠设置"
            aria-label="设置"
            onClick={handleSettingsClick}
          >
            <Icon name="settings" size={17} />
          </button>
        </div>
      </div>

      {/* Settings Overlay Panel */}
      {settingsOpen && (
        <div 
          className={`${styles.settingsPanel} ${popSettingsLeft ? styles.settingsPanelLeft : styles.settingsPanelRight}`}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseEnter={() => {
            if (settingsTimeoutRef.current) {
              clearTimeout(settingsTimeoutRef.current);
              settingsTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            settingsTimeoutRef.current = setTimeout(() => {
              setSettingsOpen(false);
            }, 300);
          }}
        >
          <div className={styles.settingsHeader}>
            <h3>桌宠设置</h3>
            <button 
              type="button" 
              className={styles.settingsCloseBtn} 
              onClick={() => setSettingsOpen(false)}
              title="关闭"
            >
              <Icon name="close" size={12} />
            </button>
          </div>

          <div className={styles.settingsBody}>
            {/* Model scale & offsets */}
            <div className={styles.settingsGroup}>
              <h4 className={styles.groupTitle}>显示参数</h4>
              <div className={styles.settingsRow}>
                <label>缩放 ({petScale.toFixed(2)}x)</label>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={petScale}
                  onChange={(e) => setPetScale(parseFloat(e.target.value))}
                />
              </div>
              <div className={styles.settingsRow}>
                <label>横向偏移 ({petOffsetX}px)</label>
                <input
                  type="range"
                  min="-120"
                  max="120"
                  step="5"
                  value={petOffsetX}
                  onChange={(e) => setPetOffsetX(parseInt(e.target.value, 10))}
                />
              </div>
              <div className={styles.settingsRow}>
                <label>纵向偏移 ({petOffsetY}px)</label>
                <input
                  type="range"
                  min="-120"
                  max="120"
                  step="5"
                  value={petOffsetY}
                  onChange={(e) => setPetOffsetY(parseInt(e.target.value, 10))}
                />
              </div>
            </div>

            {/* Interaction toggles */}
            <div className={styles.settingsGroup}>
              <h4 className={styles.groupTitle}>互动特性</h4>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={petGaze}
                  onChange={(e) => setPetGaze(e.target.checked)}
                />
                <span>视线追踪 (Gaze)</span>
              </label>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={petBlink}
                  onChange={(e) => setPetBlink(e.target.checked)}
                />
                <span>自动眨眼 (Blink)</span>
              </label>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={petPhysics}
                  onChange={(e) => setPetPhysics(e.target.checked)}
                />
                <span>物理效果 (Physics)</span>
              </label>
            </div>

            {/* Random options */}
            <div className={styles.settingsGroup}>
              <h4 className={styles.groupTitle}>随机配置</h4>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={randomExpression}
                  onChange={(e) => setRandomExpression(e.target.checked)}
                />
                <span>随机表情</span>
              </label>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={randomMotion}
                  onChange={(e) => setRandomMotion(e.target.checked)}
                />
                <span>随机动作</span>
              </label>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={randomVoice}
                  onChange={(e) => setRandomVoice(e.target.checked)}
                />
                <span>随机语音</span>
              </label>
            </div>

            {/* BGM Toggle */}
            <div className={styles.settingsGroup}>
              <h4 className={styles.groupTitle}>背景音乐</h4>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={bgmPlaying}
                  onChange={(e) => setBgmPlaying(e.target.checked)}
                />
                <span>播放环境背景音乐</span>
              </label>
            </div>
            
            {/* Reset Button */}
            <button
              type="button"
              className={styles.resetBtn}
              onClick={() => {
                setPetScale(1.0);
                setPetOffsetX(0);
                setPetOffsetY(0);
                setPetGaze(true);
                setPetBlink(true);
                setPetPhysics(true);
                setRandomExpression(true);
                setRandomMotion(true);
                setRandomVoice(true);
                setBgmPlaying(false);
              }}
            >
              恢复默认
            </button>
          </div>
        </div>
      )}

      {/* Hidden audio element for BGM */}
      <audio
        ref={bgmPlayerRef}
        loop
        src="/audio/ambient.ogg"
      />

      {/* Resize Handle */}
      <div 
        className={styles.petResizeHandle}
        onPointerDown={handleResizeStart}
        title="拖动调整大小"
      />
    </div>
  );
}
