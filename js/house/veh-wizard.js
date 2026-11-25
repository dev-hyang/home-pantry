/* 添加车辆 / 设备 / 工具向导（#/asset/new?type=…）：一步一页，最后一页「确认」汇总全部信息，每一块带「编辑」回到对应那一步，点「确认并创建」才真正建。
 * 做法和添加卡向导（bills/card-wizard.js）一样：表单还是原来那一个（字段、保存逻辑都不变），各分区（fieldset[data-sec]）一次只显示一个，
 * 填的内容就留在表单里；确认页由 readAsset 读出表单当前内容、复用资料页的分区画法（vehicleFacts / equipmentFacts）。中途取消 / 离开什么都不会留下。
 * 步骤随种类变：车辆 = vehSteps；设备 = 基本信息 →（固定装置才有）位置与数量 → 年份与保修 → 寿命与保养周期 → 费用 → 备注；工具同设备；最后都是确认。 */
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { ASSET_SECTIONS } from "./asset-supplies.js";
import { pricesOk } from "../core/finance-access.js";
import { vehSteps } from "./asset-hub.js";
import { equipmentFacts, vehicleFacts } from "./asset-facts.js";
import { readAsset } from "./asset-read.js";

const REVIEW = { id: "review", icon: "✅", name: "确认" };
/** 内容步骤（不含确认）：kind = equipment | tool | vehicle；fixture = 设备是不是固定装置（才有「位置与数量」） */
export const contentSteps = (kind, fixture) => (kind === "vehicle" ? vehSteps() : ASSET_SECTIONS.filter((s) => !s.veh && (!s.fx || (fixture && kind === "equipment")) && !(s.id === "cost" && !pricesOk())));
const kindOf = (f) => f.elements.kind.value, fixtureOf = (f) => f.classList.contains("is-fixture");
const stepsOf = (f) => [...contentSteps(kindOf(f), fixtureOf(f)), REVIEW];
const stepNo = (list, id) => Math.max(0, list.findIndex((s) => s.id === id));
const nowText = (list, id) => { const i = stepNo(list, id); return `<b>${esc(t("第 {n} 步，共 {m} 步", { n: i + 1, m: list.length }))}</b> · ${esc(t(list[i].name))}`; };
const dots = (list, id) => list.map((s, i) => `<li class="${i < stepNo(list, id) ? "is-done" : i === stepNo(list, id) ? "is-now" : ""}"></li>`).join("");

/** 页头下面的进度：第 n 步 / 共 m 步 + 进度点（show() 更新；步骤数随种类 / 类型变） */
export function vwChrome(kind, fixture) {
  const list = [...contentSteps(kind, fixture), REVIEW];
  return `<div class="wiz-steps" data-vz-head><p class="wiz-now" data-vz-now aria-live="polite">${nowText(list, "basic")}</p><ol class="wiz-dots" data-vz-dots aria-hidden="true">${dots(list, "basic")}</ol></div>`;
}
/** 底部按钮：取消 / 上一步 / 下一步 / 确认并创建（只在确认页出现） */
export const vwActions = () => `<div class="ui-acts sticky-actions wz-actions"><button type="button" class="ui-btn" data-tone="ghost" data-action="asset-cancel">${t("取消")}</button><button type="button" class="ui-btn" data-tone="ghost" data-vz="prev" hidden>${t("上一步")}</button><button type="button" class="ui-btn" data-tone="primary" data-vz="next">${t("下一步")}</button><button type="submit" class="ui-btn" data-tone="primary" data-wz-save data-vz-save hidden>${t("确认并创建")}</button></div>`;

const form = () => document.getElementById("assetForm");
const cur = (f) => f.dataset.step || "basic";

function show(f, id) {
  const list = stepsOf(f);
  f.dataset.step = id;
  f.querySelectorAll("fieldset[data-sec]").forEach((el) => { el.hidden = el.dataset.sec !== id; });
  const rv = f.querySelector("[data-vz-review]"); rv.hidden = id !== "review"; if (id === "review") rv.innerHTML = reviewHtml(f);
  const page = f.closest(".form-page") || document;   // 进度条在表单外面（页头下面）
  page.querySelector("[data-vz-now]").innerHTML = nowText(list, id);
  page.querySelector("[data-vz-dots]").innerHTML = dots(list, id);
  f.querySelector('[data-vz="prev"]').hidden = stepNo(list, id) === 0;
  f.querySelector('[data-vz="next"]').hidden = id === "review";
  f.querySelector("[data-vz-save]").hidden = id !== "review";
  const err = f.querySelector("#assetFormError"); if (err) err.textContent = "";
  f.scrollIntoView({ block: "start" });
}

