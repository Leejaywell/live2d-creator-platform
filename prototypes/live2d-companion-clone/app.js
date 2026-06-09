const DEFAULT_MODEL_URL = "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json";
const SHARE_URL = "https://live2d.example/c/urzis";

const platform = {
  activeView: "overview",
  project: {
    name: "尤里 Urzis",
    slug: "urzis",
    avatar: "狐",
    intro: "温柔但有掌控感的 Live2D AI 桌面伴侣。",
    theme: "#0f766e",
    systemPrompt: "你是尤里 Urzis，一位温柔但有掌控感的 Live2D 桌面伴侣。",
    welcomeMessage: "宝宝，我会一直陪着你的...",
    status: "draft",
    modelStatus: "pending",
    modelJsonPath: DEFAULT_MODEL_URL,
    modelVersion: 1,
    validationErrors: ["等待上传 Cubism 4 model3.zip，或勾选管理员协助配置。"],
    adminAssisted: false,
  },
  plan: {
    name: "Pro Trial",
    expiresAt: "2026-07-06",
    maxProjects: 3,
    storageLimitMb: 1024,
    monthlyAiMessageLimit: 5000,
    fanCodeQuota: 100,
    usedAiMessages: 1280,
    usedStorageMb: 246,
    generatedFanCodes: 1,
  },
  voices: [
    { id: "v1", name: "一直陪着你", duration: "02.4s", tags: ["脸红"], status: "active" },
    { id: "v2", name: "超级厉害哦", duration: "02.1s", tags: ["爱心"], status: "active" },
    { id: "v3", name: "别硬撑", duration: "02.8s", tags: ["哭哭"], status: "active" },
  ],
  tags: [
    {
      id: "t1",
      name: "脸红",
      description: "亲密、害羞、陪伴感",
      keywords: "想你, 喜欢, 陪",
      promptFragment: "回复更轻、更近，表达陪伴。",
      live2dExpression: "Param5=1",
      live2dParams: "ParamBrowLAngle=0.75",
      voiceAssetIds: ["v1"],
      priority: 80,
      enabled: true,
    },
    {
      id: "t2",
      name: "哭哭",
      description: "安慰、疲惫、压力",
      keywords: "难过, 累, 压力",
      promptFragment: "先安抚，再给出很短的行动建议。",
      live2dExpression: "Param3=1",
      live2dParams: "ParamBrowLForm=-0.55",
      voiceAssetIds: ["v3"],
      priority: 70,
      enabled: true,
    },
    {
      id: "t3",
      name: "爱心",
      description: "夸奖、完成任务、正反馈",
      keywords: "完成, 厉害, 夸",
      promptFragment: "明确夸奖用户，并保持角色口吻。",
      live2dExpression: "Param4=1",
      live2dParams: "",
      voiceAssetIds: ["v2"],
      priority: 60,
      enabled: true,
    },
    {
      id: "t4",
      name: "狐耳",
      description: "轻微占有欲、提醒回来",
      keywords: "离开, 跑, 别人",
      promptFragment: "使用轻微占有感，但不威胁用户。",
      live2dExpression: "Param7=1",
      live2dParams: "",
      voiceAssetIds: [],
      priority: 40,
      enabled: true,
    },
  ],
  fanCodes: [
    {
      id: "c1",
      codeHash: hashCode("YURI-2026"),
      displayCode: "YURI-2026",
      expiresAt: "2026-07-06",
      maxMessages: 10,
      usedMessages: 0,
      bindMode: "browserDevice",
      boundDeviceHash: "",
      status: "active",
      batchId: "seed",
    },
  ],
  cloneRequests: [
    {
      id: "r1",
      project: "尤里 Urzis",
      status: "reviewing",
      authorizationConfirmed: true,
      notes: "等待主播补充授权录音来源。",
    },
  ],
  audit: [
    "Super Admin confirmed manual order #M-20260606-001",
    "Quota ledger granted 100 fan codes to 尤里 Urzis",
    "Creator created project urzis",
  ],
  currentSessionCodeId: "",
  lastGeneratedCodes: [],
};

const state = {
  app: null,
  model: null,
  baseWidth: 0,
  baseHeight: 0,
  activeStates: {},
  timers: {},
  expWeights: {},
  audio: new Audio(),
  audioCtx: null,
  analyser: null,
  currentVoice: null,
  messages: [
    {
      role: "system",
      content:
        "你是尤里 Urzis，一位温柔但有掌控感的 Live2D 桌面伴侣。每次回复必须以【动作】开头，动作只能从：脸红, 哭哭, 爱心, 眼罩, 冰块, 狐耳 中选择。回复 20-40 字，中文，第一人称，不使用表情符号。",
    },
  ],
};

const dom = {
  workspace: document.getElementById("workspace-content"),
  viewTitle: document.getElementById("view-title"),
  navList: document.getElementById("nav-list"),
  publishProject: document.getElementById("publish-project"),
  copyShareLink: document.getElementById("copy-share-link"),
  sidebarPlanName: document.getElementById("sidebar-plan-name"),
  sidebarPlanMeta: document.getElementById("sidebar-plan-meta"),
  previewTitle: document.getElementById("preview-title"),
  statusPill: document.getElementById("project-status-pill"),
  phoneTitle: document.getElementById("phone-project-title"),
  accessGate: document.getElementById("access-gate"),
  accessForm: document.getElementById("access-form"),
  accessCodeInput: document.getElementById("access-code-input"),
  gateMessage: document.getElementById("gate-message"),
  canvas: document.getElementById("live2d-canvas"),
  bgCanvas: document.getElementById("bg-canvas"),
  chatList: document.getElementById("chat-list"),
  chatForm: document.getElementById("chat-form"),
  chatInput: document.getElementById("chat-input"),
  actionDrawer: document.getElementById("action-drawer"),
  settingsPanel: document.getElementById("settings-panel"),
  fallback: document.getElementById("model-fallback"),
  status: document.getElementById("model-status"),
  modelUrl: document.getElementById("model-url"),
  apiEndpoint: document.getElementById("api-endpoint"),
  apiKey: document.getElementById("api-key"),
  apiModel: document.getElementById("api-model"),
  scaleRange: document.getElementById("scale-range"),
  xRange: document.getElementById("x-range"),
  yRange: document.getElementById("y-range"),
};

