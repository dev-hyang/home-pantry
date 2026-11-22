/* 添加账户向导里「类型」那一步下面的税务提示：选了 HSA / FSA / 529 / 孩子账户 / 退休 / 加密 / 券商，就显示一句开户前要先决定的事，
 * 并链到 财务 → 税务 → 账户与开户 看完整的指南和冲突检查。没有提示的类型不显示。 */
import { esc } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { KIND_HINTS } from "./tax-content-accounts.js";

const txt = (kind) => { const h = KIND_HINTS[kind]; return h ? (lang === "en" ? h.en : h.zh) : ""; };
const inner = (kind) => (txt(kind) ? `🧾 ${esc(txt(kind))} <a href="${href("bills", "tax")}?tab=accounts">${t("看完整的税务提示")} ›</a>` : "");
/** 类型下面那块提示（没有就是空的、隐藏的） */
export const taxHintHtml = (kind) => `<p class="notice span-2" data-tax-hint role="note" ${txt(kind) ? "" : "hidden"}>${inner(kind)}</p>`;
/** 换了类型：更新提示（表单里的 kind 下拉） */
export function refreshTaxHint(f) {
  const el = f.querySelector("[data-tax-hint]"), kind = f.elements.kind?.value; if (!el) return;
  el.innerHTML = inner(kind); el.hidden = !txt(kind);
}
