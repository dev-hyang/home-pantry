/* 咩咩咩 / AI 各部分共用的小件。从 ai.js 抽出来，各部分依赖这里。 */


export const KEY = "hmh-ai";
export const USAGE_KEY = "hmh-ai-usage";
// 默认 Gemini：美国可用的免费额度；其余按性价比排序。免费档的次数上限见 FREE_TIER，到上限就停
export const PROVIDERS = [
  // keyHint：怎么拿 key、长什么样；keyPrefix：key 开头（测试连接时先核对，贴错服务的 key 会直接提示）。模型名和地址都有默认值，只有“自定义”需要填
  { id: "gemini", name: "Google Gemini", kind: "gemini", base: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-3.5-flash-lite", cost: "free", signup: "https://aistudio.google.com/apikey", hint: "AI Studio 免费额度（每天有次数上限，太平洋时间 0 点重置）；国内需能访问 Google",
    keyHint: "打开 Google AI Studio → Get API key → Create API key，复制整串贴到这里（旧 key 以 AIza 开头，新 key 以 AQ. 开头，都行）。模型和地址不用填，会自动选可用的 Gemini Flash 模型。", keyPrefix: ["AIza", "AQ."] },
  { id: "groq", name: "Groq（Llama，免费档）", kind: "openai", base: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant", cost: "free", signup: "https://console.groq.com/keys", hint: "免费档每天有次数上限，速度快；上限以控制台 Limits 页为准", keyHint: "console.groq.com → API Keys → Create API Key，key 以 gsk_ 开头。", keyPrefix: "gsk_" },
  { id: "openrouter", name: "OpenRouter（免费模型）", kind: "openai", base: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct:free", cost: "free", signup: "https://openrouter.ai/keys", hint: "带 :free 的模型不收费，但每天次数很少；模型名以网站列表为准", keyHint: "openrouter.ai → Keys → Create key，key 以 sk-or- 开头。", keyPrefix: "sk-or-" },
  { id: "deepseek", name: "DeepSeek", kind: "openai", base: "https://api.deepseek.com", model: "deepseek-chat", cost: "cheapest", signup: "https://platform.deepseek.com/", hint: "注册送额度；之后每次菜单约几分钱", keyHint: "platform.deepseek.com → API keys → 创建，key 以 sk- 开头。", keyPrefix: "sk-" },
  { id: "qwen", name: "通义千问（阿里百炼）", kind: "openai", base: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-turbo", cost: "cheapest", signup: "https://bailian.console.aliyun.com/", hint: "新用户有免费额度；qwen-turbo 最便宜", keyHint: "阿里云百炼控制台 → API-KEY 管理 → 创建，key 以 sk- 开头。", keyPrefix: "sk-" },
  { id: "doubao", name: "豆包（火山方舟）", kind: "openai", base: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-lite-32k", cost: "cheapest", signup: "https://console.volcengine.com/ark", hint: "模型名填你在方舟开通的接入点或模型 ID；浏览器直连若被拒，用“复制提示词”" },
  { id: "kimi", name: "Kimi（月之暗面）", kind: "openai", base: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k", cost: "cheap", signup: "https://platform.moonshot.cn/", hint: "" },
  { id: "openai", name: "OpenAI", kind: "openai", base: "https://api.openai.com/v1", model: "gpt-4o-mini", cost: "cheap", signup: "https://platform.openai.com/api-keys", hint: "gpt-4o-mini 够用" },
  { id: "anthropic", name: "Claude（Anthropic）", kind: "anthropic", base: "https://api.anthropic.com/v1", model: "claude-haiku-4-5", cost: "mid", signup: "https://console.anthropic.com/", hint: "Haiku 档最便宜" },
  { id: "custom", name: "自定义（OpenAI 兼容接口）", kind: "openai", base: "", model: "", cost: "", signup: "", hint: "填接口地址（到 /v1 为止）、模型名和 key" },
];
export const providerOf = (id) => PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];
export function aiSettings() {
  // freeOnly：只用免费额度，到上限就停；rpm / rpd：每分钟 / 每天上限，留空用 FREE_TIER 默认
  const def = { provider: "gemini", key: "", model: "", base: "", people: 4, auth: "bearer", freeOnly: true, rpm: "", rpd: "" };
  try { return { ...def, ...(JSON.parse(localStorage.getItem(KEY) || "{}")) }; } catch { return def; }
}
