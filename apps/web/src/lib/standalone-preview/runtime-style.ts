// Stylesheet for the self-contained local-preview HTML export. Inlined into the
// downloaded file's <style>. Kept framework-free and theme-driven via --theme.
// Authored as a String.raw literal (no backticks / ${} inside) so it survives
// embedding verbatim.
export const PREVIEW_STYLE = String.raw`
*, *::before, *::after { box-sizing: border-box; }
:root {
  --theme: #c4577a;
  --ink: #f5eef2;
  --muted: rgba(245,238,242,0.62);
  --panel: rgba(18,14,24,0.82);
  --panel-2: rgba(28,22,38,0.92);
  --line: rgba(255,255,255,0.12);
  --radius: 16px;
}
html, body { margin: 0; height: 100%; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
  color: var(--ink);
  background: #07060c;
  overflow: hidden;
}
button { font: inherit; color: inherit; cursor: pointer; }
input, textarea { font: inherit; }

.stage { position: fixed; inset: 0; display: flex; }
.arena { position: relative; flex: 1; min-width: 0; }
.canvas { position: absolute; inset: 0; overflow: hidden; }
.backdrop { position: absolute; inset: 0; background-size: cover; background-position: center; filter: saturate(1.05); }
.veil { position: absolute; inset: 0; background:
  radial-gradient(120% 80% at 50% 0%, transparent 40%, rgba(0,0,0,0.45) 100%); }
.floor { position: absolute; left: 0; right: 0; bottom: 0; height: 36%;
  background: linear-gradient(180deg, transparent, rgba(0,0,0,0.55)); pointer-events: none; }

.viewerHost { position: absolute; inset: 0; touch-action: none; }
.modelCanvas { position: absolute; inset: 0; }
.modelCanvas canvas { width: 100% !important; height: 100% !important; display: block; }

.petFloat { position: fixed; width: 400px; height: 400px; inset: auto; z-index: 60;
  filter: drop-shadow(0 18px 40px rgba(0,0,0,0.5)); }
.petFloat .floor, .petFloat .veil { display: none; }

.nameTag { position: absolute; top: 18px; left: 20px; display: flex; gap: 10px; align-items: center;
  background: var(--panel); border: 1px solid var(--line); padding: 8px 14px 8px 8px; border-radius: 999px;
  backdrop-filter: blur(8px); }
.nameAvatar { width: 38px; height: 38px; border-radius: 50%; background: var(--theme); background-size: cover;
  background-position: center; box-shadow: 0 0 0 2px rgba(255,255,255,0.18); }
.nameTitle { font-weight: 700; font-size: 14px; }
.liveLabel { font-size: 11px; color: var(--theme); display: flex; align-items: center; gap: 5px; font-weight: 600; }
.liveLabel span { width: 7px; height: 7px; border-radius: 50%; background: #ff5b6e; box-shadow: 0 0 8px #ff5b6e; }

.readouts { position: absolute; left: 20px; bottom: 26px; display: flex; flex-direction: column; gap: 8px; z-index: 12; }
.readout { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 7px 12px;
  font-size: 12px; color: var(--muted); backdrop-filter: blur(6px); }
.voiceBars { display: inline-flex; gap: 2px; align-items: flex-end; margin-right: 6px; height: 12px; vertical-align: middle; }
.voiceBars i { width: 3px; background: var(--theme); animation: bar 0.9s ease-in-out infinite; }
.voiceBars i:nth-child(2){ animation-delay: 0.15s; } .voiceBars i:nth-child(3){ animation-delay: 0.3s; }
@keyframes bar { 0%,100%{height:4px} 50%{height:12px} }

.subtitle { position: absolute; left: 50%; transform: translateX(-50%); bottom: 120px; max-width: 70%;
  background: var(--panel-2); border: 1px solid var(--line); border-radius: 14px; padding: 10px 16px; z-index: 14;
  display: flex; flex-direction: column; gap: 4px; backdrop-filter: blur(10px); text-align: center; }
.subtitleTitle { font-size: 12px; color: var(--theme); font-weight: 700; }
.subtitleText { font-size: 14px; }

/* ---- Controls dock ---- */
.controls { position: absolute; inset: 0; pointer-events: none; z-index: 20; }
.controls > * { pointer-events: auto; }
.cornerTR { position: absolute; top: 16px; right: 16px; width: 40px; height: 40px; border-radius: 12px;
  display: grid; place-items: center; background: var(--panel); border: 1px solid var(--line); backdrop-filter: blur(8px); }
.cornerTR.active { background: var(--theme); border-color: transparent; }

.dockWrap { position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%); display: flex;
  flex-direction: column; align-items: center; gap: 10px; }
.dock { display: flex; gap: 6px; background: var(--panel); border: 1px solid var(--line); border-radius: 16px;
  padding: 7px; backdrop-filter: blur(10px); }
.dockTab { width: 42px; height: 42px; border-radius: 11px; border: 0; background: transparent; color: var(--muted);
  display: grid; place-items: center; transition: background 0.15s, color 0.15s; }
.dockTab:hover { color: var(--ink); background: rgba(255,255,255,0.08); }
.dockTab.active { background: var(--theme); color: #fff; }
.panel { width: min(420px, 86vw); background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--radius);
  backdrop-filter: blur(14px); box-shadow: 0 16px 40px rgba(0,0,0,0.45); overflow: hidden; }
.panelTop { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px;
  border-bottom: 1px solid var(--line); }
.panelTitle { font-weight: 700; font-size: 14px; }
.panelClose { border: 0; background: transparent; color: var(--muted); width: 28px; height: 28px; border-radius: 8px; }
.panelClose:hover { background: rgba(255,255,255,0.08); color: var(--ink); }
.panelBody { padding: 14px; max-height: 46vh; overflow: auto; }

.chipGrid { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { border: 1px solid var(--line); background: rgba(255,255,255,0.04); color: var(--ink); border-radius: 10px;
  padding: 8px 12px; font-size: 13px; transition: background 0.15s, border-color 0.15s; }
.chip:hover { background: rgba(255,255,255,0.1); }
.chip.active { background: var(--theme); border-color: transparent; color: #fff; }
.chip.muted { color: var(--muted); }
.emptyHint { color: var(--muted); font-size: 13px; }
.stack { display: flex; flex-direction: column; gap: 16px; }
.sliderRow { display: flex; align-items: center; gap: 12px; }
.sliderLabel { font-size: 13px; color: var(--muted); min-width: 64px; }
.sliderRow input[type=range] { flex: 1; accent-color: var(--theme); }
.audioButtons { display: flex; gap: 8px; flex-wrap: wrap; }
.actionBtn { border: 1px solid var(--line); background: rgba(255,255,255,0.04); border-radius: 10px; padding: 8px 14px; font-size: 13px; }
.actionBtn.active { background: var(--theme); border-color: transparent; color: #fff; }
.settingSection { display: flex; flex-direction: column; gap: 8px; }
.settingTitle { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.settingRow { display: flex; flex-wrap: wrap; gap: 8px; }

/* ---- Chat dock ---- */
.dockChat { width: 360px; flex-shrink: 0; display: flex; flex-direction: column; background: var(--panel);
  border-left: 1px solid var(--line); backdrop-filter: blur(12px); z-index: 30; }
.dockHead { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.dockHeadTitle { font-weight: 700; }
.dockHeadRight { display: flex; align-items: center; gap: 10px; }
.dockRemaining { font-size: 12px; color: var(--muted); }
.iconBtn { border: 1px solid var(--line); background: rgba(255,255,255,0.04); border-radius: 9px; width: 30px; height: 30px;
  display: grid; place-items: center; color: var(--muted); }
.iconBtn:hover { color: var(--ink); }
.iconBtn.active { background: var(--theme); color: #fff; border-color: transparent; }
.transcript { list-style: none; margin: 0; padding: 16px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.msg { max-width: 84%; }
.msgUser { align-self: flex-end; }
.msgAssistant { align-self: flex-start; }
.bubble { border-radius: 14px; padding: 10px 13px; font-size: 14px; line-height: 1.5; }
.msgUser .bubble { background: var(--theme); color: #fff; border-bottom-right-radius: 4px; }
.msgAssistant .bubble { background: rgba(255,255,255,0.07); border: 1px solid var(--line); border-bottom-left-radius: 4px; }
.bubble p { margin: 0; white-space: pre-wrap; word-break: break-word; }
.bubbleTags { display: inline-flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; font-size: 11px; color: var(--muted); }
.retry { margin-top: 6px; border: 0; background: transparent; color: #ffb4be; font-size: 12px; padding: 0; }
.typing { align-self: flex-start; display: flex; gap: 4px; padding: 6px 0; }
.typing i { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); animation: blink 1.2s infinite; }
.typing i:nth-child(2){ animation-delay: 0.2s; } .typing i:nth-child(3){ animation-delay: 0.4s; }
@keyframes blink { 0%,100%{opacity:0.3} 50%{opacity:1} }
.composer { display: flex; gap: 8px; padding: 12px 14px; border-top: 1px solid var(--line); }
.composer input { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid var(--line); color: var(--ink);
  border-radius: 11px; padding: 10px 13px; outline: none; }
.composer input:focus { border-color: var(--theme); }
.sendBtn { width: 44px; border: 0; border-radius: 11px; background: var(--theme); color: #fff; font-size: 18px; }
.sendBtn:disabled { opacity: 0.45; cursor: not-allowed; }
.notice { margin: 12px 14px 0; padding: 10px 12px; border-radius: 10px; font-size: 13px; }
.noticeWarn { background: rgba(255,196,0,0.12); border: 1px solid rgba(255,196,0,0.3); }
.noticeBad { background: rgba(255,80,90,0.12); border: 1px solid rgba(255,80,90,0.3); }

/* AI config overlay */
.cfgOverlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: grid; place-items: center; z-index: 80; padding: 20px; }
.cfgCard { width: min(440px, 92vw); background: var(--panel-2); border: 1px solid var(--line); border-radius: 18px;
  padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.cfgCard h3 { margin: 0; font-size: 16px; }
.cfgCard p { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.5; }
.cfgField { display: flex; flex-direction: column; gap: 6px; }
.cfgField label { font-size: 12px; color: var(--muted); }
.cfgField input, .cfgField textarea { background: rgba(255,255,255,0.06); border: 1px solid var(--line); color: var(--ink);
  border-radius: 10px; padding: 9px 11px; outline: none; }
.cfgField textarea { min-height: 64px; resize: vertical; }
.cfgActions { display: flex; gap: 8px; justify-content: flex-end; }
.cfgActions button { border-radius: 10px; padding: 9px 16px; border: 1px solid var(--line); background: rgba(255,255,255,0.05); }
.cfgActions .primary { background: var(--theme); border-color: transparent; color: #fff; }

.status { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 14px; text-align: center; z-index: 16; }
.spinner { width: 40px; height: 40px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.18); border-top-color: var(--theme);
  animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.statusText { color: var(--muted); font-size: 13px; }
.slot { font-weight: 800; letter-spacing: 0.12em; color: var(--muted); }
.placeholder { position: absolute; inset: 0; display: grid; place-items: center; }
.portrait { width: 60%; height: 80%; background-size: contain; background-repeat: no-repeat; background-position: bottom center; align-self: end; }

@media (max-width: 768px) {
  .stage { flex-direction: column; }
  .dockChat { width: 100%; height: 42vh; border-left: 0; border-top: 1px solid var(--line); }
  .arena { flex: 1; }
  .dockWrap { bottom: 14px; }
  .panel { width: 92vw; }
}
`;