const expressionParams = {
  "脸红": [
    { id: "Param5", value: 1 },
    { id: "ParamBrowLAngle", value: 0.75 },
  ],
  "哭哭": [
    { id: "Param3", value: 1 },
    { id: "ParamBrowLAngle", value: 1 },
    { id: "ParamBrowLForm", value: -0.55 },
  ],
  "爱心": [{ id: "Param4", value: 1 }],
  "眼罩": [{ id: "Param", value: 1 }],
  "冰块": [{ id: "Param6", value: 1 }],
  "狐耳": [{ id: "Param7", value: 1 }],
};

const localVoiceText = {
  "一直陪着你": "宝宝，我会一直陪着你的。",
  "超级厉害哦": "今天也超级厉害哦，我看见了。",
  "别硬撑": "别硬撑，先靠过来。我会陪你慢慢缓过来。",
};

const viewTitles = {
  overview: "总览",
  project: "项目设置",
  model: "模型管理",
  voices: "语音资产",
  tags: "触发标签",
  codes: "粉丝访问码",
  admin: "管理后台",
  audience: "粉丝入口",
};

function hashCode(value) {
  let hash = 5381;
  String(value)
    .trim()
    .toUpperCase()
    .split("")
    .forEach((char) => {
      hash = (hash * 33) ^ char.charCodeAt(0);
    });
  return `h${hash >>> 0}`;
}

