

   // 本机调用计数：{ provider: { day, count, minute, mcount, blockedUntil } }

/** 咩咩图标：一只白绒绒的小羊咩咩，额头上一枚珊瑚红的字母 Y（四个应用同一只；颜色固定，深浅色主题下都一样），随文字大小缩放 */
export const aiIcon = (size = 22, cls = "") => `<svg class="ai-ico ${cls}" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <ellipse cx="9" cy="37" rx="8.5" ry="4.6" transform="rotate(-24 9 37)" fill="#F6D5C3" stroke="#2C3A4B" stroke-width="2.6"/>
  <ellipse cx="55" cy="37" rx="8.5" ry="4.6" transform="rotate(24 55 37)" fill="#F6D5C3" stroke="#2C3A4B" stroke-width="2.6"/>
  <g fill="#fff" stroke="#2C3A4B" stroke-width="2.6"><circle cx="32" cy="14" r="10.5"/><circle cx="19" cy="20" r="8.5"/><circle cx="45" cy="20" r="8.5"/><circle cx="13" cy="31" r="7.5"/><circle cx="51" cy="31" r="7.5"/><circle cx="16" cy="43" r="7"/><circle cx="48" cy="43" r="7"/><circle cx="24" cy="51" r="7"/><circle cx="40" cy="51" r="7"/><circle cx="32" cy="53" r="7"/><circle cx="32" cy="32" r="17"/></g><g fill="#fff"><circle cx="32" cy="14" r="10.5"/><circle cx="19" cy="20" r="8.5"/><circle cx="45" cy="20" r="8.5"/><circle cx="13" cy="31" r="7.5"/><circle cx="51" cy="31" r="7.5"/><circle cx="16" cy="43" r="7"/><circle cx="48" cy="43" r="7"/><circle cx="24" cy="51" r="7"/><circle cx="40" cy="51" r="7"/><circle cx="32" cy="53" r="7"/><circle cx="32" cy="32" r="17"/></g>
  <ellipse cx="32" cy="41" rx="13" ry="12" fill="#F6D5C3" stroke="#2C3A4B" stroke-width="2.4"/>
  <circle cx="27" cy="39.5" r="2.1" fill="#2C3A4B"/><circle cx="37" cy="39.5" r="2.1" fill="#2C3A4B"/>
  <path d="M32 44.5v1.6M29.3 48q2.7 2.4 5.4 0" fill="none" stroke="#2C3A4B" stroke-width="1.9" stroke-linecap="round"/>
  <circle cx="23.2" cy="44.5" r="1.9" fill="#F4A3B1" opacity=".9"/><circle cx="40.8" cy="44.5" r="1.9" fill="#F4A3B1" opacity=".9"/>
  <path d="M25.5 11.5l6.5 8 6.5-8M32 19.5v9" fill="none" stroke="#D9655F" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// auth：自定义接口的鉴权头——bearer（Authorization: Bearer，OpenAI 兼容接口默认）/ x-api-key / api-key（Azure 风格）
export const AUTH_STYLES = { bearer: "Authorization: Bearer（默认）", "x-api-key": "x-api-key 头", "api-key": "api-key 头（Azure 风格）" };
export { PROVIDERS, aiSettings, providerOf } from "./ai-common.js";
export { FREE_TIER, QuotaError, aiQuota, autoModel, nextReset, quotaMessage, quotaStatus, rankGemini, resetUsage, suggestedModel } from "./ai-limits.js";
export { aiReady, blockedModels, clearModelMarks, deadModels, effective, parse429, saveAiSettings } from "./ai-request.js";
export { menuPrompt, pantryContext, promptText } from "./ai-prompts.js";
export { FREE_MODELS, FREE_MODELS_AS_OF, aiChanges, askModel, askText, catalogAgeDays, dismissAiChanges, learnLimit, listModels, modelInfo, modelsCachedAt, visionCapable } from "./ai-models.js";
export { generalPrompt, generalPromptText, homeContext, parseMenu, testModel } from "./ai-ask.js";
