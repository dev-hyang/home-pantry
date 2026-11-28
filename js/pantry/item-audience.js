/* 药品「适用人群」标签（迁移 112：items.audience，可多选）。只用于「药品健康」大类；不影响分类和提醒。 */
import { t } from "../core/i18n.js";
import { esc } from "../core/util.js";

export const AUDIENCE_CAT = "health";
export const AUDIENCES = [["infant", "婴幼儿"], ["child", "儿童"], ["adult", "成人"], ["senior", "老人"], ["pregnant", "孕妇"]];
const KEYS = new Set(AUDIENCES.map(([k]) => k));

/** 取出合法的人群 key（保持固定顺序） */
export const audienceOf = (it) => AUDIENCES.map(([k]) => k).filter((k) => Array.isArray(it?.audience) && it.audience.includes(k));
export const audienceLabel = (it) => audienceOf(it).map((k) => t(AUDIENCES.find(([x]) => x === k)[1])).join("、");
export const sameAudience = (a, b) => a.length === b.length && a.every((k, i) => k === b[i]);

/** 表单里的多选格；只在大类是「药品健康」时显示（切换大类时由 syncAudience 更新） */
export function audienceField(v) {
  const cur = new Set(audienceOf(v)), show = v.category === AUDIENCE_CAT;
  return `<div class="span-2 form-field item-audience" role="group" aria-labelledby="audLbl" ${show ? "" : "hidden"}><span id="audLbl">${t("适用人群（可多选）")}</span>
    <div class="aud-opts">${AUDIENCES.map(([k, l]) => `<label class="dt-opt"><input type="checkbox" name="audience" value="${k}" ${cur.has(k) ? "checked" : ""}><span>${t(l)}</span></label>`).join("")}</div>
    <small class="muted">${t("按人群找药、避免拿错；不选就是不限。")}</small></div>`;
}
export const syncAudience = (f) => { const box = f?.querySelector(".item-audience"); if (box) box.hidden = f.elements.category?.value !== AUDIENCE_CAT; };
/** 读表单：只认合法值；大类不是药品健康就是空 */
export function readAudience(f) {
  if (f.elements.category?.value !== AUDIENCE_CAT) return [];
  return AUDIENCES.map(([k]) => k).filter((k) => KEYS.has(k) && [...f.querySelectorAll('input[name="audience"]:checked')].some((c) => c.value === k));
}

/** 库存筛选：人群 key / "none"（药品里还没标的）/ "all"；没选就不限制 */
export function audienceMatch(it, aud) {
  if (!aud || aud === "all") return true;
  if (aud === "none") return it.category === AUDIENCE_CAT && !audienceOf(it).length;
  return audienceOf(it).includes(aud);
}
/** 筛选下拉：库存里至少有一件标了人群才出现（和「按位置」一样，没用的筛选不占地方）；当前选的值没人用了也保留，免得选不回去 */
export function audienceFilter(mine, f) {
  if (!mine.some((x) => audienceOf(x).length) && (f.aud || "all") === "all") return "";
  const opt = (v, l) => `<option value="${v}" ${(f.aud || "all") === v ? "selected" : ""}>${t(l)}</option>`;
  return `<select id="invAud" aria-label="${esc(t("按适用人群筛选"))}">${opt("all", "全部人群")}${AUDIENCES.map(([k, l]) => opt(k, l)).join("")}${opt("none", "药品里还没标人群")}</select>`;
}
