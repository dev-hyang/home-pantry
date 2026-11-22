/* 添加车辆向导（#/asset/new?type=…&wiz=1）：一步一页，最后一页「确认」汇总全部信息，每一块带「编辑」回到对应那一步，点「确认并创建」才真正建车。
 * 做法和添加卡向导（bills/card-wizard.js）一样：表单还是原来那一个（字段、保存逻辑都不变），各分区（fieldset[data-sec]）一次只显示一个，
 * 填的内容就留在表单里；确认页由 readAsset 读出表单当前内容、复用车辆资料页的分区画法（vehicleFacts）。中途取消 / 离开什么都不会留下。 */
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { vehSteps } from "./asset-hub.js";
import { vehicleFacts } from "./asset-facts.js";
import { readAsset } from "./asset-read.js";

const steps = () => [...vehSteps(), { id: "review", icon: "✅", name: "确认" }];
const stepNo = (id) => Math.max(0, steps().findIndex((s) => s.id === id));
const nowText = (id) => { const list = steps(), i = stepNo(id); return `<b>${esc(t("第 {n} 步，共 {m} 步", { n: i + 1, m: list.length }))}</b> · ${esc(t(list[i].name))}`; };
const dots = (id) => steps().map((s, i) => `<li class="${i < stepNo(id) ? "is-done" : i === stepNo(id) ? "is-now" : ""}"></li>`).join("");

/** 页头下面的进度：第 n 步 / 共 m 步 + 进度点（show() 更新） */
export const vwChrome = () => `<div class="wiz-steps" data-vz-head><p class="wiz-now" data-vz-now aria-live="polite">${nowText("basic")}</p><ol class="wiz-dots" data-vz-dots aria-hidden="true">${dots("basic")}</ol></div>`;
/** 底部按钮：取消 / 上一步 / 下一步 / 确认并创建（只在确认页出现） */
export const vwActions = () => `<div class="form-actions sticky-actions wz-actions"><button type="button" class="btn btn-ghost" data-action="asset-cancel">${t("取消")}</button><button type="button" class="btn btn-ghost" data-vz="prev" hidden>${t("上一步")}</button><button type="button" class="btn btn-primary" data-vz="next">${t("下一步")}</button><button type="submit" class="btn btn-primary" data-wz-save data-vz-save hidden>${t("确认并创建")}</button></div>`;

const form = () => document.getElementById("assetForm");
const cur = (f) => f.dataset.step || "basic";

function show(f, id) {
  f.dataset.step = id;
  f.querySelectorAll("fieldset[data-sec]").forEach((el) => { el.hidden = el.dataset.sec !== id; });
  const rv = f.querySelector("[data-vz-review]"); rv.hidden = id !== "review"; if (id === "review") rv.innerHTML = reviewHtml(f);
  const page = f.closest(".form-page") || document;   // 进度条在表单外面（页头下面）
  page.querySelector("[data-vz-now]").innerHTML = nowText(id);
  page.querySelector("[data-vz-dots]").innerHTML = dots(id);
  f.querySelector('[data-vz="prev"]').hidden = stepNo(id) === 0;
  f.querySelector('[data-vz="next"]').hidden = id === "review";
  f.querySelector("[data-vz-save]").hidden = id !== "review";
  const err = f.querySelector("#assetFormError"); if (err) err.textContent = "";
  f.scrollIntoView({ block: "start" });
}

/** 这一步能不能往下走（基本信息：名称必填；年款在 1950 到今年） */
function check(f, id) {
  const err = f.querySelector("#assetFormError"), fe = f.elements;
  if (id === "basic" && !fe.name.value.trim()) { err.textContent = t("请填写设备名称。"); fe.name.focus(); return false; }
  const y = fe.manufacture_year.value === "" ? null : Math.round(Number(fe.manufacture_year.value)), now = new Date().getFullYear();
  if (id === "years" && y != null && (!Number.isFinite(y) || y < 1950 || y > now)) { err.textContent = t("出厂年份需要在 1950 到 {y} 之间。", { y: now }); fe.manufacture_year.focus(); return false; }
  return true;
}

/** 确认页：每一块 = 车辆资料页同样的分区卡片 + 「编辑」（回到对应那一步） */
function reviewHtml(f) {
  const a = readAsset(f);
  const blocks = vehSteps().map((s) => `<section class="panel prof-card" aria-labelledby="vzr-${s.id}"><header class="prof-head"><span class="mi" aria-hidden="true">${s.icon}</span><div class="prof-t"><h3 id="vzr-${s.id}">${esc(t(s.name))}</h3></div>
      <button type="button" class="btn btn-sm btn-ghost prof-edit" data-vz="goto" data-step="${s.id}" aria-label="${esc(t("编辑 {name}", { name: t(s.name) }))}">${t("编辑")}</button></header>${vehicleFacts(a, s.id)}</section>`).join("");
  return `<p class="muted" style="margin:0 0 10px;font-size:13px">${t("请核对下面的信息；哪一块要改，点它的「编辑」回到那一步。没问题就点最下面的「确认并创建」，到这一步才会真正建好这辆车。")}</p><div class="prof-grid">${blocks}</div>`;
}

/** 在向导里按了回车：当成「下一步」，不直接保存；确认页上按回车 / 点「确认并创建」：先把每一步再查一遍，有问题回到那一步。返回 true = 已处理，不用保存（saveAssetForm 开头调用） */
export function vwIntercept(f) {
  if (!f?.hasAttribute("data-vwz")) return false;
  const id = cur(f);
  if (id !== "review") { advance(f); return true; }
  for (const s of vehSteps()) if (!check(f, s.id)) { show(f, s.id); check(f, s.id); return true; }
  return false;
}
function advance(f) {
  const id = cur(f), list = steps(), i = stepNo(id);
  if (check(f, id)) show(f, list[Math.min(list.length - 1, i + 1)].id);
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-vz]"), f = form(); if (!b || !f || !f.hasAttribute("data-vwz")) return;
    const act = b.dataset.vz, list = steps(), i = stepNo(cur(f));
    if (act === "next") return advance(f);
    if (act === "prev") return show(f, list[Math.max(0, i - 1)].id);
    if (act === "goto") return show(f, b.dataset.step);
  });
}