function getDeviceHash() {
  let id = localStorage.getItem("live2d-demo-device-id");
  if (!id) {
    id = `device-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("live2d-demo-device-id", id);
  }
  return hashCode(`${id}:${navigator.userAgent.slice(0, 48)}`);
}

function isExpired(dateValue) {
  return new Date(`${dateValue}T23:59:59`) < new Date();
}

function statusClass(status) {
  return String(status).replaceAll("_", "-");
}

function progress(used, total) {
  return Math.min(100, Math.round((used / Math.max(total, 1)) * 100));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function audit(message) {
  platform.audit.unshift(message);
  platform.audit = platform.audit.slice(0, 8);
}

function renderApp() {
  dom.viewTitle.textContent = viewTitles[platform.activeView];
  dom.sidebarPlanName.textContent = platform.plan.name;
  dom.sidebarPlanMeta.textContent = `有效至 ${platform.plan.expiresAt}`;
  dom.previewTitle.textContent = platform.project.name;
  dom.phoneTitle.textContent = `${platform.project.name} - 智能桌面伴侣`;
  dom.statusPill.textContent = platform.project.status;
  dom.statusPill.className = `status-pill ${statusClass(platform.project.status)}`;
  dom.publishProject.textContent = platform.project.status === "published" ? "暂停项目" : "发布项目";

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === platform.activeView);
  });

  const renderers = {
    overview: renderOverview,
    project: renderProject,
    model: renderModel,
    voices: renderVoices,
    tags: renderTags,
    codes: renderCodes,
    admin: renderAdmin,
    audience: renderAudience,
  };
  dom.workspace.innerHTML = renderers[platform.activeView]();
  updateAudienceGate();
  refreshLiveControls();
}

function renderOverview() {
  return `
    <div class="metric-grid">
      ${metric("当前套餐", platform.plan.name, `过期日 ${platform.plan.expiresAt}`)}
      ${metric("AI 消息", `${platform.plan.usedAiMessages}/${platform.plan.monthlyAiMessageLimit}`, progressBar(platform.plan.usedAiMessages, platform.plan.monthlyAiMessageLimit))}
      ${metric("访问码额度", `${platform.plan.fanCodeQuota - platform.plan.generatedFanCodes} 可用`, `${platform.plan.generatedFanCodes}/${platform.plan.fanCodeQuota} 已生成`)}
      ${metric("存储", `${platform.plan.usedStorageMb} MB`, progressBar(platform.plan.usedStorageMb, platform.plan.storageLimitMb))}
    </div>
    <div class="split-grid">
      <section class="surface">
        <div class="surface-header">
          <h2>项目</h2>
          <button class="text-button" type="button" data-action="open-view" data-view="project">编辑</button>
        </div>
        <div class="project-row">
          <span class="avatar-chip">${escapeHtml(platform.project.avatar)}</span>
          <div>
            <strong>${escapeHtml(platform.project.name)}</strong>
            <p>${escapeHtml(platform.project.intro)}</p>
          </div>
          <span class="status-pill ${statusClass(platform.project.status)}">${platform.project.status}</span>
        </div>
        <dl class="detail-list">
          <div><dt>分享链接</dt><dd>${SHARE_URL}</dd></div>
          <div><dt>模型状态</dt><dd>${platform.project.modelStatus}</dd></div>
          <div><dt>触发标签</dt><dd>${platform.tags.filter((tag) => tag.enabled).length} 个已启用</dd></div>
        </dl>
      </section>
      <section class="surface">
        <div class="surface-header">
          <h2>最近操作</h2>
          <button class="text-button" type="button" data-action="open-view" data-view="admin">审计</button>
        </div>
        <ul class="timeline">
          ${platform.audit.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>
    </div>
  `;
}

function renderProject() {
  return `
    <section class="surface form-surface">
      <div class="surface-header">
        <h2>项目资料</h2>
        <span class="status-pill ${statusClass(platform.project.status)}">${platform.project.status}</span>
      </div>
      <div class="form-grid">
        ${field("项目名", "name", platform.project.name)}
        ${field("Slug", "slug", platform.project.slug)}
        ${field("头像字符", "avatar", platform.project.avatar)}
        ${field("主题色", "theme", platform.project.theme, "color")}
      </div>
      ${textarea("简介", "intro", platform.project.intro)}
      ${textarea("系统提示词", "systemPrompt", platform.project.systemPrompt)}
      ${textarea("默认欢迎语", "welcomeMessage", platform.project.welcomeMessage)}
      <div class="inline-actions">
        <button class="primary-button" type="button" data-action="save-project">保存项目设置</button>
        <button class="secondary-button" type="button" data-action="copy-share">复制分享链接</button>
      </div>
    </section>
  `;
}

function renderModel() {
  const errorList = platform.project.validationErrors.map((error) => `<li>${escapeHtml(error)}</li>`).join("");
  return `
    <section class="surface form-surface">
      <div class="surface-header">
        <h2>Live2D 模型</h2>
        <span class="status-pill ${statusClass(platform.project.modelStatus)}">${platform.project.modelStatus}</span>
      </div>
      <div class="upload-zone">
        <input id="model-zip" type="file" accept=".zip" />
        <div>
          <strong>上传 Cubism 4 model3.zip</strong>
          <p>原型会校验扩展名并模拟 model3.json、引用文件和路径穿越检查。</p>
        </div>
      </div>
      <label class="check-row">
        <input id="admin-assisted" type="checkbox" ${platform.project.adminAssisted ? "checked" : ""} />
        管理员协助配置模型
      </label>
      <dl class="detail-list">
        <div><dt>当前 model3.json</dt><dd>${escapeHtml(platform.project.modelJsonPath)}</dd></div>
        <div><dt>版本</dt><dd>v${platform.project.modelVersion}</dd></div>
      </dl>
      <div class="validation-box">
        <strong>验证结果</strong>
        <ul>${errorList || "<li>通过：已定位 model3.json，引用资源完整，无危险路径。</li>"}</ul>
      </div>
      <button class="secondary-button" type="button" data-action="rollback-model">回滚到上一成功版本</button>
    </section>
  `;
}

function renderVoices() {
  return `
    <section class="surface form-surface">
      <div class="surface-header">
        <h2>预置语音</h2>
        <span>${platform.voices.length} 个资产</span>
      </div>
      <div class="upload-zone">
        <input id="voice-upload" type="file" accept=".wav,.mp3,audio/wav,audio/mpeg" />
        <div>
          <strong>上传 WAV/MP3</strong>
          <p>上传后可绑定到触发标签，粉丝页动作面板会同步更新。</p>
        </div>
      </div>
      <div class="table-list">
        ${platform.voices
          .map(
            (voice) => `
              <div class="table-row">
                <div><strong>${escapeHtml(voice.name)}</strong><span>${voice.duration} · ${voice.tags.join(", ") || "未绑定"}</span></div>
                <button class="text-button" type="button" data-action="play-voice" data-id="${voice.id}">试听</button>
                <button class="text-button danger" type="button" data-action="delete-voice" data-id="${voice.id}">删除</button>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
    <section class="surface form-surface">
      <div class="surface-header">
        <h2>声音克隆请求</h2>
        <span class="status-pill reviewing">manual review</span>
      </div>
      <label class="check-row">
        <input id="clone-auth" type="checkbox" />
        我确认拥有声音授权，允许平台管理员人工审核
      </label>
      ${textarea("请求备注", "cloneNotes", "希望优先克隆日常陪伴语气。", "clone-notes")}
      <button class="primary-button" type="button" data-action="submit-clone">提交克隆请求</button>
    </section>
  `;
}

function renderTags() {
  return `
    <section class="surface form-surface">
      <div class="surface-header">
        <h2>统一触发标签</h2>
        <button class="secondary-button" type="button" data-action="add-tag">新增标签</button>
      </div>
      <div class="tag-editor">
        ${platform.tags.map(renderTag).join("")}
      </div>
    </section>
    <section class="surface form-surface">
      <div class="surface-header">
        <h2>测试触发</h2>
        <span id="tag-test-result">等待输入</span>
      </div>
      <div class="test-row">
        <input id="tag-test-input" placeholder="输入一句粉丝消息，例如：今天压力很大" />
        <button class="primary-button" type="button" data-action="test-tags">测试</button>
      </div>
    </section>
  `;
}

function renderTag(tag) {
  return `
    <article class="tag-card">
      <div class="tag-card-header">
        <strong>${escapeHtml(tag.name)}</strong>
        <label class="switch">
          <input type="checkbox" data-action="toggle-tag" data-id="${tag.id}" ${tag.enabled ? "checked" : ""} />
          <span></span>
        </label>
      </div>
      <div class="form-grid">
        ${field("关键词", `keywords:${tag.id}`, tag.keywords)}
        ${field("优先级", `priority:${tag.id}`, tag.priority, "number")}
      </div>
      ${textarea("语义描述", `description:${tag.id}`, tag.description)}
      ${textarea("Prompt 片段", `promptFragment:${tag.id}`, tag.promptFragment)}
      <p class="muted-line">Live2D: ${escapeHtml(tag.live2dExpression || "无")} ${escapeHtml(tag.live2dParams || "")}</p>
    </article>
  `;
}

function renderCodes() {
  const rows = platform.fanCodes.map((code) => {
    const status = code.status === "active" && isExpired(code.expiresAt) ? "expired" : code.status;
    const binding = code.bindMode === "browserDevice" ? code.boundDeviceHash || "待绑定" : "不绑定";
    return `
      <div class="table-row">
        <div>
          <strong>${code.displayCode ? escapeHtml(code.displayCode) : "已隐藏"}</strong>
          <span>${status} · ${code.usedMessages}/${code.maxMessages} 消息 · ${binding}</span>
        </div>
        <span>${code.expiresAt}</span>
        <button class="text-button danger" type="button" data-action="revoke-code" data-id="${code.id}">撤销</button>
      </div>
    `;
  });

  return `
    <section class="surface form-surface">
      <div class="surface-header">
        <h2>生成访问码</h2>
        <span>${platform.plan.fanCodeQuota - platform.plan.generatedFanCodes} 个额度可用</span>
      </div>
      <div class="form-grid">
        ${field("数量", "codeQuantity", "5", "number", 1, 50)}
        ${field("过期日", "codeExpiresAt", "2026-07-06", "date")}
        ${field("每码消息数", "codeLimit", "20", "number", 1, 500)}
        <label>
          设备绑定
          <select id="bind-mode">
            <option value="browserDevice">浏览器设备</option>
            <option value="none">不绑定</option>
          </select>
        </label>
      </div>
      <div class="inline-actions">
        <button class="primary-button" type="button" data-action="generate-codes">生成代码</button>
        <button class="secondary-button" type="button" data-action="export-csv">导出本批 CSV</button>
      </div>
      ${platform.lastGeneratedCodes.length ? `<pre class="code-output">${platform.lastGeneratedCodes.join("\n")}</pre>` : ""}
    </section>
    <section class="surface">
      <div class="surface-header">
        <h2>访问码状态</h2>
        <span>只保存 hash，明文只在生成时展示</span>
      </div>
      <div class="table-list">${rows.join("")}</div>
    </section>
  `;
}

function renderAdmin() {
  return `
    <div class="split-grid">
      <section class="surface form-surface">
        <div class="surface-header">
          <h2>手工订单和套餐</h2>
          <span class="status-pill confirmed">confirmed</span>
        </div>
        <dl class="detail-list">
          <div><dt>订单号</dt><dd>M-20260606-001</dd></div>
          <div><dt>金额</dt><dd>CNY 399 · 微信</dd></div>
          <div><dt>套餐</dt><dd>${platform.plan.name} · ${platform.plan.expiresAt}</dd></div>
        </dl>
        <button class="primary-button" type="button" data-action="extend-plan">延长 30 天并授予额度</button>
      </section>
      <section class="surface form-surface">
        <div class="surface-header">
          <h2>运营处理</h2>
          <span>${platform.cloneRequests.length} 个声音请求</span>
        </div>
        <div class="table-list">
          ${platform.cloneRequests
            .map(
              (request) => `
                <div class="table-row">
                  <div><strong>${escapeHtml(request.project)}</strong><span>${request.status} · ${escapeHtml(request.notes)}</span></div>
                  <button class="text-button" type="button" data-action="fulfill-clone" data-id="${request.id}">标记完成</button>
                </div>
              `,
            )
            .join("")}
        </div>
        <button class="secondary-button" type="button" data-action="toggle-project-status">暂停/恢复项目</button>
      </section>
    </div>
    <section class="surface">
      <div class="surface-header">
        <h2>审计日志</h2>
        <span>payment · quota · project · admin</span>
      </div>
      <ul class="timeline">${platform.audit.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
  `;
}

function renderAudience() {
  const session = getCurrentCode();
  return `
    <section class="surface">
      <div class="surface-header">
        <h2>粉丝分享页</h2>
        <span>${SHARE_URL}</span>
      </div>
      <dl class="detail-list">
        <div><dt>访问状态</dt><dd>${session ? "已通过访问码" : "等待输入访问码"}</dd></div>
        <div><dt>剩余消息</dt><dd>${session ? session.maxMessages - session.usedMessages : "未进入"}</dd></div>
        <div><dt>设备绑定</dt><dd>${session?.bindMode === "browserDevice" ? session.boundDeviceHash || "首次使用时绑定" : "不绑定"}</dd></div>
      </dl>
      <div class="inline-actions">
        <button class="primary-button" type="button" data-action="focus-code">输入访问码</button>
        <button class="secondary-button" type="button" data-action="logout-fan">退出粉丝会话</button>
      </div>
    </section>
    <section class="surface">
      <div class="surface-header">
        <h2>错误态覆盖</h2>
      </div>
      <div class="state-grid">
        <span>无效代码</span>
        <span>项目未发布</span>
        <span>消息额度用尽</span>
        <span>设备不匹配</span>
      </div>
    </section>
  `;
}

function metric(label, value, detail) {
  return `
    <section class="metric-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${detail}</small>
    </section>
  `;
}

function progressBar(used, total) {
  return `<span class="progress"><i style="width:${progress(used, total)}%"></i></span>`;
}

function field(label, name, value, type = "text", min = "", max = "") {
  return `
    <label>
      ${label}
      <input data-field="${name}" type="${type}" value="${escapeHtml(value)}" ${min !== "" ? `min="${min}"` : ""} ${max !== "" ? `max="${max}"` : ""} />
    </label>
  `;
}

function textarea(label, name, value, id = "") {
  return `
    <label>
      ${label}
      <textarea ${id ? `id="${id}"` : ""} data-field="${name}">${escapeHtml(value)}</textarea>
    </label>
  `;
}

function refreshLiveControls() {
  const voiceGrid = document.getElementById("voice-grid");
  const emotionGrid = document.getElementById("emotion-grid");
  const formGrid = document.getElementById("form-grid");
  if (!voiceGrid || !emotionGrid || !formGrid) return;

  voiceGrid.innerHTML = platform.voices
    .map((voice) => `<button type="button" class="chip" data-name="${escapeHtml(voice.name)}" data-voice-id="${voice.id}">${escapeHtml(voice.name)}</button>`)
    .join("");

  const enabledNames = platform.tags.filter((tag) => tag.enabled).map((tag) => tag.name);
  emotionGrid.innerHTML = ["脸红", "哭哭", "爱心"]
    .filter((name) => enabledNames.includes(name))
    .map((name) => `<button type="button" class="chip" data-name="${name}">${name}</button>`)
    .join("");
  formGrid.innerHTML = ["眼罩", "冰块", "狐耳"]
    .map((name) => `<button type="button" class="chip" data-name="${name}">${name}</button>`)
    .join("");

  refreshActiveChips();
}

function updateAudienceGate(message = "") {
  const session = getCurrentCode();
  const isPublished = platform.project.status === "published";
  dom.accessGate.classList.toggle("hidden", Boolean(session && isPublished));
  dom.chatInput.disabled = !session || !isPublished;
  dom.chatForm.querySelector("button").disabled = !session || !isPublished;

  if (message) {
    dom.gateMessage.textContent = message;
  } else if (!isPublished) {
    dom.gateMessage.textContent = "项目尚未发布。创作者发布后，粉丝才能输入访问码。";
  } else {
    dom.gateMessage.textContent = "请输入有效访问码。示例种子码：YURI-2026。";
  }
}

function getCurrentCode() {
  return platform.fanCodes.find((code) => code.id === platform.currentSessionCodeId && code.status === "active");
}

function validateAccessCode(rawCode) {
  if (platform.project.status !== "published") return { ok: false, message: "项目未发布，无法进入。" };
  const code = platform.fanCodes.find((item) => item.codeHash === hashCode(rawCode));
  if (!code || code.status !== "active") return { ok: false, message: "访问码无效或已撤销。" };
  if (isExpired(code.expiresAt)) return { ok: false, message: "访问码已过期。" };
  if (code.usedMessages >= code.maxMessages) return { ok: false, message: "访问码消息额度已用尽。" };

  if (code.bindMode === "browserDevice") {
    const deviceHash = getDeviceHash();
    if (code.boundDeviceHash && code.boundDeviceHash !== deviceHash) {
      return { ok: false, message: "访问码已绑定到其他浏览器设备。" };
    }
    if (!code.boundDeviceHash) {
      code.boundDeviceHash = deviceHash;
      audit(`Fan code ${code.id} bound to browser device`);
    }
  }

  platform.currentSessionCodeId = code.id;
  return { ok: true, message: `已进入，剩余 ${code.maxMessages - code.usedMessages} 条消息。` };
}

function handleWorkspaceInput(event) {
  const fieldName = event.target.dataset.field;
  if (!fieldName) return;

  if (fieldName.includes(":")) {
    const [key, id] = fieldName.split(":");
    const tag = platform.tags.find((item) => item.id === id);
    if (!tag) return;
    tag[key] = key === "priority" ? Number(event.target.value) : event.target.value;
    return;
  }

  if (fieldName in platform.project) {
    platform.project[fieldName] = event.target.value;
    if (fieldName === "name") {
      dom.previewTitle.textContent = platform.project.name;
      dom.phoneTitle.textContent = `${platform.project.name} - 智能桌面伴侣`;
    }
  }
}

function handleWorkspaceClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "open-view") {
    platform.activeView = target.dataset.view;
    renderApp();
  }
  if (action === "save-project") {
    audit(`Creator saved project settings for ${platform.project.slug}`);
    renderApp();
  }
  if (action === "copy-share") {
    copyShareLink();
  }
  if (action === "rollback-model") {
    platform.project.modelStatus = "valid";
    platform.project.validationErrors = [];
    audit("Creator rolled model back to latest valid version");
    renderApp();
  }
  if (action === "play-voice") {
    const voice = platform.voices.find((item) => item.id === target.dataset.id);
    if (voice) speakText(localVoiceText[voice.name] || `${voice.name}，试听播放。`, voice.name);
  }
  if (action === "delete-voice") {
    platform.voices = platform.voices.filter((item) => item.id !== target.dataset.id);
    audit("Creator deleted one voice asset");
    renderApp();
  }
  if (action === "submit-clone") {
    const auth = document.getElementById("clone-auth")?.checked;
    const notes = document.getElementById("clone-notes")?.value.trim();
    if (!auth) {
      alert("需要先确认声音授权。");
      return;
    }
    platform.cloneRequests.unshift({
      id: `r${Date.now()}`,
      project: platform.project.name,
      status: "submitted",
      authorizationConfirmed: true,
      notes: notes || "无备注",
    });
    audit("Creator submitted voice clone request");
    renderApp();
  }
  if (action === "add-tag") {
    platform.tags.push({
      id: `t${Date.now()}`,
      name: "新标签",
      description: "待配置",
      keywords: "",
      promptFragment: "",
      live2dExpression: "",
      live2dParams: "",
      voiceAssetIds: [],
      priority: 10,
      enabled: true,
    });
    audit("Creator added trigger tag");
    renderApp();
  }
  if (action === "test-tags") {
    testTags();
  }
  if (action === "generate-codes") {
    generateFanCodes();
  }
  if (action === "export-csv") {
    exportLastCodes();
  }
  if (action === "revoke-code") {
    const code = platform.fanCodes.find((item) => item.id === target.dataset.id);
    if (code) code.status = "revoked";
    audit(`Creator revoked fan code ${target.dataset.id}`);
    renderApp();
  }
  if (action === "extend-plan") {
    platform.plan.expiresAt = "2026-08-05";
    platform.plan.fanCodeQuota += 50;
    platform.plan.monthlyAiMessageLimit += 2000;
    audit("Ops Admin extended creator plan and granted quota");
    renderApp();
  }
  if (action === "fulfill-clone") {
    const request = platform.cloneRequests.find((item) => item.id === target.dataset.id);
    if (request) request.status = "fulfilled";
    audit("Ops Admin fulfilled a voice clone request");
    renderApp();
  }
  if (action === "toggle-project-status") {
    platform.project.status = platform.project.status === "paused" ? "published" : "paused";
    audit(`Ops Admin changed project status to ${platform.project.status}`);
    renderApp();
  }
  if (action === "focus-code") {
    dom.accessCodeInput.focus();
  }
  if (action === "logout-fan") {
    platform.currentSessionCodeId = "";
    updateAudienceGate("粉丝会话已退出。");
    renderApp();
  }
}

function handleWorkspaceChange(event) {
  if (event.target.id === "model-zip") {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      platform.project.modelStatus = "invalid";
      platform.project.validationErrors = ["文件不是 zip 格式。"];
    } else {
      platform.project.modelStatus = "valid";
      platform.project.modelVersion += 1;
      platform.project.modelJsonPath = `${file.name.replace(/\.zip$/i, "")}/model3.json`;
      platform.project.validationErrors = [];
      audit(`Creator uploaded Live2D model zip ${file.name}`);
    }
    renderApp();
  }

  if (event.target.id === "admin-assisted") {
    platform.project.adminAssisted = event.target.checked;
    platform.project.modelStatus = event.target.checked ? "pending" : platform.project.modelStatus;
    platform.project.validationErrors = event.target.checked ? ["已进入管理员协助配置队列。"] : platform.project.validationErrors;
    audit("Creator toggled admin-assisted model setup");
    renderApp();
  }

  if (event.target.id === "voice-upload") {
    const file = event.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\.(wav|mp3)$/i, "");
    platform.voices.push({ id: `v${Date.now()}`, name, duration: "待分析", tags: [], status: "active" });
    audit(`Creator uploaded voice asset ${file.name}`);
    renderApp();
  }

  if (event.target.matches('[data-action="toggle-tag"]')) {
    const tag = platform.tags.find((item) => item.id === event.target.dataset.id);
    if (tag) tag.enabled = event.target.checked;
    audit(`Creator ${event.target.checked ? "enabled" : "disabled"} trigger tag`);
    renderApp();
  }
}

