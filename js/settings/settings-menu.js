/* 设置：目录页（每块一行，带当前状态）→ 点进去只看那一块。 */
import { numAttrs } from "../core/ui-num.js";
import { FREE_TIER, aiQuota, quotaStatus, saveAiSettings } from "../core/ai.js";
import { aiSettings } from "../core/ai-common.js";
import { esc } from "../core/util.js";
import { modelMarks } from "./settings-names.js";
import { t } from "../core/i18n.js";

/* ── 设置：目录页（每块一行，带当前状态）→ 点进去只看那一块 ── */
/* 顺序：常用的在前（固定前三：AI 助手、家庭与成员、语言地区与单位），设一次基本不再变的往后放 */
export const SETTING_SECTIONS = [
  { id: "ai", icon: "__AI__", name: "AI 助手" },
  { id: "family", icon: "👨‍👩‍👧", name: "家庭与成员" },
  { id: "prefs", icon: "🌐", name: "语言、地区与单位" },
  { id: "categories", icon: "🗂️", name: "分类与小类" },
  { id: "locations", icon: "📍", name: "存放位置" },
  { id: "modules", icon: "🧩", name: "模块开关" },
  { id: "print", icon: "🖨️", name: "打印" },
  { id: "backup", icon: "🛟", name: "同步、备份与恢复" },
  { id: "usage", icon: "📊", name: "存储用量" },
  { id: "data", icon: "🔔", name: "通知" },
  { id: "apps", icon: "🔗", name: "姐妹站点与介绍" },
];
/** AI 设置：模型、key（只存本机）、人数；提交与“测试连接”共用 */
export async function saveAiForm(f) {
  const fe = f.elements, s = aiSettings();
  Object.assign(s, { provider: fe.provider.value, key: fe.key.value.trim(), model: fe.model.value.trim(), base: fe.base.value.trim(), people: +fe.people.value || 4, auth: fe.auth?.value || "bearer",
    freeOnly: !!fe.freeOnly?.checked, rpm: fe.rpm?.value === "" ? "" : Math.max(0, +fe.rpm.value || 0), rpd: fe.rpd?.value === "" ? "" : Math.max(0, +fe.rpd.value || 0) });
  saveAiSettings(s);
}
/** 免费额度：只用免费额度开关、每分钟 / 每天上限、今天用了多少、下次可用时间 */
export function quotaBlock(s, p) {
  const tier = FREE_TIER[p.id], q = aiQuota(s);
  return `<fieldset class="quota-box">
    <legend>${t("免费额度")}</legend>
    <p class="${q.ok ? "muted" : "form-error"}" style="margin:0 0 8px;font-size:13px">${esc(quotaStatus(q))}${tier ? ` · ${t(tier.resetText)}` : ""}</p>
    ${modelMarks()}
    <label class="check-inline" style="margin-bottom:8px"><input type="checkbox" name="freeOnly" ${s.freeOnly !== false ? "checked" : ""}><span>${t("只用免费额度：到上限就不再发请求，并提示下次可用时间")}</span></label>
    <div class="form-grid">
      <label>${t("每分钟上限（次）")}<input name="rpm" ${numAttrs("int", { max: 1000, step: null })} placeholder="${tier?.rpm ?? t("不限")}" value="${esc(s.rpm ?? "")}"></label>
      <label>${t("每天上限（次）")}<input name="rpd" ${numAttrs("int", { max: 100000, step: null })} placeholder="${tier?.rpd ?? t("不限")}" value="${esc(s.rpd ?? "")}"><small>${tier ? t("留空用默认值（各家公布的免费档，会变，以控制台为准）") : t("这个服务没有免费档；留空不限制，或按你买的额度填")}</small></label>
    </div>
    <div class="form-actions" style="margin-top:8px"><button type="button" class="btn btn-sm btn-ghost" data-action="ai-usage-reset" data-provider="${p.id}">${t("重置计数")}</button>
      <small class="muted">${t("计数只在本机浏览器里，换设备或家人各自计")}</small></div>
  </fieldset>`;
}
