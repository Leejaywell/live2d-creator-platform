// Vanilla, framework-free preview app for the self-contained local-preview HTML
// export. PIXI + Cubism Core + pixi-live2d-display are inlined as separate
// <script> tags BEFORE this one, so window.PIXI is available synchronously.
// Reads window.__PREVIEW__ (project + embedded model/voices/assets) and renders
// the full preview interface: Live2D viewer, motion/expression/scene/setting
// controls, voice + BGM, desktop-pet float, and chat (local fallback reply, or
// a user-supplied OpenAI-compatible API).
//
// Authored as a String.raw literal with NO backticks and NO "${" so the source
// embeds verbatim. Uses string concatenation instead of template literals.
export const PREVIEW_RUNTIME = String.raw`
(function () {
  var DATA = window.__PREVIEW__ || {};
  var L = DATA.i18n || {};
  function t(key, fallback) { return L[key] != null ? L[key] : fallback; }

  var MOTION_LABELS = {
    idle: "空闲等待", idle1: "随性站姿", home: "主界面动作", login: "登录迎接",
    mail: "收到邮件", mission: "查看任务", mission_complete: "任务完成", complete: "互动完成",
    wedding: "誓约珍藏", touch_head: "摸头反馈", touch_body: "身体触碰", touch_special: "特别触碰",
    touch_idle: "触碰待机", touch_idle1: "触碰待机", main_1: "对话主线 1", main_2: "对话主线 2",
    main_3: "对话主线 3", effect: "特效触发"
  };
  function motionLabel(file) {
    var base = String(file || "").split(/[\/\\]/).pop().replace(/\.motion3\.json$/i, "");
    if (base.indexOf("data:") === 0) base = "";
    return MOTION_LABELS[base] || base || "动作";
  }

  // ---- tiny DOM helper ----
  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === "class") n.className = attrs[k];
        else if (k === "style") n.style.cssText = attrs[k];
        else if (k === "html") n.innerHTML = attrs[k];
        else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") n.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
      }
    }
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function svg(paths) {
    var ns = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(ns, "svg");
    s.setAttribute("width", "18"); s.setAttribute("height", "18"); s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "1.7");
    s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
    s.innerHTML = paths;
    return s;
  }
  var ICONS = {
    motions: "<path d='M4 8V4h4'/><path d='M16 4h4v4'/><path d='M4 16v4h4'/><path d='M16 20h4v-4'/><line x1='6' y1='12' x2='18' y2='12' stroke-width='2.5'/><line x1='12' y1='7' x2='12' y2='17'/>",
    expressions: "<path d='M8 3h8l5 5v8l-5 5H8l-5-5V8Z'/><line x1='8' y1='10' x2='10' y2='10'/><line x1='14' y1='10' x2='16' y2='10'/><path d='M9 14h6'/><path d='M9 14v1a3 3 0 0 0 6 0v-1'/>",
    audio: "<circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='5'/><line x1='12' y1='2' x2='12' y2='5'/><line x1='12' y1='19' x2='12' y2='22'/><line x1='2' y1='12' x2='5' y2='12'/><line x1='19' y1='12' x2='22' y2='12'/>",
    scenes: "<rect width='18' height='18' x='3' y='3' rx='4'/><line x1='3' y1='13' x2='21' y2='13'/><line x1='12' y1='13' x2='12' y2='21'/><circle cx='12' cy='9' r='3'/>",
    settings: "<circle cx='12' cy='12' r='3.2'/><path d='M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18'/>",
    pet: "<path d='M3 10V5l4 4h10l4-4v5l-2 3v4l-4 3H9l-4-3v-4Z'/><rect x='7' y='11' width='3' height='2' rx='0.5'/><rect x='14' y='11' width='3' height='2' rx='0.5'/>",
    close: "<line x1='6' y1='6' x2='18' y2='18'/><line x1='18' y1='6' x2='6' y2='18'/>",
    chat: "<path d='M4 5h16v11H9l-5 4Z'/>"
  };

  // ---- state ----
  var state = {
    scaleMul: 1, posOff: 0, flip: false, gaze: true, blink: true, physics: true,
    idle: true, lipSync: true, randomMotion: true, randomExpr: true, randomVoice: true,
    bgIdx: 0, voiceVolume: 1, bgmOn: false, petMode: false, collapsed: false, pending: false
  };
  var BG_OPTIONS = [];
  if (DATA.backgroundUrl) BG_OPTIONS.push({ kind: "image", url: DATA.backgroundUrl, label: t("creatorBackground", "创作者背景") });
  (DATA.stageBackgrounds || []).forEach(function (b) { BG_OPTIONS.push({ kind: "css", css: b.css, label: b.label }); });

  // ---- Live2D runtime refs ----
  var app = null, model = null, baseScale = 0.2, natural = { w: 1, h: 1 };
  var eyeBlink, physicsObj, motionList = [], expressions = [], voiceAudio = null, bgmAudio = null;
  var subtitleTimer = null;

  // ===== layout =====
  var canvasHost = h("div", { class: "modelCanvas" });
  var subtitleEl = null;
  var statusEl = h("div", { class: "status" }, [h("div", { class: "spinner" }), h("span", { class: "statusText" }, [t("stageLoading", "正在载入模型…")])]);

  var nameTag = DATA.hideNameTag ? null : h("div", { class: "nameTag" }, [
    h("div", { class: "nameAvatar", style: DATA.avatarUrl ? "background-image:url(" + DATA.avatarUrl + ")" : "" }),
    h("div", {}, [h("div", { class: "nameTitle" }, [DATA.projectName || ""]),
      h("div", { class: "liveLabel" }, [h("span"), t("live", "LIVE 预览")])])
  ]);

  var canvas = h("div", { class: "canvas" }, [
    DATA.backgroundUrl ? h("div", { class: "backdrop", style: "background-image:url(" + DATA.backgroundUrl + ")" }) : null,
    h("div", { class: "veil" }), h("div", { class: "floor" }),
    nameTag,
    h("div", { class: "viewerHost" }, [canvasHost]),
    statusEl
  ]);

  var controlsLayer = h("div", { class: "controls" });
  canvas.appendChild(controlsLayer);

  var readouts = h("div", { class: "readouts", style: "display:none" });
  canvas.appendChild(readouts);

  var arena = h("div", { class: "arena" }, [canvas]);
  var chatDock = buildChatDock();
  var stage = h("section", { class: "stage", style: "--theme:" + (DATA.theme || "#c4577a") }, [arena, chatDock]);
  document.body.appendChild(stage);

  // ===== controls (dock + panel) =====
  var controlsUi = buildControls();
  controlsLayer.appendChild(controlsUi.root);

  // ===== Live2D init =====
  initLive2D();

  // ---------------------------------------------------------------------------
  function initLive2D() {
    var PIXI = window.PIXI;
    var Live2DModel = PIXI && PIXI.live2d && PIXI.live2d.Live2DModel;
    if (!PIXI || !Live2DModel) { fail(); return; }

    window.Live2DCubismCore = window.Live2DCubismCore || {};
    window.Live2DCubismCore.Memory = window.Live2DCubismCore.Memory || { initializeAmountOfMemory: function () {} };

    var C4 = PIXI.live2d.Cubism4InternalModel;
    if (C4) {
      var proto = C4.prototype;
      var orig = proto.updateWebGLContext;
      proto.updateWebGLContext = function (gl, id) {
        if (this.renderer && !this.renderer._clippingManager) {
          this.renderer._clippingManager = new Proxy({}, {
            get: function (target, prop) {
              if (prop === "_currentFrameNo" || prop === "_maskTexture") return target[prop];
              return function () {
                if (prop === "getRenderTextureCount" || prop === "getClippingMaskBufferSize") return 0;
                if (prop === "getClippingContextListForDraw") return [];
                return undefined;
              };
            },
            set: function (target, prop, value) { target[prop] = value; return true; }
          });
        }
        orig.call(this, gl, id);
      };
    }
    Live2DModel.registerTicker(PIXI.Ticker);

    app = new PIXI.Application({ autoStart: true, backgroundAlpha: 0, resizeTo: canvasHost, antialias: true });
    canvasHost.replaceChildren(app.view);

    var settings = DATA.model || {};
    settings.url = settings.url || "model.model3.json";
    Live2DModel.from(settings).then(function (m) {
      model = m;
      m.anchor.set(0.5, 0.5);
      natural = { w: m.width || 1, h: m.height || 1 };
      var rw = app.renderer.width, rh = app.renderer.height;
      baseScale = Math.min(rw / natural.w, rh / natural.h) * 0.9 || 0.2;
      m.scale.set(baseScale, baseScale);
      m.position.set(rw / 2, rh / 2);
      app.stage.addChild(m);

      var im = m.internalModel;
      eyeBlink = im && im.eyeBlink; physicsObj = im && im.physics;
      var sm = (im && im.settings && im.settings.motions) || {};
      motionList = [];
      Object.keys(sm).forEach(function (group) {
        (sm[group] || []).forEach(function (def, i) {
          motionList.push({ group: group, index: i, label: motionLabel(def.File || def.file || group + "-" + (i + 1)) });
        });
      });
      var ex = (im && im.settings && im.settings.expressions) || [];
      expressions = ex.map(function (e, i) { return e.Name || e.name || ("表情 " + (i + 1)); });

      ready();
    }).catch(function (e) { console.error("Live2D load failed", e); fail(); });
  }

  function ready() {
    statusEl.style.display = "none";
    controlsUi.refresh();
    applyTransform(); applyDynamic();
    startLoops();
    refitObserver();
    // greeting
    setTimeout(function () {
      playReactionMotion("login");
      var first = (DATA.voices || [])[0];
      if (DATA.welcomeMessage) showSubtitle(t("reactGreeting", "问候"), DATA.welcomeMessage);
      if (first && first.audioUrl) playVoice(first);
    }, 700);
  }

  function fail() {
    statusEl.innerHTML = "";
    statusEl.classList.add("error");
    statusEl.appendChild(h("div", { class: "slot" }, ["LIVE2D"]));
    statusEl.appendChild(h("span", { class: "statusText" }, [t("loadFailed", "模型载入失败")]));
  }

  // ---- transforms / dynamic toggles ----
  function applyTransform() {
    if (!model || !app) return;
    var s = baseScale * state.scaleMul;
    model.scale.set(state.flip ? -s : s, s);
    model.position.set(app.renderer.width / 2, app.renderer.height / 2 + state.posOff);
  }
  function applyDynamic() {
    if (!model) return;
    var im = model.internalModel;
    if (im) { im.eyeBlink = state.blink ? eyeBlink : undefined; im.physics = state.physics ? physicsObj : undefined; }
  }
  function refit() {
    if (!model || !app) return;
    var w = canvasHost.clientWidth, hh = canvasHost.clientHeight;
    if (!w || !hh) return;
    app.renderer.resize(w, hh);
    baseScale = Math.min(w / (natural.w || w), hh / (natural.h || hh)) * 0.9 || 0.2;
    applyTransform();
  }
  function refitObserver() {
    if (typeof ResizeObserver === "undefined") return;
    var ro = new ResizeObserver(function () { refit(); });
    ro.observe(canvasHost);
  }

  // ---- idle / auto loops ----
  var timers = [];
  function startLoops() {
    timers.forEach(clearInterval); timers = [];
    timers.push(setInterval(function () {
      if (!model) return;
      if (state.randomMotion) {
        if (motionList.length) { var p = motionList[(Math.random() * motionList.length) | 0]; model.motion && model.motion(p.group, p.index); }
        else model.motion && model.motion("", (Math.random() * 4) | 0);
      } else if (state.idle) { model.motion && model.motion("", 0); }
    }, 9000));
    timers.push(setInterval(function () {
      if (model && state.randomExpr && expressions.length) { var n = expressions[(Math.random() * expressions.length) | 0]; model.expression && model.expression(n); }
    }, 13000));
    timers.push(setInterval(function () {
      if (state.randomVoice && (DATA.voices || []).length) { var v = DATA.voices[(Math.random() * DATA.voices.length) | 0]; if (v) playVoice(v); }
    }, 17000));
    // lip-sync raf
    (function lip() {
      requestAnimationFrame(lip);
      if (!state.pending || !state.lipSync || !model) return;
      var core = model.internalModel && model.internalModel.coreModel;
      try { core && core.setParameterValueById("ParamMouthOpenY", 0.5 + 0.5 * Math.sin(Date.now() / 120)); } catch (e) {}
    })();
  }

  // ---- voice / bgm / subtitle ----
  function playVoice(voice, subtitleTitle) {
    if (subtitleTitle) showSubtitle(subtitleTitle, (voice && voice.name) || "");
    if (!voice || !voice.audioUrl) return;
    if (voiceAudio) voiceAudio.pause();
    var a = new Audio(voice.audioUrl);
    a.volume = state.voiceVolume;
    voiceAudio = a;
    a.onended = function () { hideSubtitle(); };
    a.play().catch(function () {});
  }
  function showSubtitle(title, text) {
    if (subtitleTimer) clearTimeout(subtitleTimer);
    if (!subtitleEl) { subtitleEl = h("div", { class: "subtitle" }); canvas.appendChild(subtitleEl); }
    subtitleEl.innerHTML = "";
    subtitleEl.appendChild(h("span", { class: "subtitleTitle" }, ["⚓ " + title]));
    if (text) subtitleEl.appendChild(h("span", { class: "subtitleText" }, [text]));
    subtitleEl.style.display = "flex";
    subtitleTimer = setTimeout(hideSubtitle, 6000);
  }
  function hideSubtitle() { if (subtitleEl) subtitleEl.style.display = "none"; }

  // ---- reactions ----
  function playReactionMotion(name) {
    if (!model) return;
    var motions = model.internalModel && model.internalModel.settings && model.internalModel.settings.motions;
    if (motions) {
      for (var g in motions) {
        var idx = (motions[g] || []).findIndex(function (m) { return ((m.File || m.file || "")).indexOf(name) !== -1; });
        if (idx !== -1) { model.motion && model.motion(g, idx); return; }
      }
    }
    model.motion && model.motion("", (tapIdx++) % 4);
  }
  function voiceForReaction(keyword) {
    var list = DATA.voices || [];
    if (!list.length) return undefined;
    var matched = list.find(function (v) { return (v.tags || []).some(function (tag) { return tag.indexOf(keyword) !== -1 || keyword.indexOf(tag) !== -1; }); });
    return matched || list[(Math.random() * list.length) | 0];
  }
  var tapIdx = 0;
  function reactToArea(areas) {
    var has = function (k) { return areas.some(function (a) { return a.toLowerCase().indexOf(k) !== -1; }); };
    var motion = "touch_body", keyword = "touch", title = t("reactTouchBody", "轻触");
    if (has("special")) { motion = "touch_special"; keyword = "special"; title = t("reactTouchSpecial", "特别触碰"); }
    else if (has("head")) { motion = "touch_head"; keyword = "head"; title = t("reactTouchHead", "摸头"); }
    playReactionMotion(motion);
    playVoice(voiceForReaction(keyword), title);
  }

  // ---- pointer (gaze + tap + pet drag) ----
  var petDrag = null, petPos = { x: 120, y: 80 };
  stage.addEventListener("pointermove", function (e) {
    if (petDrag) { setPetPos(Math.max(8, e.clientX - petDrag.dx), Math.max(8, e.clientY - petDrag.dy)); return; }
    if (!model || !model.focus || !state.gaze) return;
    var r = canvasHost.getBoundingClientRect();
    model.focus(e.clientX - r.left, e.clientY - r.top);
  });
  arena.addEventListener("pointerdown", function (e) {
    if (e.target.closest && e.target.closest(".controls")) return;
    if (state.petMode) { e.preventDefault(); petDrag = { dx: e.clientX - petPos.x, dy: e.clientY - petPos.y }; return; }
    if (!model) return;
    var r = canvasHost.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    var hits = (model.hitTest && model.hitTest(x, y)) || [];
    if (hits.length) { reactToArea(hits); return; }
    var b = model.getBounds && model.getBounds();
    if (b && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) reactToArea([]);
    else model.motion && model.motion("", (tapIdx++) % 4);
  });
  window.addEventListener("pointerup", function () { petDrag = null; });
  function setPetPos(x, y) { petPos = { x: x, y: y }; if (state.petMode) { arena.style.left = x + "px"; arena.style.top = y + "px"; } }

  function togglePet() {
    state.petMode = !state.petMode;
    if (state.petMode) {
      arena.classList.add("petFloat");
      petPos = { x: Math.max(8, (window.innerWidth - 400) / 2 | 0), y: Math.max(8, (window.innerHeight - 400) / 2 | 0) };
      setPetPos(petPos.x, petPos.y);
    } else {
      arena.classList.remove("petFloat");
      arena.style.left = ""; arena.style.top = "";
    }
    setTimeout(refit, 60);
    controlsUi.refresh();
  }

  // ===== controls UI =====
  function buildControls() {
    var open = false, tab = "motions";
    var panelWrap = h("div", { class: "dockWrap" });
    var dock = h("div", { class: "dock" });
    var petBtn = h("button", { class: "cornerTR", title: t("petMode", "桌宠模式"), onclick: togglePet }, [svg(ICONS.pet)]);

    var TABS = [["motions", "动作", "motions"], ["expressions", "表情", "expressions"], ["audio", "语音", "audio"], ["scenes", "场景", "scenes"], ["settings", "设置", "settings"]];
    var panelEl = null;

    function setTab(k) { tab = k; open = true; render(); }
    function close() { open = false; render(); }

    function tabBody(k) {
      if (k === "motions" || k === "expressions") {
        var items = k === "motions"
          ? (motionList.length ? motionList.map(function (m) { return { label: m.label, fn: function () { model && model.motion && model.motion(m.group, m.index); } }; }) : [])
          : expressions.map(function (n) { return { label: n, fn: function () { model && model.expression && model.expression(n); } }; });
        if (!items.length) return h("div", { class: "chipGrid" }, [h("span", { class: "emptyHint" }, [t("none", "暂无")])]);
        return h("div", { class: "chipGrid" }, items.map(function (it) {
          return h("button", { class: "chip" + (k === "expressions" ? " muted" : ""), onclick: it.fn }, [it.label]);
        }));
      }
      if (k === "audio") {
        var slider = h("input", { type: "range", min: "0", max: "1", step: "0.01", value: String(state.voiceVolume) });
        slider.addEventListener("input", function () { state.voiceVolume = parseFloat(slider.value); if (voiceAudio) voiceAudio.volume = state.voiceVolume; });
        var bgmBtn = h("button", { class: "actionBtn" + (state.bgmOn ? " active" : "") }, [state.bgmOn ? t("bgmPause", "暂停音乐") : t("bgmPlay", "播放音乐")]);
        bgmBtn.addEventListener("click", function () {
          state.bgmOn = !state.bgmOn;
          if (DATA.ambientUrl) {
            if (!bgmAudio) { bgmAudio = new Audio(DATA.ambientUrl); bgmAudio.loop = true; }
            if (state.bgmOn) bgmAudio.play().catch(function () {}); else bgmAudio.pause();
          }
          render();
        });
        return h("div", { class: "stack" }, [
          h("div", { class: "sliderRow" }, [h("span", { class: "sliderLabel" }, [t("voiceVolume", "语音音量")]), slider]),
          h("div", { class: "audioButtons" }, [
            h("button", { class: "actionBtn", onclick: function () { reactToArea([]); } }, [t("randomInteract", "随机互动")]),
            bgmBtn
          ])
        ]);
      }
      if (k === "scenes") {
        return h("div", { class: "chipGrid" }, BG_OPTIONS.map(function (b, i) {
          return h("button", { class: "chip" + (state.bgIdx === i ? " active" : ""), onclick: function () { state.bgIdx = i; applyBg(); render(); } }, [b.label]);
        }));
      }
      // settings
      var sections = [
        ["缩放", [["放大", function () { return state.scaleMul > 1; }, function () { state.scaleMul = 1.25; }], ["原始", function () { return state.scaleMul === 1; }, function () { state.scaleMul = 1; }], ["缩小", function () { return state.scaleMul < 1; }, function () { state.scaleMul = 0.8; }]]],
        ["位置", [["上移", function () { return state.posOff < 0; }, function () { state.posOff = -40; }], ["居中", function () { return state.posOff === 0; }, function () { state.posOff = 0; }], ["下移", function () { return state.posOff > 0; }, function () { state.posOff = 40; }], ["镜像", function () { return state.flip; }, function () { state.flip = !state.flip; }]]],
        ["动态", [["视线", function () { return state.gaze; }, function () { state.gaze = !state.gaze; }], ["眨眼", function () { return state.blink; }, function () { state.blink = !state.blink; }], ["物理", function () { return state.physics; }, function () { state.physics = !state.physics; }], ["待机", function () { return state.idle; }, function () { state.idle = !state.idle; }], ["口型", function () { return state.lipSync; }, function () { state.lipSync = !state.lipSync; }]]],
        ["自动", [["自动动作", function () { return state.randomMotion; }, function () { state.randomMotion = !state.randomMotion; }], ["自动表情", function () { return state.randomExpr; }, function () { state.randomExpr = !state.randomExpr; }], ["自动语音", function () { return state.randomVoice; }, function () { state.randomVoice = !state.randomVoice; }]]],
        ["操作", [["随机动作", function () { return false; }, function () { model && model.motion && model.motion("", (Math.random() * 4) | 0); }], ["重置", function () { return false; }, resetAll]]]
      ];
      return h("div", { class: "stack" }, sections.map(function (sec) {
        return h("div", { class: "settingSection" }, [
          h("div", { class: "settingTitle" }, [sec[0]]),
          h("div", { class: "settingRow" }, sec[1].map(function (it) {
            return h("button", { class: "chip" + (it[1]() ? " active" : ""), onclick: function () { it[2](); applyTransform(); applyDynamic(); applyBg(); startLoops(); render(); } }, [it[0]]);
          }))
        ]);
      }));
    }

    function resetAll() {
      state.scaleMul = 1; state.posOff = 0; state.flip = false; state.gaze = true; state.blink = true;
      state.physics = true; state.idle = true; state.lipSync = true; state.bgIdx = 0;
      applyTransform(); applyDynamic(); applyBg();
    }

    function render() {
      dock.innerHTML = "";
      TABS.forEach(function (tb) {
        var b = h("button", { class: "dockTab" + (open && tab === tb[0] ? " active" : ""), title: tb[1], onclick: function () { (open && tab === tb[0]) ? close() : setTab(tb[0]); } }, [svg(ICONS[tb[2]])]);
        b.addEventListener("mouseenter", function () { setTab(tb[0]); });
        dock.appendChild(b);
      });
      if (panelEl) { panelEl.remove(); panelEl = null; }
      if (open) {
        var label = (TABS.find(function (x) { return x[0] === tab; }) || [])[1] || "";
        panelEl = h("div", { class: "panel" }, [
          h("div", { class: "panelTop" }, [h("span", { class: "panelTitle" }, [label]),
            h("button", { class: "panelClose", onclick: close }, [svg(ICONS.close)])]),
          h("div", { class: "panelBody" }, [tabBody(tab)])
        ]);
        panelWrap.insertBefore(panelEl, dock);
      }
      petBtn.className = "cornerTR" + (state.petMode ? " active" : "");
      petBtn.innerHTML = ""; petBtn.appendChild(svg(state.petMode ? ICONS.close : ICONS.pet));
    }
    panelWrap.appendChild(dock);
    panelWrap.addEventListener("mouseleave", function () { setTimeout(function () { close(); }, 160); });

    var root = h("div", {}, [petBtn, panelWrap]);
    render();
    return { root: root, refresh: render };
  }

  function applyBg() {
    var bg = BG_OPTIONS[state.bgIdx] || BG_OPTIONS[0];
    if (!bg) return;
    var back = canvas.querySelector(".backdrop");
    if (bg.kind === "image") {
      if (!back) { back = h("div", { class: "backdrop" }); canvas.insertBefore(back, canvas.firstChild); }
      back.style.background = "url(" + bg.url + ") center/cover";
    } else {
      if (back) back.style.background = bg.css;
      else { back = h("div", { class: "backdrop" }); back.style.background = bg.css; canvas.insertBefore(back, canvas.firstChild); }
    }
  }

  // ===== chat =====
  var messages = [{ role: "assistant", content: DATA.welcomeMessage || t("welcome", "你好～") }];
  var transcriptEl, composerInput, remainingEl;

  function buildChatDock() {
    transcriptEl = h("ol", { class: "transcript" });
    composerInput = h("input", { placeholder: t("composerPlaceholder", "和角色聊聊…"), "aria-label": "message" });
    var sendBtn = h("button", { class: "sendBtn", type: "submit" }, ["→"]);
    var form = h("form", { class: "composer" }, [composerInput, sendBtn]);
    form.addEventListener("submit", function (e) { e.preventDefault(); var v = composerInput.value.trim(); if (v) { composerInput.value = ""; send(v); } });
    remainingEl = h("span", { class: "dockRemaining" }, [aiConfigured() ? t("aiOn", "已接入 API") : t("aiLocal", "本地兜底回复")]);

    var cfgBtn = h("button", { class: "iconBtn", title: t("aiConfig", "AI 设置"), onclick: openConfig }, [svg(ICONS.settings)]);

    var dock = h("aside", { class: "dockChat" }, [
      h("div", { class: "dockHead" }, [
        h("span", { class: "dockHeadTitle" }, [t("chat", "聊天")]),
        h("div", { class: "dockHeadRight" }, [remainingEl, cfgBtn])
      ]),
      transcriptEl,
      form
    ]);
    setTimeout(renderTranscript, 0);
    return dock;
  }

  function renderTranscript() {
    transcriptEl.innerHTML = "";
    messages.filter(function (m) { return m.role === "user" || m.failed || (m.content || "").trim().length; }).forEach(function (m, i) {
      var bubble = h("div", { class: "bubble" }, [h("p", {}, [m.content])]);
      if (m.tags && m.tags.length) bubble.appendChild(h("span", { class: "bubbleTags" }, m.tags.map(function (tg) { return h("span", {}, ["#" + tg]); }).concat([document.createTextNode(" 🔊 " + t("readAloud", "朗读"))])));
      if (m.failed) { var rb = h("button", { class: "retry" }, ["⚠️ " + t("retrySend", "重试")]); rb.addEventListener("click", function () { send(m.content, true); }); bubble.appendChild(rb); }
      transcriptEl.appendChild(h("li", { class: "msg " + (m.role === "user" ? "msgUser" : "msgAssistant") }, [bubble]));
    });
    if (state.pending) transcriptEl.appendChild(h("li", { class: "typing" }, [h("i"), h("i"), h("i")]));
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

  function detectTags(text) {
    var lower = (text || "").toLowerCase();
    var hits = [];
    (DATA.triggerTags || []).forEach(function (tag) {
      if ((tag.keywords || []).some(function (k) { return k && lower.indexOf(String(k).toLowerCase()) !== -1; })) hits.push(tag);
    });
    return hits;
  }
  function applyEffects(tags) {
    tags.forEach(function (tag) {
      if (tag.live2dExpression && model && model.expression) { try { model.expression(tag.live2dExpression); } catch (e) {} }
      var v = voiceForReaction(tag.name || "");
      if (v) playVoice(v, tag.name);
    });
  }

  var FALLBACKS = [
    "「指挥官，这只是本地预览的兜底回复哦～想要真正的对话，可以在右上角的 AI 设置里填入接口和密钥。」",
    "「我在听呢。现在用的是离线兜底回复——配置 API 之后我就能认真和你聊天啦。」",
    "「嗯嗯，收到～（这是本地预览，未接入 AI。）」"
  ];
  function localReply(userText, tags) {
    if (tags.length && tags[0].promptFragment) return "「" + (DATA.projectName || "我") + "：" + tags[0].promptFragment + "」（本地兜底回复）";
    return FALLBACKS[(Math.random() * FALLBACKS.length) | 0];
  }

  function send(content, isRetry) {
    if (state.pending) return;
    state.pending = true;
    readouts.style.display = "flex";
    readouts.innerHTML = "";
    readouts.appendChild(h("div", { class: "readout" }, [h("span", { class: "voiceBars" }, [h("i"), h("i"), h("i")]), t("voicePlaying", "语音播放中")]));
    if (isRetry) { messages.forEach(function (m) { if (m.role === "user" && m.content === content) m.failed = false; }); }
    else messages.push({ role: "user", content: content });
    renderTranscript();

    var tags = detectTags(content);
    finish(content, tags);
  }

  function finish(content, tags) {
    if (aiConfigured()) {
      callApi(content).then(function (reply) {
        var replyTags = detectTags(reply).map(function (x) { return x.name; });
        pushAssistant(reply, replyTags);
        applyEffects(detectTags(reply));
      }).catch(function (err) {
        messages.forEach(function (m) { if (m.role === "user" && m.content === content) m.failed = true; });
        pushAssistant(t("apiFail", "调用 API 失败：") + (err && err.message ? err.message : ""), []);
      });
    } else {
      setTimeout(function () {
        var reply = localReply(content, tags);
        pushAssistant(reply, tags.map(function (x) { return x.name; }));
        applyEffects(tags);
      }, 500);
    }
  }
  function pushAssistant(reply, tags) {
    messages.push({ role: "assistant", content: reply, tags: tags });
    state.pending = false;
    readouts.style.display = "none";
    renderTranscript();
  }

  // ---- AI config ----
  function cfg() { try { return JSON.parse(localStorage.getItem("standalone-ai-config") || "{}"); } catch (e) { return {}; } }
  function aiConfigured() { var c = cfg(); return !!(c.baseUrl && c.apiKey); }
  function callApi(userText) {
    var c = cfg();
    var url = c.baseUrl.replace(/\/+$/, "") + "/chat/completions";
    var msgs = [{ role: "system", content: c.systemPrompt || DATA.systemPrompt || "" }];
    messages.slice(-10).forEach(function (m) { msgs.push({ role: m.role, content: m.content }); });
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + c.apiKey },
      body: JSON.stringify({ model: c.model || "gpt-4o-mini", messages: msgs, temperature: 0.8 })
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      var reply = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      return reply || t("apiEmpty", "（接口返回为空）");
    });
  }
  function openConfig() {
    var c = cfg();
    var fBase = h("input", { value: c.baseUrl || "", placeholder: "https://api.openai.com/v1" });
    var fKey = h("input", { type: "password", value: c.apiKey || "", placeholder: "sk-..." });
    var fModel = h("input", { value: c.model || "", placeholder: "gpt-4o-mini" });
    var fPrompt = h("textarea", { placeholder: t("systemPromptPh", "角色系统提示词") });
    fPrompt.value = c.systemPrompt || DATA.systemPrompt || "";
    var overlay = h("div", { class: "cfgOverlay" }, [
      h("div", { class: "cfgCard" }, [
        h("h3", {}, [t("aiConfig", "AI 设置")]),
        h("p", {}, [t("aiConfigHint", "填入任意 OpenAI 兼容接口（如本地 Ollama / LM Studio / 中转）。留空则使用本地兜底回复。注意：浏览器直连第三方接口需对方允许 CORS。")]),
        field(t("apiBase", "接口地址 (Base URL)"), fBase),
        field(t("apiKey", "API Key"), fKey),
        field(t("apiModel", "模型"), fModel),
        field(t("systemPrompt", "系统提示词"), fPrompt),
        h("div", { class: "cfgActions" }, [
          h("button", { onclick: function () { overlay.remove(); } }, [t("cancel", "取消")]),
          h("button", { class: "primary", onclick: function () {
            localStorage.setItem("standalone-ai-config", JSON.stringify({ baseUrl: fBase.value.trim(), apiKey: fKey.value.trim(), model: fModel.value.trim(), systemPrompt: fPrompt.value }));
            remainingEl.textContent = aiConfigured() ? t("aiOn", "已接入 API") : t("aiLocal", "本地兜底回复");
            overlay.remove();
          } }, [t("save", "保存")])
        ])
      ])
    ]);
    overlay.addEventListener("pointerdown", function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }
  function field(label, input) { return h("div", { class: "cfgField" }, [h("label", {}, [label]), input]); }
})();
`;