function testTags() {
  const input = document.getElementById("tag-test-input");
  const result = document.getElementById("tag-test-result");
  const text = input?.value || "";
  const matches = platform.tags
    .filter((tag) => tag.enabled)
    .filter((tag) => tag.keywords.split(",").some((keyword) => keyword.trim() && text.includes(keyword.trim())))
    .sort((a, b) => b.priority - a.priority);
  result.textContent = matches.length ? matches.map((tag) => tag.name).join(" / ") : "未触发";
  matches.slice(0, 2).forEach((tag) => triggerExpression(tag.name));
}

function generateFanCodes() {
  const quantity = Number(document.querySelector('[data-field="codeQuantity"]')?.value || 0);
  const expiresAt = document.querySelector('[data-field="codeExpiresAt"]')?.value || "2026-07-06";
  const maxMessages = Number(document.querySelector('[data-field="codeLimit"]')?.value || 20);
  const bindMode = document.getElementById("bind-mode")?.value || "browserDevice";
  const remaining = platform.plan.fanCodeQuota - platform.plan.generatedFanCodes;

  if (quantity < 1 || quantity > remaining) {
    alert(`数量必须在 1 到 ${remaining} 之间。`);
    return;
  }

  const batchId = `batch-${Date.now()}`;
  const generated = Array.from({ length: quantity }, (_, index) => {
    const code = `YURI-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${index + 1}`;
    platform.fanCodes.unshift({
      id: `c${Date.now()}-${index}`,
      codeHash: hashCode(code),
      displayCode: code,
      expiresAt,
      maxMessages,
      usedMessages: 0,
      bindMode,
      boundDeviceHash: "",
      status: "active",
      batchId,
    });
    return code;
  });

  platform.lastGeneratedCodes = generated;
  platform.plan.generatedFanCodes += quantity;
  audit(`Creator generated ${quantity} fan access codes`);
  renderApp();
}