/** 这一步能不能往下走（基本信息：名称必填；年份在 1950 到今年） */
function check(f, id) {
  const err = f.querySelector("#assetFormError"), fe = f.elements;
  if (id === "basic" && !fe.name.value.trim()) { err.textContent = t("请填写设备名称。"); fe.name.focus(); return false; }
  const y = fe.manufacture_year.value === "" ? null : Math.round(Number(fe.manufacture_year.value)), now = new Date().getFullYear();
  if (id === "years" && y != null && (!Number.isFinite(y) || y < 1950 || y > now)) { err.textContent = t("出厂年份需要在 1950 到 {y} 之间。", { y: now }); fe.manufacture_year.focus(); return false; }
  return true;
}

/** 确认页：每一块 = 资料页同样的分区卡片 + 「编辑」（回到对应那一步） */
function reviewHtml(f) {
  const a = readAsset(f), veh = kindOf(f) === "vehicle", facts = veh ? vehicleFacts : equipmentFacts;
  const blocks = contentSteps(kindOf(f), fixtureOf(f)).map((s) => `<section class="panel prof-card" aria-labelledby="vzr-${s.id}"><header class="prof-head"><span class="mi" aria-hidden="true">${s.icon}</span><div class="prof-t"><h3 id="vzr-${s.id}">${esc(t(s.name))}</h3></div>
      <button type="button" class="ui-btn prof-edit" data-size="sm" data-tone="ghost" data-vz="goto" data-step="${s.id}" aria-label="${esc(t("编辑 {name}", { name: t(s.name) }))}">${t("编辑")}</button></header>${facts(a, s.id)}</section>`).join("");
  return `<p class="muted" style="margin:0 0 10px;font-size:13px">${veh ? t("请核对下面的信息；哪一块要改，点它的「编辑」回到那一步。没问题就点最下面的「确认并创建」，到这一步才会真正建好这辆车。") : t("请核对下面的信息；哪一块要改，点它的「编辑」回到那一步。没问题就点最下面的「确认并创建」，到这一步才会真正建好。")}</p><div class="prof-grid">${blocks}</div>`;
}

/** 在向导里按了回车：当成「下一步」，不直接保存；确认页上按回车 / 点「确认并创建」：先把每一步再查一遍，有问题回到那一步。返回 true = 已处理，不用保存（saveAssetForm 开头调用） */
export function vwIntercept(f) {
  if (!f?.hasAttribute("data-vwz")) return false;
  if (cur(f) !== "review") { advance(f); return true; }
  for (const s of contentSteps(kindOf(f), fixtureOf(f))) if (!check(f, s.id)) { show(f, s.id); check(f, s.id); return true; }
  return false;
}
function advance(f) {
  const id = cur(f), list = stepsOf(f), i = stepNo(list, id);
  if (check(f, id)) show(f, list[Math.min(list.length - 1, i + 1)].id);
}

/** 换了种类 / 类型：步骤数会变，进度条跟着更新（只会发生在第 1 步） */
function refreshProgress(f) {
  const list = stepsOf(f), page = f.closest(".form-page") || document, id = cur(f);
  page.querySelector("[data-vz-now]").innerHTML = nowText(list, id); page.querySelector("[data-vz-dots]").innerHTML = dots(list, id);
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-vz]"), f = form(); if (!b || !f || !f.hasAttribute("data-vwz")) return;
    const act = b.dataset.vz, list = stepsOf(f), i = stepNo(list, cur(f));
    if (act === "next") return advance(f);
    if (act === "prev") return show(f, list[Math.max(0, i - 1)].id);
    if (act === "goto") return show(f, b.dataset.step);
  });
  document.addEventListener("change", (e) => { const f = form(); if (f?.hasAttribute("data-vwz") && ["kind", "type"].includes(e.target.name)) setTimeout(() => refreshProgress(f), 0); });
}
