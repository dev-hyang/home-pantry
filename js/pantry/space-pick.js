/* 添加物品前先选放在哪一类（2026-11-14）：右下角 ＋、概览的「添加物品」点了先弹这个框——
 * 日常消耗品 / 汽车房屋消耗品 / 家居耐用品，每项一句说明；选了再进添加物品表单（表单里那一类已经选好）。
 * 和「加入购物车」同一套页面内 <dialog>（不是浏览器弹窗）：电脑居中，手机贴底。只开了一类时不问。 */
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { SPACE_INFO } from "./item-form.js";

/** 返回选中的空间（pantry / house / gear），取消返回 null */
export function pickSpace() {
  const list = SPACE_INFO.filter(([s]) => s === "pantry" || (s === "house" ? state.houseEnabled : state.gearEnabled));
  if (list.length < 2) return Promise.resolve(list[0]?.[0] || "pantry");
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "ask-dlg space-dlg";
    dlg.setAttribute("aria-labelledby", "spacePickTitle");
    dlg.innerHTML = `<div class="ask-form">
      <h3 id="spacePickTitle">＋ ${esc(t("添加物品"))}</h3>
      <p class="muted ask-tip">${esc(t("先选它属于哪一类"))}</p>
      <div class="space-list">${list.map(([s, ic, name, desc]) => `<button type="button" class="space-choice" data-space="${s}">
        <span class="space-ic" aria-hidden="true">${ic}</span><span class="space-txt"><b>${esc(t(name))}</b><small>${esc(t(desc))}</small></span><span class="ui-chev" aria-hidden="true">›</span></button>`).join("")}</div>
      <div class="ask-acts"><button type="button" class="btn btn-ghost" data-ask="cancel">${esc(t("取消"))}</button></div>
    </div>`;
    document.body.appendChild(dlg);
    let done = false;
    const finish = (v) => { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); };
    dlg.querySelectorAll(".space-choice").forEach((b) => b.addEventListener("click", () => finish(b.dataset.space)));
    dlg.querySelector('[data-ask="cancel"]').addEventListener("click", () => finish(null));
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); finish(null); });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) finish(null); });
    dlg.showModal();
    dlg.querySelector(".space-choice")?.focus();
  });
}

/** 消耗品空白页的 ＋：手动添加 / 按房屋设备资料推荐；返回 "manual" | "template"，取消返回 null */
export function pickSupplyAdd() {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "ask-dlg space-dlg";
    dlg.setAttribute("aria-labelledby", "supplyPickTitle");
    const opt = ([k, ic, name, desc]) => `<button type="button" class="space-choice" data-c="${k}"><span class="space-ic" aria-hidden="true">${ic}</span><span class="space-txt"><b>${esc(t(name))}</b><small>${esc(t(desc))}</small></span><span class="ui-chev" aria-hidden="true">›</span></button>`;
    dlg.innerHTML = `<div class="ask-form"><h3 id="supplyPickTitle">＋ ${esc(t("添加汽车房屋消耗品"))}</h3>
      <div class="space-list">${[["manual", "✏️", "手动添加", "自己填名称、数量、放哪里"], ["template", "🧰", "按房屋设备资料推荐", "按房型和设施一次勾选加入"]].map(opt).join("")}</div>
      <div class="ask-acts"><button type="button" class="btn btn-ghost" data-ask="cancel">${esc(t("取消"))}</button></div></div>`;
    document.body.appendChild(dlg);
    let done = false;
    const finish = (v) => { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); };
    dlg.querySelectorAll(".space-choice").forEach((b) => b.addEventListener("click", () => finish(b.dataset.c)));
    dlg.querySelector('[data-ask="cancel"]').addEventListener("click", () => finish(null));
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); finish(null); });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) finish(null); });
    dlg.showModal();
    dlg.querySelector(".space-choice")?.focus();
  });
}
