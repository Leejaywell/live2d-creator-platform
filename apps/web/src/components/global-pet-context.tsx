"use client";

import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from "react";

export type LayoutMode = "sidebar" | "widget";
export type TabType = "skins" | "motions" | "expressions" | "audio" | "scenes";

export interface WidgetPosition {
  x: number;
  y: number;
}

interface GlobalPetContextType {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  petOpen: boolean;
  setPetOpen: (open: boolean) => void;
  charIdx: number;
  setCharIdx: (idx: number) => void;
  bgmPlaying: boolean;
  setBgmPlaying: (playing: boolean) => void;
  voiceVolume: number;
  setVoiceVolume: (volume: number) => void;
  widgetPos: WidgetPosition | null;
  setWidgetPos: (pos: WidgetPosition | null) => void;
  bgTheme: string;
  setBgTheme: (theme: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  
  // Settings Parameters
  petScale: number;
  setPetScale: (scale: number) => void;
  petOffsetX: number;
  setPetOffsetX: (x: number) => void;
  petOffsetY: number;
  setPetOffsetY: (y: number) => void;
  petGaze: boolean;
  setPetGaze: (gaze: boolean) => void;
  petBlink: boolean;
  setPetBlink: (blink: boolean) => void;
  petPhysics: boolean;
  setPetPhysics: (physics: boolean) => void;
  randomExpression: boolean;
  setRandomExpression: (rand: boolean) => void;
  randomMotion: boolean;
  setRandomMotion: (rand: boolean) => void;
  randomVoice: boolean;
  setRandomVoice: (rand: boolean) => void;
}

const GlobalPetContext = createContext<GlobalPetContextType | undefined>(undefined);

export function GlobalPetProvider({ children }: { children: React.ReactNode }) {
  // States with default fallback values for SSR
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>("sidebar");
  const [petOpen, setPetOpenState] = useState<boolean>(true);
  const [charIdx, setCharIdxState] = useState<number>(0);
  const [bgmPlaying, setBgmPlayingState] = useState<boolean>(false);
  const [voiceVolume, setVoiceVolumeState] = useState<number>(0.8);
  const [widgetPos, setWidgetPosState] = useState<WidgetPosition | null>(null);
  const [bgTheme, setBgThemeState] = useState<string>("aurora");
  const [sidebarOpen, setSidebarOpenState] = useState<boolean>(false);
  const [activeTab, setActiveTabState] = useState<TabType>("motions");

  // New settings parameters
  const [petScale, setPetScaleState] = useState<number>(1.0);
  const [petOffsetX, setPetOffsetXState] = useState<number>(0);
  const [petOffsetY, setPetOffsetYState] = useState<number>(0);
  const [petGaze, setPetGazeState] = useState<boolean>(true);
  const [petBlink, setPetBlinkState] = useState<boolean>(true);
  const [petPhysics, setPetPhysicsState] = useState<boolean>(true);
  const [randomExpression, setRandomExpressionState] = useState<boolean>(true);
  const [randomMotion, setRandomMotionState] = useState<boolean>(true);
  const [randomVoice, setRandomVoiceState] = useState<boolean>(true);

  // Load from localStorage on client-side mount
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const storedLayout = localStorage.getItem("pet_layout_mode") as LayoutMode | null;
      const storedPetOpen = localStorage.getItem("pet_open");
      const storedCharIdx = localStorage.getItem("pet_char_idx");
      const storedBgm = localStorage.getItem("pet_bgm_playing");
      const storedVolume = localStorage.getItem("pet_voice_volume");
      const storedPos = localStorage.getItem("pet_widget_pos");
      const storedBgTheme = localStorage.getItem("pet_bg_theme");
      const storedSidebarOpen = localStorage.getItem("pet_sidebar_open");
      const storedActiveTab = localStorage.getItem("pet_active_tab") as TabType | null;

      // Loaded Settings
      const storedPetScale = localStorage.getItem("pet_scale");
      const storedPetOffsetX = localStorage.getItem("pet_offset_x");
      const storedPetOffsetY = localStorage.getItem("pet_offset_y");
      const storedPetGaze = localStorage.getItem("pet_gaze");
      const storedPetBlink = localStorage.getItem("pet_blink");
      const storedPetPhysics = localStorage.getItem("pet_physics");
      const storedRandomExpression = localStorage.getItem("pet_random_expression");
      const storedRandomMotion = localStorage.getItem("pet_random_motion");
      const storedRandomVoice = localStorage.getItem("pet_random_voice");

      if (storedLayout) setLayoutModeState(storedLayout);
      if (storedPetOpen !== null) setPetOpenState(storedPetOpen === "true");
      if (storedCharIdx !== null) setCharIdxState(parseInt(storedCharIdx, 10));
      if (storedBgm !== null) setBgmPlayingState(storedBgm === "true");
      if (storedVolume !== null) setVoiceVolumeState(parseFloat(storedVolume));
      if (storedPos) setWidgetPosState(JSON.parse(storedPos));
      if (storedBgTheme) setBgThemeState(storedBgTheme);
      if (storedSidebarOpen !== null) setSidebarOpenState(storedSidebarOpen === "true");
      if (storedActiveTab) setActiveTabState(storedActiveTab);

      if (storedPetScale !== null) setPetScaleState(parseFloat(storedPetScale));
      if (storedPetOffsetX !== null) setPetOffsetXState(parseInt(storedPetOffsetX, 10));
      if (storedPetOffsetY !== null) setPetOffsetYState(parseInt(storedPetOffsetY, 10));
      if (storedPetGaze !== null) setPetGazeState(storedPetGaze === "true");
      if (storedPetBlink !== null) setPetBlinkState(storedPetBlink === "true");
      if (storedPetPhysics !== null) setPetPhysicsState(storedPetPhysics === "true");
      if (storedRandomExpression !== null) setRandomExpressionState(storedRandomExpression === "true");
      if (storedRandomMotion !== null) setRandomMotionState(storedRandomMotion === "true");
      if (storedRandomVoice !== null) setRandomVoiceState(storedRandomVoice === "true");
    } catch (e) {
      console.warn("Failed to load pet settings from localStorage:", e);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Setter wrappers that also save to localStorage.
  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutModeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_layout_mode", mode);
    }
  }, []);

  const setPetOpen = useCallback((open: boolean) => {
    setPetOpenState(open);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_open", String(open));
    }
  }, []);

  const setCharIdx = useCallback((idx: number) => {
    setCharIdxState(idx);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_char_idx", String(idx));
    }
  }, []);

  const setBgmPlaying = useCallback((playing: boolean) => {
    setBgmPlayingState(playing);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_bgm_playing", String(playing));
    }
  }, []);

  const setVoiceVolume = useCallback((volume: number) => {
    setVoiceVolumeState(volume);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_voice_volume", String(volume));
    }
  }, []);

  const setWidgetPos = useCallback((pos: WidgetPosition | null) => {
    setWidgetPosState(pos);
    if (typeof window !== "undefined") {
      if (pos) {
        localStorage.setItem("pet_widget_pos", JSON.stringify(pos));
      } else {
        localStorage.removeItem("pet_widget_pos");
      }
    }
  }, []);

  const setBgTheme = useCallback((theme: string) => {
    setBgThemeState(theme);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_bg_theme", theme);
    }
  }, []);

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_sidebar_open", String(open));
    }
  }, []);

  const setActiveTab = useCallback((tab: TabType) => {
    setActiveTabState(tab);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_active_tab", tab);
    }
  }, []);

  const setPetScale = useCallback((scale: number) => {
    setPetScaleState(scale);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_scale", String(scale));
    }
  }, []);

  const setPetOffsetX = useCallback((x: number) => {
    setPetOffsetXState(x);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_offset_x", String(x));
    }
  }, []);

  const setPetOffsetY = useCallback((y: number) => {
    setPetOffsetYState(y);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_offset_y", String(y));
    }
  }, []);

  const setPetGaze = useCallback((gaze: boolean) => {
    setPetGazeState(gaze);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_gaze", String(gaze));
    }
  }, []);

  const setPetBlink = useCallback((blink: boolean) => {
    setPetBlinkState(blink);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_blink", String(blink));
    }
  }, []);

  const setPetPhysics = useCallback((physics: boolean) => {
    setPetPhysicsState(physics);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_physics", String(physics));
    }
  }, []);

  const setRandomExpression = useCallback((rand: boolean) => {
    setRandomExpressionState(rand);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_random_expression", String(rand));
    }
  }, []);

  const setRandomMotion = useCallback((rand: boolean) => {
    setRandomMotionState(rand);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_random_motion", String(rand));
    }
  }, []);

  const setRandomVoice = useCallback((rand: boolean) => {
    setRandomVoiceState(rand);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_random_voice", String(rand));
    }
  }, []);

  const value = useMemo(
    () => ({
      layoutMode,
      setLayoutMode,
      petOpen,
      setPetOpen,
      charIdx,
      setCharIdx,
      bgmPlaying,
      setBgmPlaying,
      voiceVolume,
      setVoiceVolume,
      widgetPos,
      setWidgetPos,
      bgTheme,
      setBgTheme,
      sidebarOpen,
      setSidebarOpen,
      activeTab,
      setActiveTab,
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
      setRandomVoice,
    }),
    [
      layoutMode,
      setLayoutMode,
      petOpen,
      setPetOpen,
      charIdx,
      setCharIdx,
      bgmPlaying,
      setBgmPlaying,
      voiceVolume,
      setVoiceVolume,
      widgetPos,
      setWidgetPos,
      bgTheme,
      setBgTheme,
      sidebarOpen,
      setSidebarOpen,
      activeTab,
      setActiveTab,
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
      setRandomVoice,
    ]
  );

  return <GlobalPetContext.Provider value={value}>{children}</GlobalPetContext.Provider>;
}

export function useGlobalPet() {
  const context = useContext(GlobalPetContext);
  if (!context) {
    throw new Error("useGlobalPet must be used within a GlobalPetProvider");
  }
  return context;
}
