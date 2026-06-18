"use client";

import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";

import { Live2DControls, type ControlPanel } from "./live2d-controls";
import styles from "./landing-demo.module.css";

// CDN runtime — PixiJS + Live2D Cubism Core + pixi-live2d-display (cubism4 bundle).
const SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js",
  "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
  "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js",
];

const KONO = `https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model@master/${encodeURIComponent("为美好的世界献上祝福！Fantastic Days")}`;
const AL = "https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model@master/%E7%A2%A7%E8%93%9D%E8%88%AA%E7%BA%BF%20Azue%20Lane/Azue%20Lane(JP)";

type Character = {
  key: string;
  name: string;
  type: string;
  url: string;
  // Spoken lines surface as comic bubbles above the head (these models carry no
  // bundled audio, so we show text instead of playing any voice).
  lines: { text: string; tag: string }[];
};

// Recognizable anime characters (KonoSuba — Cubism 4), each with a rich default
// motion group. Demo only; swap for licensed models in production.
const CHARACTERS: Character[] = [
  {
    key: "darkness",
    name: "达克尼斯",
    type: "御姐",
    url: `${KONO}/1033104/1033104.model3.json`,
    lines: [
      { text: "私が前衛を引き受けるわ。", tag: "担当" },
      { text: "さあ、かかってきなさい！", tag: "挑衅" },
      { text: "ふふ、もっと激しくても…いいのよ？", tag: "妄想" },
      { text: "この程度、どうということはない。", tag: "坚韧" },
    ],
  },
  {
    key: "megumin",
    name: "惠惠",
    type: "中二",
    url: `${KONO}/1024100/1024100.model3.json`,
    lines: [
      { text: "我が名はめぐみん！", tag: "中二" },
      { text: "エクスプロージョン！", tag: "爆裂" },
      { text: "爆裂魔法こそ至高！", tag: "执着" },
      { text: "ふっ…我が力に震えるがいい。", tag: "得意" },
    ],
  },
  {
    key: "aqua",
    name: "阿库娅",
    type: "活泼",
    url: `${KONO}/1013104/1013104.model3.json`,
    lines: [
      { text: "崇め奉りなさい！", tag: "女神" },
      { text: "わたしは女神アクアよ！", tag: "自夸" },
      { text: "うぅ…いじめないでよ～", tag: "哭哭" },
      { text: "パーティ組んであげる！", tag: "活泼" },
    ],
  },
  {
    key: "kazuma",
    name: "和真",
    type: "帅哥",
    url: `${KONO}/1004100/1004100.model3.json`,
    lines: [
      { text: "よう、おかえり。", tag: "招呼" },
      { text: "まあ、悪くないんじゃないか？", tag: "吐槽" },
      { text: "しょうがないな、付き合ってやるよ。", tag: "傲娇" },
      { text: "今日も平和が一番だ。", tag: "淡定" },
    ],
  },
  // ---- 游戏角色（碧蓝航线 · Cubism4 · 日语 flavor）----
  {
    key: "dafeng",
    name: "大凤",
    type: "御姐",
    url: `${AL}/dafeng_2/dafeng_2.model3.json`,
    lines: [
      { text: "おかえり、お疲れさま。", tag: "微笑" },
      { text: "あなたが来てくれて嬉しい。", tag: "脸红" },
      { text: "ふふ、今日もよく頑張ったわね。", tag: "安慰" },
      { text: "あとは私に任せて。", tag: "俏皮" },
    ],
  },
  {
    key: "atago",
    name: "爱宕",
    type: "御姐",
    url: `${AL}/aidang_2/aidang_2.model3.json`,
    lines: [
      { text: "指揮官さま、お慕いしております。", tag: "倾慕" },
      { text: "ふふ、もっと甘えてくださいね。", tag: "娇宠" },
      { text: "あなたのためなら何でも。", tag: "痴情" },
      { text: "今夜は離しませんよ？", tag: "危险" },
    ],
  },
  {
    key: "belfast",
    name: "贝尔法斯特",
    type: "御姐",
    url: `${AL}/beierfasite_2/beierfasite_2.model3.json`,
    lines: [
      { text: "おかえりなさいませ、ご主人様。", tag: "恭迎" },
      { text: "紅茶をお淹れしましょうか。", tag: "服侍" },
      { text: "わたくしにお任せを。", tag: "从容" },
      { text: "あなたさまの仰せのままに。", tag: "忠诚" },
    ],
  },
  {
    key: "stlouis",
    name: "圣路易斯",
    type: "御姐",
    url: `${AL}/shengluyisi_2/shengluyisi_2.model3.json`,
    lines: [
      { text: "あら、待っていたわ。", tag: "优雅" },
      { text: "わたくしと踊りませんこと？", tag: "邀约" },
      { text: "ふふ、見惚れた？", tag: "自信" },
      { text: "素敵な夜にしましょう。", tag: "风情" },
    ],
  },
];

