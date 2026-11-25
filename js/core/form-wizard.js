/* 通用的「分步添加 + 最后确认」小向导（商店、家庭成员等字段不多的新建表单用）：表单还是原来那一个，各块（[data-fsec]）一次只显示一块，
 * 填的内容就留在表单里；最后一步「确认」把每一块的字段读出来列成卡片（带「编辑」回到那一步），点「确认并创建」才走表单原来的保存。中途取消什么都不会留下。
 * 用法：表单标签上加 ${gwAttr([["basic","基本信息"],["contact","联系方式"]])}，字段外壳带 data-fsec="块 id"，表单里放 ${gwChrome(steps)}、${gwReview()}，
 * 底部按钮用 ${gwActions(取消按钮的 HTML)}；各块 id 要在 styles.css 的 form[data-gwz] 规则里登记（basic / contact / update）。
 * 回车 = 下一步（捕获阶段拦住，不让表单原来的保存处理看到）；只有在确认页提交才放行。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";

const REVIEW = "review";
/** 表单标签上的属性：步骤 id:名称 列表 */
export const gwAttr = (steps) => ` data-gwz="${esc(steps.map(([id, name]) => `${id}:${t(name)}`).join("|"))}"`;
const stepsOf = (f) => [...f.dataset.gwz.split("|").map((s) => { const i = s.indexOf(":"); return [s.slice(0, i), s.slice(i + 1)]; }), [REVIEW, t("确认")]];
const nowText = (f, id) => { const list = stepsOf(f), i = Math.max(0, list.findIndex((s) => s[0] === id)); return `<b>${esc(t("第 {n} 步，共 {m} 步", { n: i + 1, m: list.length }))}</b> · ${esc(list[i][1])}`; };
const dots = (f, id) => { const list = stepsOf(f), cur = list.findIndex((s) => s[0] === id); return list.map((s, i) => `<li class="${i < cur ? "is-done" : i === cur ? "is-now" : ""}"></li>`).join(""); };

/** 表单顶上的进度（创建时是第 1 步；每步的文字由 show() 更新） */
export const gwChrome = (steps) => `<div class="wiz-steps"><p class="wiz-now" data-gw-now aria-live="polite"><b>${esc(t("第 {n} 步，共 {m} 步", { n: 1, m: steps.length + 1 }))}</b> · ${esc(t(steps[0][1]))}</p><ol class="wiz-dots" data-gw-dots aria-hidden="true">${[...steps, 0].map((_, i) => `<li class="${i === 0 ? "is-now" : ""}"></li>`).join("")}</ol></div>`;
export const gwReview = () => `<div data-gw-review hidden></div><p class="form-error" role="alert" data-gw-err></p>`;
/** 底部按钮：取消（调用方给 HTML）/ 上一步 / 下一步 / 确认并创建（只在确认页出现） */
export const gwActions = (cancelHtml) => `<div class="ui-acts sticky-actions wz-actions">${cancelHtml}<button type="button" class="ui-btn" data-tone="ghost" data-gw="prev" hidden>${t("上一步")}</button><button type="button" class="ui-btn" data-tone="primary" data-gw="next">${t("下一步")}</button><button type="submit" class="ui-btn" data-tone="primary" data-wz-save data-gw-save hidden>${t("确认并创建")}</button></div>`;

const cur = (f) => f.dataset.step || stepsOf(f)[0][0];
const err = (f, msg) => { const el = f.querySelector("[data-gw-err]"); if (el) el.textContent = msg || ""; };
const labelText = (el) => { const c = el.cloneNode(true); c.querySelectorAll("input,select,textarea,small,datalist,option").forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); };
function valueText(el) {
  const c = el.querySelector("select, textarea, input:not([type=hidden])");
  if (!c) return "";
  if (c.type === "checkbox") return c.checked ? "✓" : "";
  if (c.tagName === "SELECT") return c.value ? c.selectedOptions[0]?.textContent.trim() || "" : "";
  return c.value.trim();
}

function show(f, id) {
  const list = stepsOf(f), i = list.findIndex((s) => s[0] === id);
  f.dataset.step = id;
  const rv = f.querySelector("[data-gw-review]"); rv.hidden = id !== REVIEW; if (id === REVIEW) rv.innerHTML = reviewHtml(f);
  f.querySelector("[data-gw-now]").innerHTML = nowText(f, id); f.querySelector("[data-gw-dots]").innerHTML = dots(f, id);
  f.querySelector('[data-gw="prev"]').hidden = i === 0; f.querySelector('[data-gw="next"]').hidden = id === REVIEW; f.querySelector("[data-gw-save]").hidden = id !== REVIEW;
  err(f, ""); f.scrollIntoView({ block: "start" });
}
/** 这一步必填的格子（带 required）有没有填 */
function check(f, id) {
  for (const el of f.querySelectorAll(`[data-fsec="${id}"] [required], [data-fsec="${id}"][required]`)) {
    if (!String(el.value || "").trim()) { err(f, t("请先填：{name}", { name: labelText(el.closest("label") || el.parentElement) })); el.focus(); return false; }
  }
  return true;
}
function reviewHtml(f) {
  const cards = stepsOf(f).filter((s) => s[0] !== REVIEW).map(([id, name]) => {
    const rows = [...f.querySelectorAll(`[data-fsec="${id}"]`)].filter((el) => el.matches("label, div")).map((el) => [labelText(el), valueText(el)]).filter(([k]) => k);
    return `<section class="panel dt-block"><div class="dt-head"><h3>${esc(name)}</h3><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-gw="goto" data-step="${id}" aria-label="${esc(t("编辑 {name}", { name }))}">${t("编辑")}</button></div>
      <dl class="dt-list">${rows.map(([k, v]) => `<div data-variant="detail" class="ui-row dt-row"><dt>${esc(k)}</dt><dd>${v ? esc(v) : '<span class="muted">—</span>'}</dd></div>`).join("")}</dl></section>`;
  }).join("");
  return `<p class="muted" style="margin:0 0 10px;font-size:13px">${t("请核对下面的信息；哪一块要改，点它的「编辑」回到那一步。没问题就点最下面的「确认并创建」，到这一步才会真正建好。")}</p><div class="dt-grid dd-secs">${cards}</div>`;
}
function advance(f) { const list = stepsOf(f), id = cur(f); if (check(f, id)) show(f, list[Math.min(list.length - 1, list.findIndex((s) => s[0] === id) + 1)][0]); }

if (typeof window !== "undefined") {
  // 回车 / 点提交：不在确认页就当「下一步」；在确认页先把每一步的必填再查一遍，通过才放行给表单原来的保存
  window.addEventListener("submit", (e) => {
    const f = e.target; if (!f?.dataset?.gwz) return;
    if (cur(f) !== REVIEW) { e.preventDefault(); e.stopPropagation(); advance(f); return; }
    for (const [id] of stepsOf(f).filter((s) => s[0] !== REVIEW)) if (!check(f, id)) { e.preventDefault(); e.stopPropagation(); show(f, id); check(f, id); return; }
  }, true);
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-gw]"), f = b?.closest("form[data-gwz]"); if (!b || !f) return;
    const list = stepsOf(f), i = list.findIndex((s) => s[0] === cur(f));
    if (b.dataset.gw === "next") return advance(f);
    if (b.dataset.gw === "prev") return show(f, list[Math.max(0, i - 1)][0]);
    if (b.dataset.gw === "goto") return show(f, b.dataset.step);
  });
}
