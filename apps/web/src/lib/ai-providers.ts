// Curated list of OpenAI-compatible chat providers. Base URLs were verified
// against each vendor's official "OpenAI compatibility" docs. An admin picks a
// preset → the base URL (and a suggested default model) auto-fills, so they only
// need to paste an API key. Model names are best-effort defaults and editable.

export type AiProviderRegion = "cn" | "intl" | "custom";

export type AiProviderPreset = {
  id: string;
  label: string;
  region: AiProviderRegion;
  baseUrl: string;
  /** Suggested models for the datalist dropdown; the first one is the default. */
  models: readonly string[];
  consoleUrl?: string;
};

export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
  // ── 国内 (China) ───────────────────────────────────────────────────────────
  { id: "deepseek", label: "DeepSeek 深度求索", region: "cn", baseUrl: "https://api.deepseek.com/v1", models: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"], consoleUrl: "https://platform.deepseek.com/api_keys" },
  { id: "qwen", label: "阿里云百炼 · 通义千问 Qwen", region: "cn", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: ["qwen-plus", "qwen-turbo", "qwen-max", "qwen-long", "qwen2.5-72b-instruct"], consoleUrl: "https://bailian.console.aliyun.com/" },
  { id: "zhipu", label: "智谱 GLM (Zhipu AI)", region: "cn", baseUrl: "https://open.bigmodel.cn/api/paas/v4", models: ["glm-4-plus", "glm-4-air", "glm-4-flash", "glm-4-long", "glm-4v-plus"], consoleUrl: "https://open.bigmodel.cn/usercenter/apikeys" },
  { id: "doubao", label: "火山方舟 · 豆包 Doubao", region: "cn", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", models: ["doubao-pro-32k", "doubao-pro-128k", "doubao-1.5-pro-32k", "doubao-lite-32k"], consoleUrl: "https://console.volcengine.com/ark" },
  { id: "moonshot", label: "月之暗面 Kimi (Moonshot)", region: "cn", baseUrl: "https://api.moonshot.cn/v1", models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k", "kimi-latest"], consoleUrl: "https://platform.moonshot.cn/console/api-keys" },
  { id: "qianfan", label: "百度千帆 · 文心 ERNIE", region: "cn", baseUrl: "https://qianfan.baidubce.com/v2", models: ["ernie-4.0-8k", "ernie-4.0-turbo-8k", "ernie-3.5-8k", "ernie-speed-128k"], consoleUrl: "https://console.bce.baidu.com/qianfan/" },
  { id: "hunyuan", label: "腾讯混元 Hunyuan", region: "cn", baseUrl: "https://api.hunyuan.cloud.tencent.com/v1", models: ["hunyuan-turbo", "hunyuan-pro", "hunyuan-standard", "hunyuan-lite"], consoleUrl: "https://console.cloud.tencent.com/hunyuan" },
  { id: "minimax", label: "MiniMax 海螺", region: "cn", baseUrl: "https://api.minimaxi.com/v1", models: ["MiniMax-Text-01", "abab6.5s-chat"], consoleUrl: "https://platform.minimaxi.com/" },
  { id: "siliconflow", label: "硅基流动 SiliconFlow", region: "cn", baseUrl: "https://api.siliconflow.cn/v1", models: ["deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1", "Qwen/Qwen2.5-72B-Instruct", "meta-llama/Llama-3.3-70B-Instruct"], consoleUrl: "https://cloud.siliconflow.cn/account/ak" },
  { id: "yi", label: "零一万物 Yi (01.AI)", region: "cn", baseUrl: "https://api.lingyiwanwu.com/v1", models: ["yi-large", "yi-medium", "yi-large-turbo", "yi-vision"], consoleUrl: "https://platform.lingyiwanwu.com/apikeys" },
  { id: "stepfun", label: "阶跃星辰 StepFun", region: "cn", baseUrl: "https://api.stepfun.com/v1", models: ["step-2-16k", "step-1-8k", "step-1-32k", "step-1v-8k"], consoleUrl: "https://platform.stepfun.com/" },
  { id: "spark", label: "讯飞星火 Spark", region: "cn", baseUrl: "https://spark-api-open.xf-yun.com/v1", models: ["generalv3.5", "4.0Ultra", "generalv3", "pro-128k", "lite"], consoleUrl: "https://console.xfyun.cn/" },
  { id: "baichuan", label: "百川智能 Baichuan", region: "cn", baseUrl: "https://api.baichuan-ai.com/v1", models: ["Baichuan4", "Baichuan4-Turbo", "Baichuan4-Air", "Baichuan3-Turbo"], consoleUrl: "https://platform.baichuan-ai.com/console/apikey" },
  { id: "sensenova", label: "商汤日日新 SenseNova", region: "cn", baseUrl: "https://api.sensenova.cn/compatible-mode/v1", models: ["SenseChat-5", "SenseChat-Turbo", "SenseChat-128K"], consoleUrl: "https://console.sensecore.cn/" },

  // ── 国外 (International) ────────────────────────────────────────────────────
  { id: "openai", label: "OpenAI", region: "intl", baseUrl: "https://api.openai.com/v1", models: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o", "gpt-4o-mini", "o3-mini", "o1"], consoleUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic", label: "Anthropic Claude", region: "intl", baseUrl: "https://api.anthropic.com/v1", models: ["claude-3-7-sonnet-latest", "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"], consoleUrl: "https://console.anthropic.com/settings/keys" },
  { id: "gemini", label: "Google Gemini", region: "intl", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-pro"], consoleUrl: "https://aistudio.google.com/apikey" },
  { id: "grok", label: "xAI Grok", region: "intl", baseUrl: "https://api.x.ai/v1", models: ["grok-3", "grok-3-mini", "grok-2"], consoleUrl: "https://console.x.ai/" },
  { id: "groq", label: "Groq", region: "intl", baseUrl: "https://api.groq.com/openai/v1", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"], consoleUrl: "https://console.groq.com/keys" },
  { id: "mistral", label: "Mistral AI", region: "intl", baseUrl: "https://api.mistral.ai/v1", models: ["mistral-large-latest", "mistral-small-latest", "open-mistral-nemo", "codestral-latest"], consoleUrl: "https://console.mistral.ai/api-keys" },
  { id: "openrouter", label: "OpenRouter", region: "intl", baseUrl: "https://openrouter.ai/api/v1", models: ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash-exp", "deepseek/deepseek-chat"], consoleUrl: "https://openrouter.ai/keys" },
  { id: "together", label: "Together AI", region: "intl", baseUrl: "https://api.together.xyz/v1", models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo", "deepseek-ai/DeepSeek-V3"], consoleUrl: "https://api.together.ai/settings/api-keys" },
  { id: "fireworks", label: "Fireworks AI", region: "intl", baseUrl: "https://api.fireworks.ai/inference/v1", models: ["accounts/fireworks/models/llama-v3p3-70b-instruct", "accounts/fireworks/models/deepseek-v3", "accounts/fireworks/models/qwen2p5-72b-instruct"], consoleUrl: "https://fireworks.ai/account/api-keys" },
  { id: "perplexity", label: "Perplexity", region: "intl", baseUrl: "https://api.perplexity.ai", models: ["sonar", "sonar-pro", "sonar-reasoning", "sonar-reasoning-pro"], consoleUrl: "https://www.perplexity.ai/settings/api" },
  { id: "deepinfra", label: "DeepInfra", region: "intl", baseUrl: "https://api.deepinfra.com/v1/openai", models: ["meta-llama/Meta-Llama-3.1-70B-Instruct", "meta-llama/Llama-3.3-70B-Instruct", "Qwen/Qwen2.5-72B-Instruct", "deepseek-ai/DeepSeek-V3"], consoleUrl: "https://deepinfra.com/dash/api_keys" },

  // ── 自定义 (Custom) ────────────────────────────────────────────────────────
  { id: "custom", label: "自定义 / Custom", region: "custom", baseUrl: "", models: [] },
];

export function aiProviderPresetById(id: string) {
  return AI_PROVIDER_PRESETS.find((preset) => preset.id === id);
}

/** Best-effort: match a stored base URL back to a known preset id. */
export function aiProviderPresetForBaseUrl(baseUrl: string | undefined) {
  if (!baseUrl) return undefined;
  const normalized = baseUrl.replace(/\/+$/, "");
  return AI_PROVIDER_PRESETS.find((preset) => preset.baseUrl.replace(/\/+$/, "") === normalized);
}