const LINE_MS = 3200;

// Demo stage backgrounds (real projects use a creator-uploaded backgroundUrl).
const BACKGROUNDS = [
  { label: "聚光舞台", css: "radial-gradient(62% 52% at 50% 16%, rgba(255,108,158,0.34), transparent 70%), linear-gradient(180deg, #1c1424, #0c0a14)" },
  { label: "黄昏", css: "linear-gradient(180deg, #f6a06b 0%, #c56b9c 46%, #3a2a4a 100%)" },
  { label: "夜空", css: "radial-gradient(90% 60% at 50% 0%, #2b3066, #0b0a1a 72%)" },
  { label: "樱色", css: "linear-gradient(180deg, #ffd6e6 0%, #e7a3c6 48%, #5f4560 100%)" },
  { label: "薄荷", css: "radial-gradient(70% 60% at 50% 20%, rgba(111,231,218,0.3), transparent 70%), linear-gradient(180deg, #14201f, #0c0a14)" },
  { label: "简约暗", css: "linear-gradient(180deg, #1b1b22, #0e0c15)" },
];

type CoreModel = { setParameterValueById(id: string, value: number): void };
type InternalModel = { coreModel?: CoreModel; eyeBlink?: unknown; physics?: unknown };
type ModelInstance = {
  scale: { set(x: number, y?: number): void };
  position: { set(x: number, y: number): void };
  anchor: { set(x: number, y?: number): void };
  width: number;
  height: number;
  internalModel?: InternalModel;
  motion?: (group: string, index?: number) => void;
  focus?: (x: number, y: number) => void;
  destroy(): void;
};
type PixiApp = {
  stage: { addChild(c: unknown): void };
  renderer: { width: number; height: number };
  destroy(removeView?: boolean, opts?: { children?: boolean }): void;
};
type Win = {
  PIXI?: {
    Application: new (o: Record<string, unknown>) => PixiApp;
    live2d?: { Live2DModel: { from(url: string): Promise<ModelInstance> } };
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PixiApp | null>(null);
  const modelRef = useRef<ModelInstance | null>(null);
  const speakingRef = useRef(false);
  const mouthRaf = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseScaleRef = useRef(0.2);
  const eyeBlinkRef = useRef<unknown>(null);
  const physicsRef = useRef<unknown>(null);
  const gazeRef = useRef(true);
  const lipSyncRef = useRef(true);

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [charIdx, setCharIdx] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [charMenuOpen, setCharMenuOpen] = useState(false);
  const [bgIdx, setBgIdx] = useState(0);
  // model parameter settings
  const [scaleMul, setScaleMul] = useState(1);
  const [posOff, setPosOff] = useState(0);
  const [flip, setFlip] = useState(false);
  const [gaze, setGaze] = useState(true);
  const [blink, setBlink] = useState(true);
  const [physics, setPhysics] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [lipSync, setLipSync] = useState(true);

  const character = CHARACTERS[charIdx];
  const line = character.lines[lineIdx % character.lines.length];

  // Load (or hot-swap) a model into the existing pixi app.
  const loadModel = useCallback(async (url: string) => {
    const w = window as unknown as Win;
    const Live2DModel = w.PIXI?.live2d?.Live2DModel;
    const app = appRef.current;
    if (!Live2DModel || !app) return;
    try {
      modelRef.current?.destroy();
      modelRef.current = null;
      const model = await Live2DModel.from(url);
      modelRef.current = model;
      // Centered min-fit — robust across very different model bounds (some skins
      // are full-scene / off-center), so every character renders reliably.
      model.anchor.set(0.5, 0.5);
      const { width, height } = app.renderer;
      baseScaleRef.current = Math.min(width / (model.width || width), height / (model.height || height)) * 0.92;
      model.scale.set(baseScaleRef.current || 0.2);
      model.position.set(width / 2, height / 2);
      app.stage.addChild(model);
      // capture the runtime's blink / physics handlers so they can be toggled
      eyeBlinkRef.current = model.internalModel?.eyeBlink ?? null;
      physicsRef.current = model.internalModel?.physics ?? null;
      setPhase("ready");
    } catch (error) {
      console.error("Landing demo model load failed", error);
      setPhase("error");
    }
  }, []);

  const init = useCallback(async () => {
    try {
      for (const src of SCRIPTS) await loadScript(src);
      const w = window as unknown as Win;
      const PIXI = w.PIXI;
      const canvas = canvasRef.current;
      if (!PIXI?.live2d?.Live2DModel || !canvas) throw new Error("Live2D runtime unavailable");
      const app = new PIXI.Application({
        view: canvas,
        autoStart: true,
        backgroundAlpha: 0,
        resizeTo: canvas.parentElement ?? undefined,
        antialias: true,
      });
      appRef.current = app;
      const tick = () => {
        const core = modelRef.current?.internalModel?.coreModel;
        if (core) {
          try {
            core.setParameterValueById(
              "ParamMouthOpenY",
              speakingRef.current && lipSyncRef.current ? 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 110)) : 0,
            );
          } catch {
            /* unknown param */
          }
        }
        mouthRaf.current = requestAnimationFrame(tick);
      };
      mouthRaf.current = requestAnimationFrame(tick);
      await loadModel(CHARACTERS[0].url);
    } catch (error) {
      console.error("Landing demo init failed", error);
      setPhase("error");
    }
  }, [loadModel]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    init();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      cancelAnimationFrame(mouthRaf.current);
      modelRef.current?.destroy();
      modelRef.current = null;
      appRef.current?.destroy(false, { children: true });
      appRef.current = null;
    };
  }, [init]);

  // Hot-swap when the user switches character (initial one loaded by init()).
  const firstChar = useRef(true);
  useEffect(() => {
    if (firstChar.current) {
      firstChar.current = false;
      return;
    }
    setLineIdx(0);
    loadModel(CHARACTERS[charIdx].url);
  }, [charIdx, loadModel]);

  // Auto-play: cycle the character's lines as head bubbles, animate the mouth,
  // and play a motion for each line. No audio — text only.
  useEffect(() => {
    if (phase !== "ready") return;
    modelRef.current?.motion?.("", lineIdx % 4);
    speakingRef.current = true;
    timer.current = setTimeout(() => {
      speakingRef.current = false;
      if (autoPlay) setLineIdx((i) => i + 1);
    }, LINE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [phase, lineIdx, charIdx, autoPlay]);

  // Mirror toggles used inside the RAF loop / event handlers.
  useEffect(() => {
    gazeRef.current = gaze;
  }, [gaze]);
  useEffect(() => {
    lipSyncRef.current = lipSync;
  }, [lipSync]);

  // Transform: scale / horizontal flip / vertical offset.
  useEffect(() => {
    const model = modelRef.current;
    const app = appRef.current;
    if (phase !== "ready" || !model || !app) return;
    const base = baseScaleRef.current * scaleMul;
    model.scale.set(flip ? -base : base, base);
    model.position.set(app.renderer.width / 2, app.renderer.height / 2 + posOff);
  }, [phase, scaleMul, flip, posOff]);

  // Auto-blink / physics toggles (restore or detach the runtime handlers).
  useEffect(() => {
    if (phase !== "ready") return;
    const im = modelRef.current?.internalModel;
    // eslint-disable-next-line react-hooks/immutability
    if (im) im.eyeBlink = blink ? eyeBlinkRef.current : undefined;
  }, [phase, blink, charIdx]);
  useEffect(() => {
    if (phase !== "ready") return;
    const im = modelRef.current?.internalModel;
    // eslint-disable-next-line react-hooks/immutability
    if (im) im.physics = physics ? physicsRef.current : undefined;
  }, [phase, physics, charIdx]);

  // Pointer: gaze follows the cursor; tap plays a motion + speaks a line.
  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const model = modelRef.current;
    const canvas = canvasRef.current;
    if (!model?.focus || !canvas || !gazeRef.current) return;
    const rect = canvas.getBoundingClientRect();
    model.focus(e.clientX - rect.left, e.clientY - rect.top);
  }, []);
  const tapIdx = useRef(0);
  const onPointerDown = useCallback(() => {
    const model = modelRef.current;
    if (!model?.motion) return;
    model.motion("", tapIdx.current % 4);
    tapIdx.current += 1;
    // advance to the next line bubble on touch
    setLineIdx((i) => i + 1);
  }, []);

  const panels: ControlPanel[] = [
    {
      key: "act",
      title: "动作 / 表情 / 换肤",
      icon: "act",
      sections: [
        {
          title: "动作 / 表情",
          items: Array.from({ length: 6 }, (_, i) => ({
            label: `动作 ${i + 1}`,
            onSelect: () => modelRef.current?.motion?.("", i),
          })),
        },
        {
          title: "换肤 / 角色",
          items: CHARACTERS.map((c, i) => ({
            label: `${c.name} · ${c.type}`,
            active: charIdx === i,
            onSelect: () => setCharIdx(i),
          })),
        },
      ],
    },
    {
      key: "voice",
      title: "声音",
      icon: "voice",
      sections: [
        {
          title: "台词（无声 · 头顶气泡）",
          items: character.lines.map((l, i) => ({
            label: `${l.tag} · ${l.text}`,
            active: lineIdx % character.lines.length === i,
            onSelect: () => setLineIdx(i),
          })),
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
            { label: `自动待机 · ${autoPlay ? "开" : "关"}`, active: autoPlay, onSelect: () => setAutoPlay((v) => !v) },
            { label: `口型同步 · ${lipSync ? "开" : "关"}`, active: lipSync, onSelect: () => setLipSync((v) => !v) },
          ],
        },
        {
          title: "背景",
          items: BACKGROUNDS.map((bg, i) => ({
            label: bg.label,
            active: bgIdx === i,
            onSelect: () => setBgIdx(i),
          })),
        },
        {
          title: "操作",
          items: [
            { label: "随机动作", onSelect: () => modelRef.current?.motion?.("", Math.floor(Math.random() * 6)) },
            {
              label: "重置全部",
              onSelect: () => {
                setScaleMul(1);
                setPosOff(0);
                setFlip(false);
                setGaze(true);
                setBlink(true);
                setPhysics(true);
                setAutoPlay(true);
                setLipSync(true);
              },
            },
          ],
        },
      ],
    },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.stage} onPointerMove={onPointerMove} onPointerDown={onPointerDown}>
        <div className={styles.bg} style={{ background: BACKGROUNDS[bgIdx].css }} aria-hidden />
        <canvas ref={canvasRef} className={styles.canvas} />

        {phase === "loading" ? <div className={styles.hint}>模型加载中…</div> : null}
        {phase === "error" ? <div className={styles.hint}>演示模型加载失败</div> : null}

        {phase === "ready" ? (
          <>
            <div className={styles.nameMenu}>
              <button
                type="button"
                className={styles.nameCard}
                onClick={() => setCharMenuOpen((o) => !o)}
                aria-expanded={charMenuOpen}
                aria-label="切换角色"
              >
                <span className={styles.nameType}>{character.type}</span>
                <span className={styles.name}>{character.name}</span>
                <span className={styles.caret} aria-hidden>
                  ▾
                </span>
              </button>
              {charMenuOpen ? (
                <div className={styles.nameDropdown} role="menu">
                  {CHARACTERS.map((c, i) => (
                    <button
                      key={c.key}
                      type="button"
                      role="menuitem"
                      className={`${styles.nameItem} ${charIdx === i ? styles.nameItemActive : ""}`}
                      onClick={() => {
                        setCharIdx(i);
                        setCharMenuOpen(false);
                      }}
                    >
                      <span className={styles.nameItemType}>{c.type}</span>
                      {c.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className={styles.bubble} key={`${charIdx}-${lineIdx}`}>
              {line.text}
              <span className={styles.bubbleTail} aria-hidden />
            </div>

            <span className={styles.tagChip}># {line.tag}</span>
            <span className={styles.demoTag}>演示 · 非真实 AI · 触摸互动</span>

            <Live2DControls panels={panels} />
          </>
        ) : null}
      </div>
    </div>
  );
}