function exportLastCodes() {
  if (!platform.lastGeneratedCodes.length) {
    alert("请先生成一批访问码。");
    return;
  }
  const csv = ["code", ...platform.lastGeneratedCodes].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "fan-access-codes.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function copyShareLink() {
  navigator.clipboard?.writeText(SHARE_URL);
  audit("Creator copied audience share link");
  renderApp();
}

function publishProject() {
  if (platform.project.modelStatus !== "valid" && !platform.project.adminAssisted) {
    alert("发布前需要有效模型，或选择管理员协助配置。");
    return;
  }
  platform.project.status = platform.project.status === "published" ? "paused" : "published";
  audit(`Creator changed project status to ${platform.project.status}`);
  renderApp();
}

function persistSettings() {
  localStorage.setItem(
    "live2d-companion-settings",
    JSON.stringify({
      modelUrl: dom.modelUrl.value,
      endpoint: dom.apiEndpoint.value,
      apiKey: dom.apiKey.value,
      apiModel: dom.apiModel.value,
      scale: dom.scaleRange.value,
      x: dom.xRange.value,
      y: dom.yRange.value,
    }),
  );
}

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem("live2d-companion-settings") || "{}");
  dom.modelUrl.value = saved.modelUrl || DEFAULT_MODEL_URL;
  dom.apiEndpoint.value = saved.endpoint || "";
  dom.apiKey.value = saved.apiKey || "";
  dom.apiModel.value = saved.apiModel || "";
  dom.scaleRange.value = saved.scale || "1.05";
  dom.xRange.value = saved.x || "0";
  dom.yRange.value = saved.y || "70";
}

