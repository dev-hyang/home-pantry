/* 加入采购清单前确认数量和单位（2026-11-14）：所有「加入采购清单」都走这里——单件（行上的按钮、右滑）和多件（全部加入、多选）同一个框。
 * 不是浏览器的 alert / prompt（那些可能被拦截），是页面里自己画的 <dialog>：电脑上居中，手机上贴底部；
 * 每件一行：勾选、名称、数量、单位（下拉，可「其他…」手填）；件数多时框内滚动。Esc / 点外面 / 取消都是不加。 */
import { esc, fmt } from "../core/util.js";
import { t } from "../core/i18n.js";
import { unitSelect } from "../core/unit-pick.js";

/** list：库存物品（enrich 过的，带 dsuggest / du）。返回 [{ it, quantity, unit }]（勾选的那些），取消返回 null */
export function askShopItems(list) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "ask-dlg";
    dlg.setAttribute("aria-labelledby", "askShopTitle");
    const many = list.length > 1;
    const row = (it, i) => `<li class="ask-item">
      ${many ? `<input type="checkbox" class="ask-inc" data-i="${i}" checked aria-label="${esc(t("加入 {name}", { name: it.name }))}">` : ""}
      <span class="ask-name">${esc(it.name)}</span>
      <input type="number" class="ask-qty" data-i="${i}" inputmode="decimal" min="0" step="any" value="${esc(fmt(Math.max(1, Math.round(Number(it.dsuggest) || 1))))}" aria-label="${esc(t("{name} 数量", { name: it.name }))}">
      ${unitSelect(`data-i="${i}" aria-label="${esc(t("{name} 单位", { name: it.name }))}"`, it.du || it.unit || "个", { cls: "ask-unit" })}
    </li>`;
    dlg.innerHTML = `<form class="ask-form" novalidate>
      <h3 id="askShopTitle">🛒 ${esc(many ? t("加入采购清单（{n} 项）", { n: list.length }) : t("加入采购清单"))}</h3>
      <p class="muted ask-tip">${esc(many ? t("确认要买多少；不要的取消勾选") : t("确认要买多少"))}</p>
      <ul class="ask-list">${list.map(row).join("")}</ul>
      <p class="form-error ask-err" role="alert"></p>
      <div class="ask-acts">
        ${many ? `<button type="button" class="btn btn-ghost btn-sm ask-all" data-ask="all">${esc(t("全不选"))}</button><span class="spacer"></span>` : ""}
        <button type="button" class="btn btn-ghost" data-ask="cancel">${esc(t("取消"))}</button>
        <button type="submit" class="btn btn-primary ask-ok"></button></div>
    </form>`;
    document.body.appendChild(dlg);
    const f = dlg.querySelector("form"), okBtn = dlg.querySelector(".ask-ok"), allBtn = dlg.querySelector('[data-ask="all"]');
    const incs = () => [...dlg.querySelectorAll(".ask-inc")];
    const picked = () => (many ? incs().filter((c) => c.checked).map((c) => +c.dataset.i) : [0]);
    const sync = () => {
      const n = picked().length;
      okBtn.textContent = many ? t("加入 {n} 项", { n }) : t("加入");
      okBtn.disabled = !n;
      if (allBtn) allBtn.textContent = n === list.length ? t("全不选") : t("全选");
      dlg.querySelectorAll(".ask-item").forEach((li, i) => li.classList.toggle("is-off", many && !incs()[i].checked));
    };
    sync();
    let done = false;
    const finish = (v) => { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); };
    f.addEventListener("change", (e) => { if (e.target.classList.contains("ask-inc")) sync(); });
    allBtn?.addEventListener("click", () => { const on = picked().length !== list.length; incs().forEach((c) => { c.checked = on; }); sync(); });
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const out = [];
      for (const i of picked()) {
        const q = dlg.querySelector(`.ask-qty[data-i="${i}"]`), uEl = dlg.querySelector(`[data-i="${i}"].ask-unit, input[data-i="${i}"].unit-typed`) || dlg.querySelectorAll(".ask-item")[i].querySelector(".unit-pick, .unit-pick-in");
        const n = Number(q.value), raw = String(uEl?.value || "").trim(), u = raw && raw !== "__other" ? (window.Units.normalize(raw) || raw).slice(0, 10) : list[i].unit;
        if (!(n > 0)) { dlg.querySelector(".ask-err").textContent = t("{name} 的数量要大于 0。", { name: list[i].name }); q.focus(); return; }
        out.push({ it: list[i], quantity: Math.round(n * 100) / 100, unit: u || "个" });
      }
      finish(out);
    });
    dlg.querySelector('[data-ask="cancel"]').addEventListener("click", () => finish(null));
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); finish(null); });   // Esc
    dlg.addEventListener("click", (e) => { if (e.target === dlg) finish(null); });   // 点背景
    dlg.showModal();
    if (!many) { const q = dlg.querySelector(".ask-qty"); q.focus({ preventScroll: true }); q.select?.(); }
  });
}
