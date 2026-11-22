/* 添加房产向导（#/house/profile?sec=…&newprop=1）：一步一页，全部填在内存草稿里（state.houseDraft），最后一页「确认」汇总整套资料，
 * 每一块带「编辑」回到那一步，点「确认并创建」才真正建房产 + 存资料；中途取消 / 关掉页面什么都不会留下。
 * 步骤 = 房屋资料的各个分区（PROFILE_SECTIONS）+ 确认页（review）；从确认页点某一块的「编辑」进来带 rv=1，存完直接回确认页。 */
import { Store } from "../core/store.js";
import { canManageHome } from "../settings/members.js";
import { esc } from "../core/util.js";
import { go, href } from "../core/router.js";
import { houseDraft, readHouseForm } from "./house-draft.js";
import { PROFILE_SECTIONS, sectionStatus } from "./house-sections.js";
import { refresh } from "../app/data.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { toast } from "../core/util.js";

export const isNewProp = () => state.route?.q?.get("newprop") === "1";
export const isReviewing = () => isNewProp() && state.route?.q?.get("sec") === "review";
const stepUrl = (sec, rv) => `${href("house", "profile")}?sec=${sec}&newprop=1${rv ? "&rv=1" : ""}`;
const ids = () => PROFILE_SECTIONS.map((s) => s.id);
const nextOf = (sec) => ids()[ids().indexOf(sec) + 1] || "review";
const prevOf = (sec) => ids()[ids().indexOf(sec) - 1] || null;
const SHELL = (inner) => `<div class="form-actions sticky-actions wz-actions">${inner}</div>`;
const cancelBtn = () => `<a class="btn btn-ghost" href="${href("house")}" data-action="house-cancel">${t("取消")}</a>`;

/** 步骤页顶部的「第 n 步 / 共 m 步」+ 进度点（review 算最后一步） */
export function newSteps(sec) {
  const total = PROFILE_SECTIONS.length + 1, i = sec === "review" ? total - 1 : ids().indexOf(sec);
  const name = sec === "review" ? t("确认") : t(PROFILE_SECTIONS[i]?.name || "");
  return `<div class="wiz-steps" aria-label="${esc(t("第 {n} 步，共 {m} 步", { n: i + 1, m: total }))}"><p class="wiz-now"><b>${t("第 {n} 步，共 {m} 步", { n: i + 1, m: total })}</b> · ${esc(name)}</p>
    <ol class="wiz-dots" aria-hidden="true">${Array.from({ length: total }, (_, k) => `<li class="${k < i ? "is-done" : k === i ? "is-now" : ""}"></li>`).join("")}</ol></div>`;
}
/** 步骤页底部：取消（在确认页编辑时：取消 = 回确认页，改动不保留）/ 上一步 / 下一步（编辑时：保存） */
export function newBar(sec, rv) {
  if (rv) return SHELL(`<a class="btn btn-ghost" href="${stepUrl("review")}">${t("取消")}</a><button type="submit" class="btn btn-primary">${t("保存")}</button>`);
  const prev = prevOf(sec);
  return SHELL(`${cancelBtn()}${prev ? `<button type="button" class="btn btn-ghost" data-action="house-new-go" data-to="${stepUrl(prev)}">${t("上一步")}</button>` : ""}<button type="submit" class="btn btn-primary">${t("下一步")}</button>`);
}

/** 确认页：每个分区 = 资料页同样的卡片 + 「编辑」；底部 取消 / 上一步 / 确认并创建 */
export function viewNewReview(sectionFacts) {
  if (!canManageHome()) return `<div class="panel empty"><strong>${t("只有家主可以新增房产")}</strong></div>`;
  const d = houseDraft();
  const cards = PROFILE_SECTIONS.map((s) => `<section class="panel prof-card" aria-labelledby="nr-${s.id}">
      <header class="prof-head"><span class="mi" aria-hidden="true">${s.icon}</span><div class="prof-t"><h3 id="nr-${s.id}">${t(s.name)}</h3><small>${esc(sectionStatus(d, s.id).text)}</small></div>
        <a class="btn btn-sm btn-ghost prof-edit" href="${stepUrl(s.id, true)}" aria-label="${esc(t("编辑 {name}", { name: t(s.name) }))}">${t("编辑")}</a></header>${sectionFacts(d, s.id)}</section>`).join("");
  return `<section class="section form-page house-form">${newSteps("review")}
    <p class="muted" style="margin:0 0 10px;font-size:13px">${t("请核对下面的信息；哪一块要改，点它的「编辑」。没问题就点最下面的「确认并创建」，到这一步才会真正建好这套房产。")}</p>
    <div class="prof-grid">${cards}</div><p id="houseFormError" class="form-error" role="alert"></p>
    ${SHELL(`${cancelBtn()}<button type="button" class="btn btn-ghost" data-action="house-new-go" data-to="${stepUrl(ids()[ids().length - 1])}">${t("上一步")}</button><button type="button" class="btn btn-primary" data-action="house-new-create">${t("确认并创建")}</button>`)}</section>`;
}

/** 步骤表单提交：把这一步读进草稿，校验，进下一步（编辑时回确认页）。不入库 */
export async function newStepSubmit(f) {
  const d = await readHouseForm(f), err = f.querySelector("#houseFormError"), sec = f.dataset.sec, rv = f.dataset.rv === "1", thisYear = new Date().getFullYear();
  if (sec === "type" && !d.prop?.name) { err.textContent = t("请填写房产名称。"); f.elements.prop_name.focus(); return false; }
  if (sec === "address" && d.year_built != null && (d.year_built < 1850 || d.year_built > thisYear)) { err.textContent = t("建成年份需要在 1850 到 {y} 之间。", { y: thisYear }); f.elements.year_built.focus(); return false; }
  go(stepUrl(rv ? "review" : nextOf(sec)), { replace: rv }); return true;
}
/** 「上一步」：先把这一步填的读进草稿（不校验）再跳 */
export async function newGo(el) { const f = el.closest("form"); if (f) await readHouseForm(f); go(el.dataset.to); }
/** 「确认并创建」：这时才建房产 + 存资料 */
export async function newCreate(btn) {
  if (!canManageHome()) return toast(t("只有家主可以新增房产"));
  const d = houseDraft(), p = d.prop || {}, err = document.getElementById("houseFormError");
  if (!p.name) { if (err) err.textContent = t("请填写房产名称。"); return go(stepUrl("type", true)); }
  btn.disabled = true;
  try {
    const saved = await Store.saveProperty({ name: p.name, kind: p.kind, role: p.role, status: p.status || "owned", address: d.address || null });
    await Store.saveHouseProfile(d, saved.id);
    state.propertyId = saved.id; try { localStorage.setItem("hmh-property", saved.id); } catch { /* 忽略 */ }
    state.houseDraft = null; state.skipAutosave = true;
    toast(t("房产已添加"));
    go(href("house", "overview"), { replace: true }); await refresh();
  } catch (e) { btn.disabled = false; if (err) err.textContent = t("保存失败：{msg}", { msg: e.message }); }
}