function setStatus(text) {
  dom.status.textContent = text;
}

function appendMessage(role, html) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.innerHTML = html;
  dom.chatList.appendChild(el);
  const children = Array.from(dom.chatList.children);
  while (children.length > 6) {
    dom.chatList.removeChild(children.shift());
  }
  return el;
}

function formatAssistantMessage(raw) {
  const match = /【([^】]+)】/.exec(raw);
  const tag = match?.[1]?.trim();
  const text = raw.replace(/【[^】]+】/g, "").trim();
  if (tag) {
    triggerExpression(tag);
    return `<span class="tag">【${escapeHtml(tag)}】</span>${escapeHtml(text)}`;
  }
  return escapeHtml(text || raw);
}

function setupPixi() {
  if (state.app) {
    state.app.destroy(true, { children: true, texture: false, baseTexture: false });
  }

  window.PIXI = PIXI;
  state.app = new PIXI.Application({
    view: dom.canvas,
    transparent: true,
    backgroundAlpha: 0,
    resizeTo: document.querySelector(".model-area"),
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 3),
    autoDensity: true,
    powerPreference: "high-performance",
  });
}

async function loadModel() {
  persistSettings();
  setStatus("模型加载中");
  dom.fallback.classList.remove("visible");
  setupPixi();

  try {
    const url = dom.modelUrl.value.trim() || DEFAULT_MODEL_URL;
    state.model = await PIXI.live2d.Live2DModel.from(url);
    state.app.stage.addChild(state.model);

    state.model.anchor?.set?.(0.5, 1);
    state.model.x = state.app.renderer.width / 2;
    state.model.y = state.app.renderer.height;
    state.baseWidth = state.model.internalModel?.width || state.model.width || 900;
    state.baseHeight = state.model.internalModel?.height || state.model.height || 1400;

    const internal = state.model.internalModel;
    internal?.on?.("beforeModelUpdate", onBeforeModelUpdate);
    window.addEventListener("pointermove", followPointer);
    window.addEventListener("resize", updateModelLayout);
    updateModelLayout();
    setStatus("模型已唤醒");

    setTimeout(() => {
      appendMessage("ai", `<span class="tag">【脸红】</span>${escapeHtml(platform.project.welcomeMessage)}`);
      triggerExpression("脸红");
      speakText(localVoiceText["一直陪着你"], "一直陪着你");
    }, 350);
  } catch (error) {
    console.error(error);
    setStatus("模型加载失败");
    dom.fallback.classList.add("visible");
  }
}

