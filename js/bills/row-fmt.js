/* 账单行的统一排版（全部账单、周期性账单清单、一次性账单清单、缴费记录共用）——
 *   名称行：类别图标（不带下划线）+ 名称（链接，下划线只在文字下面）+ 名称后面的小标志（🔒 等）+ 状态徽章；金额靠右，估算的写成「（估算）$123.22」，同一行。
 *   信息行：所属资产 / 患者芯片 + 到期日 + 周期性 / 一次性 + 收款方…：每一项是一个不拆开的整体，放不下时只在「点」后面换行，不会把一项文字拆成两行。
 * 以后新加的标志（自动扣款、涨价了…）也放进名称后面的 flags，不放在名称前面。 */
import { esc } from "../core/util.js";
import { lang, t } from "../core/i18n.js";

/** 名称后面的小标志：{ html, title }（html 是图标 / 短文字，title 给鼠标悬停和读屏） */
const flagHtml = (f) => `<span class="rf-flag" role="img" title="${esc(f.title || "")}" aria-label="${esc(f.title || "")}">${f.html}</span>`;

/** 名称行：ico = 类别图标（可空）；flags = 名称后面的小标志数组（假值会被忽略）；badge = 状态徽章 HTML（可空） */
export function nameLine({ ico = "", name, href, flags = [], badge = "" }) {
  return `<div class="rf-name">${ico ? `<span class="rf-ico" aria-hidden="true">${ico}</span> ` : ""}<a class="link-name" href="${esc(href)}">${esc(name)}</a>${flags.filter(Boolean).map((f) => ` ${flagHtml(f)}`).join("")}${badge ? ` ${badge}` : ""}</div>`;
};

/** 信息行：parts 每项是字符串（会转义）或 { html, chip: true }（芯片 / 徽章：后面不加点，下一项直接接在后面）。
 *  每一项是不拆开的一段（rf-seg），段与段之间的「·」写在前一段末尾，所以换行只会发生在点后面。 */
export function metaLine(parts) {
  const items = parts.filter((p) => p && (typeof p === "string" || p.html));
  if (!items.length) return "";
  return `<div class="rf-meta">${items.map((p, i) => {
    const chip = typeof p === "object" && p.chip, html = typeof p === "object" ? p.html : esc(p), more = items.slice(i + 1).some((q) => typeof q === "string" || !q.chip);
    return `<span class="rf-seg${chip ? " rf-chip" : ""}">${html}${!chip && more ? " ·" : ""}</span>`;
  }).join(" ")}</div>`;
}

/** 金额：估算的写在金额左边、括号起来、同一行：（估算）$123.22 */
export const estAmount = (amountHtml, isEst) => (isEst ? `<span class="rf-est">${lang === "en" ? "(est.)" : "（估算）"}</span> ` : "") + amountHtml;

/** 🔒 仅自己和家主可见 */
export const lockFlag = () => ({ html: "🔒", title: t("仅自己和家主可见") });
