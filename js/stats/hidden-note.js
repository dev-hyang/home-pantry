import { money } from "../core/util.js";
import { statOpts } from "./spend-roll.js";
import { t } from "../core/i18n.js";

/** 被「排除资本性 / 投资」挡掉的金额提示：装修、买房这些默认不算，但要让人看得见、一点就能算进来（复选框走原来的 stats-excap / stats-exinv） */
export function hiddenNote(h) {
  const o = statOpts(), row = (on, v, act, label, eg) => (on && v > 0 ? `<label class="check-inline"><input type="checkbox" data-action="${act}" checked><span>${t("{label}：另有 {a} 没算进来（{eg}）。去掉勾一起算", { label, a: money(v), eg })}</span></label>` : "");
  const html = row(o.exCap, h.cap, "stats-excap", t("排除资本性"), t("装修工程、买房卖房、买车整付等")) + row(o.exInv, h.inv, "stats-exinv", t("排除投资"), t("转入投资账户、买基金股票"));
  return html ? `<div class="panel hidden-note" style="padding:10px 14px;display:grid;gap:6px;font-size:13px">${html}</div>` : "";
}