function updateModelLayout() {
  if (!state.model || !state.app) return;
  const viewport = document.querySelector(".model-area").getBoundingClientRect();
  const scale = Number(dom.scaleRange.value);
  const x = Number(dom.xRange.value);
  const y = Number(dom.yRange.value);

  const fit = viewport.height / Math.max(state.baseHeight, 1);
  state.model.scale.set(fit * scale);
  state.model.x = viewport.width / 2 + x;
  state.model.y = viewport.height + y;
}

function onBeforeModelUpdate() {
  const core = this.coreModel;
  driveMouth(core);
  applyExpressionState(core);
}

function setParam(core, id, value) {
  if (!core) return;
  if (core.parameters?.ids) {
    const index = core.parameters.ids.indexOf(id);
    if (index >= 0) {
      core.parameters.values[index] = value;
      return;
    }
  }
  if (typeof core.setParameterValueById === "function") {
    core.setParameterValueById(id, value);
  }
}

function getParam(core, id) {
  if (!core) return 0;
  if (core.parameters?.ids) {
    const index = core.parameters.ids.indexOf(id);
    if (index >= 0) return core.parameters.values[index];
  }
  if (typeof core.getParameterValueById === "function") {
    return core.getParameterValueById(id);
  }
  return 0;
}

function driveMouth(core) {
  let target = 0;
  if (state.analyser && !state.audio.paused) {
    const data = new Uint8Array(state.analyser.frequencyBinCount);
    state.analyser.getByteTimeDomainData(data);
    const rms = Math.sqrt(
      data.reduce((sum, sample) => {
        const amp = (sample - 128) / 128;
        return sum + amp * amp;
      }, 0) / data.length,
    );
    target = Math.min(1, Math.pow(rms * 14, 1.18));
    if (target < 0.02) target = 0;
  }

  const current = getParam(core, "ParamMouthOpenY") || 0;
  const easing = target > current ? 0.86 : 0.62;
  setParam(core, "ParamMouthOpenY", current + (target - current) * easing);
}

function applyExpressionState(core) {
  Object.keys(expressionParams).forEach((name) => {
    state.expWeights[name] ||= { current: 0, target: 0 };
    const isActive = Object.values(state.activeStates).includes(name);
    state.expWeights[name].target = isActive ? 1 : 0;
    state.expWeights[name].current += (state.expWeights[name].target - state.expWeights[name].current) * 0.16;

    if (state.expWeights[name].current > 0.001) {
      expressionParams[name].forEach((param) => {
        const current = getParam(core, param.id);
        setParam(core, param.id, current + (param.value - current) * state.expWeights[name].current);
      });
    }
  });
}

function followPointer(event) {
  if (!state.model) return;
  state.model.focus(event.clientX, event.clientY);
}

function triggerExpression(name) {
  if (!expressionParams[name]) return;
  const group = ["眼罩", "冰块", "狐耳"].includes(name) ? "form" : "emotion";
  state.activeStates[group] = name;
  refreshActiveChips();
  clearTimeout(state.timers[group]);
  if (group === "emotion") {
    state.timers[group] = setTimeout(() => {
      if (state.activeStates[group] === name) {
        state.activeStates[group] = null;
        refreshActiveChips();
      }
    }, 4200);
  }
}

function toggleExpression(name) {
  const group = ["眼罩", "冰块", "狐耳"].includes(name) ? "form" : "emotion";
  state.activeStates[group] = state.activeStates[group] === name ? null : name;
  refreshActiveChips();
}

function refreshActiveChips() {
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", Object.values(state.activeStates).includes(chip.dataset.name) || state.currentVoice === chip.dataset.name);
  });
}

function setupAudio() {
  if (state.audioCtx) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  state.audioCtx = new AudioContextClass();
  state.analyser = state.audioCtx.createAnalyser();
  state.analyser.fftSize = 256;
  const source = state.audioCtx.createMediaElementSource(state.audio);
  source.connect(state.analyser);
  state.analyser.connect(state.audioCtx.destination);
}

function speakText(text, voiceName) {
  state.currentVoice = voiceName || null;
  refreshActiveChips();

  if ("speechSynthesis" in window) {
    setupAudio();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.94;
    utterance.pitch = 1.08;
    utterance.onend = () => {
      state.currentVoice = null;
      refreshActiveChips();
    };
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
    synthMouthPulse(text.length);
  }
}

function synthMouthPulse(length) {
  const core = state.model?.internalModel?.coreModel;
  if (!core) return;
  const duration = Math.min(3600, Math.max(900, length * 105));
  const start = performance.now();
  const tick = () => {
    const elapsed = performance.now() - start;
    if (elapsed > duration) return;
    const wave = Math.abs(Math.sin(elapsed / 72)) * 0.72;
    setParam(core, "ParamMouthOpenY", wave);
    requestAnimationFrame(tick);
  };
  tick();
}

async function sendMessage(text) {
  const code = getCurrentCode();
  if (!code || platform.project.status !== "published") {
    updateAudienceGate("请先通过访问码进入粉丝页面。");
    return;
  }
  if (code.usedMessages >= code.maxMessages) {
    platform.currentSessionCodeId = "";
    updateAudienceGate("访问码消息额度已用尽。");
    renderApp();
    return;
  }

  appendMessage("user", escapeHtml(text));
  state.messages.push({ role: "user", content: text });
  const loading = appendMessage("ai", `<span class="tag">【思考】</span>尤里正在看着你...`);

  try {
    const raw = await getAssistantReply(text);
    loading.innerHTML = formatAssistantMessage(raw);
    state.messages.push({ role: "assistant", content: raw });
    speakText(raw.replace(/【[^】]+】/g, "").trim(), null);
    deductQuota(code);
  } catch (error) {
    console.error(error);
    loading.innerHTML = `<span class="tag">【系统】</span>AI 调用失败，本次不扣除额度。`;
  }
}

function deductQuota(code) {
  code.usedMessages += 1;
  platform.plan.usedAiMessages += 1;
  audit(`Quota deducted for fan code ${code.id}`);
  updateAudienceGate(`已进入，剩余 ${code.maxMessages - code.usedMessages} 条消息。`);
  if (platform.activeView === "overview" || platform.activeView === "audience" || platform.activeView === "codes") {
    renderApp();
  }
}

async function getAssistantReply(text) {
  const endpoint = dom.apiEndpoint.value.trim();
  const key = dom.apiKey.value.trim();
  const model = dom.apiModel.value.trim();
  persistSettings();

  if (!endpoint || !key || !model) {
    return localReply(text);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: state.messages.slice(-12),
      temperature: 0.7,
    }),
  });

  if (!response.ok) throw new Error(`API failed: ${response.status}`);
  const data = await response.json();
  return normalizeAssistantReply(data.choices?.[0]?.message?.content || "");
}

function normalizeAssistantReply(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.reply) {
      const firstTag = parsed.tags?.find((tag) => platform.tags.some((item) => item.enabled && item.name === tag));
      return firstTag ? `【${firstTag}】${parsed.reply}` : parsed.reply;
    }
  } catch {
    return raw || "【脸红】嗯，我听见了。继续说，我会认真记住你的语气。";
  }
  return raw;
}

function localReply(text) {
  const lower = text.toLowerCase();
  if (/想|喜欢|陪|爱/.test(text)) return "【脸红】我知道了。那今天也乖一点，让我陪着你。";
  if (/哭|难过|累|压力|烦/.test(text)) return "【哭哭】别硬撑，先靠过来。我会慢慢陪你缓过来。";
  if (/走|跑|别人|离开/.test(text)) return "【狐耳】不许乱跑。你答应过要让我看见你的。";
  if (/夸|厉害|完成|做完/.test(text)) return "【爱心】做得很好。这样的你，我当然会偏心。";
  if (lower.includes("ice") || /冷|冰/.test(text)) return "【冰块】手这么冷，还不靠近一点让我管着你。";
  return "【脸红】嗯，我听见了。继续说，我会认真记住你的语气。";
}

function drawBackground() {
  const canvas = dom.bgCanvas;
  const context = canvas.getContext("2d");
  const resize = () => {
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
  };
  resize();
  const points = Array.from({ length: 34 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.6 + 0.7,
    v: Math.random() * 0.00035 + 0.0001,
  }));

  const frame = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(15, 118, 110, 0.16)";
    points.forEach((point) => {
      point.y -= point.v;
      if (point.y < -0.02) point.y = 1.02;
      context.beginPath();
      context.arc(point.x * canvas.width, point.y * canvas.height, point.r * window.devicePixelRatio, 0, Math.PI * 2);
      context.fill();
    });
    requestAnimationFrame(frame);
  };

  window.addEventListener("resize", resize);
  frame();
}

function bindEvents() {
  dom.navList.addEventListener("click", (event) => {
    const item = event.target.closest(".nav-item");
    if (!item) return;
    platform.activeView = item.dataset.view;
    renderApp();
  });

  dom.workspace.addEventListener("input", handleWorkspaceInput);
  dom.workspace.addEventListener("click", handleWorkspaceClick);
  dom.workspace.addEventListener("change", handleWorkspaceChange);
  dom.publishProject.addEventListener("click", publishProject);
  dom.copyShareLink.addEventListener("click", copyShareLink);

  dom.accessForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = validateAccessCode(dom.accessCodeInput.value);
    dom.accessCodeInput.value = "";
    updateAudienceGate(result.message);
    if (result.ok) {
      appendMessage("ai", `<span class="tag">【脸红】</span>${escapeHtml(platform.project.welcomeMessage)}`);
      renderApp();
    }
  });

  document.getElementById("drawer-button").addEventListener("click", () => {
    dom.actionDrawer.classList.toggle("open");
    dom.settingsPanel.classList.remove("open");
  });
  document.getElementById("settings-button").addEventListener("click", () => {
    dom.settingsPanel.classList.toggle("open");
    dom.actionDrawer.classList.remove("open");
  });
  document.getElementById("close-settings").addEventListener("click", () => {
    dom.settingsPanel.classList.remove("open");
  });
  document.getElementById("voice-button").addEventListener("click", () => {
    const voice = platform.voices[0];
    appendMessage("ai", `<span class="tag">【脸红】</span>${escapeHtml(localVoiceText[voice.name] || voice.name)}`);
    triggerExpression("脸红");
    speakText(localVoiceText[voice.name] || voice.name, voice.name);
  });
  document.getElementById("reload-model").addEventListener("click", loadModel);
  document.getElementById("reset-settings").addEventListener("click", () => {
    localStorage.removeItem("live2d-companion-settings");
    loadSettings();
    updateModelLayout();
  });

  document.querySelector(".phone").addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    const voiceId = chip.dataset.voiceId;
    if (voiceId) {
      const voice = platform.voices.find((item) => item.id === voiceId);
      appendMessage("ai", `<span class="tag">【脸红】</span>${escapeHtml(localVoiceText[voice.name] || voice.name)}`);
      triggerExpression("脸红");
      speakText(localVoiceText[voice.name] || voice.name, voice.name);
      return;
    }
    toggleExpression(chip.dataset.name);
  });

  [dom.scaleRange, dom.xRange, dom.yRange].forEach((input) => {
    input.addEventListener("input", () => {
      persistSettings();
      updateModelLayout();
    });
  });

  [dom.apiEndpoint, dom.apiKey, dom.apiModel, dom.modelUrl].forEach((input) => {
    input.addEventListener("change", persistSettings);
  });

  dom.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = dom.chatInput.value.trim();
    if (!text) return;
    dom.chatInput.value = "";
    sendMessage(text);
  });
}

async function boot() {
  loadSettings();
  bindEvents();
  renderApp();
  drawBackground();
  await loadModel();
}

boot();
