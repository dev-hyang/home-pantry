/* 加入购物车前确认数量和单位（2026-11-14）：所有「加入购物车」都走这里——单件（行上的按钮、右滑）和多件（全部加入、多选）同一个框。
 * 不是浏览器的 alert / prompt（那些可能被拦截），是页面里自己画的 <dialog>：电脑上居中，手机上贴底部；
 * 每件一行：勾选、名称、数量、单位（下拉，可「其他…」手填）；件数多时框内滚动。Esc / 点外面 / 取消都是不加。 */
import { numAttrs } from "../core/ui-num.js";
import { esc, fmt, spaceOf } from "../core/util.js";
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
      <input ${numAttrs("qty")} class="ask-qty" data-i="${i}" value="${esc(fmt(Math.max(1, Math.round(Number(it.dsuggest) || 1))))}" aria-label="${esc(t("{name} 数量", { name: it.name }))}">
      ${unitSelect(`data-i="${i}" aria-label="${esc(t("{name} 单位", { name: it.name }))}"`, it.du || it.unit || "个", { cls: "ask-unit" })}
    </li>`;
    dlg.innerHTML = `<form class="ask-form" novalidate>
      <h3 id="askShopTitle">🛒 ${esc(many ? t("加入购物车（{n} 项）", { n: list.length }) : t("加入购物车"))}</h3>
      <p class="muted ask-tip">${esc(many ? t("确认要买多少；不要的取消勾选") : t("确认要买多少"))}</p>
      <ul class="ask-list">${list.map(row).join("")}</ul>
      <p class="form-error ask-err" role="alert"></p>
      <div class="ui-acts ask-acts">
        ${many ? `<button type="button" class="ui-btn ask-all" data-size="sm" data-tone="ghost" data-ask="all">${esc(t("全不选"))}</button><span class="spacer"></span>` : ""}
        <button type="button" class="ui-btn" data-tone="ghost" data-ask="cancel">${esc(t("取消"))}</button>
        <button type="submit" class="ui-btn ask-ok" data-tone="primary"></button></div>
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

/** 页面里的确认框（不用浏览器的 confirm，那个可能被拦）：返回 true = 确认，false = 取消 */
export function askConfirm({ title, body, ok, danger = false }) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "ask-dlg ask-confirm";
    dlg.setAttribute("aria-labelledby", "askConfirmTitle");
    dlg.innerHTML = `<form class="ask-form" novalidate><h3 id="askConfirmTitle">${esc(title)}</h3><p class="ask-body">${esc(body)}</p>
      <div class="ui-acts ask-acts"><button type="button" class="ui-btn" data-tone="ghost" data-ask="cancel">${esc(t("取消"))}</button>
        <button type="submit" class="ui-btn" data-tone="${danger ? "danger-solid" : "primary"}">${esc(ok || t("确认"))}</button></div></form>`;
    document.body.appendChild(dlg);
    let done = false;
    const finish = (v) => { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); };
    dlg.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); finish(true); });
    dlg.querySelector('[data-ask="cancel"]').addEventListener("click", () => finish(false));
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); finish(false); });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) finish(false); });
    dlg.showModal();
    dlg.querySelector('[data-ask="cancel"]').focus();
  });
}

/** 库存行上「不提醒 / 提醒」标签点开的小弹框：只设两个参数——少货线、提前几天。
 *  it：enrich 过的物品（min_quantity、lead_days 是存储单位；du / 换算按显示单位），noRemind = 现在是不是「不提醒」。
 *  返回 { min, lead }（存储单位）、{ off: true }（不再提醒），取消返回 null */
export function askRemind(it) {
  return new Promise((resolve) => {
    const f = window.Units.factor(it.unit) || 1, on = !it.noRemind;
    const defMin = Number(it.min_quantity) > 0 ? Number(it.min_quantity) : 1, defLead = it.lead_days > 0 ? Number(it.lead_days) : spaceOf(it.category) === "house" ? 14 : 3;
    const dlg = document.createElement("dialog");
    dlg.className = "ask-dlg ask-remind";
    dlg.setAttribute("aria-labelledby", "askRemindTitle");
    dlg.innerHTML = `<form class="ask-form" novalidate>
      <h3 id="askRemindTitle">🔔 ${esc(t("提醒设置：{name}", { name: it.name }))}</h3>
      <div class="ask-fields">
        <label>${esc(t("少货线"))}<span class="ask-unit-line"><input ${numAttrs("qty")} name="min" value="${esc(fmt(Math.round(defMin * f * 100) / 100))}"><b>${esc(t(it.du))}</b></span><small class="muted">${esc(t("数量低于或等于它时提醒“少货”"))}</small></label>
        <label>${esc(t("提前几天提醒"))}<span class="ask-unit-line"><input ${numAttrs("int", { max: 60 })} name="lead" value="${esc(defLead)}"><b>${esc(t("天"))}</b></span><small class="muted">${esc(t("预计剩余天数低于它时提醒“即将告罄”"))}</small></label>
      </div>
      <p class="form-error ask-err" role="alert"></p>
      <div class="ui-acts ask-acts">
        ${on ? `<button type="button" class="ui-btn" data-tone="ghost" data-ask="off">${esc(t("不再提醒"))}</button>` : ""}<span class="spacer"></span>
        <button type="button" class="ui-btn" data-tone="ghost" data-ask="cancel">${esc(t("取消"))}</button>
        <button type="submit" class="ui-btn" data-tone="primary">${esc(t("保存"))}</button></div>
    </form>`;
    document.body.appendChild(dlg);
    let done = false;
    const finish = (v) => { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); };
    dlg.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const m = Number(dlg.querySelector('[name="min"]').value || 0), d = Number(dlg.querySelector('[name="lead"]').value || 0), err = dlg.querySelector(".ask-err");
      if (!(m >= 0) || !(d >= 0)) { err.textContent = t("请填 0 或更大的数。"); return; }
      if (m === 0 && d === 0) { err.textContent = t("两项都是 0 就等于不提醒；想关掉请点「不再提醒」。"); return; }
      finish({ min: Math.round((m / f) * 1000) / 1000, lead: Math.min(60, Math.round(d)) });
    });
    dlg.querySelector('[data-ask="off"]')?.addEventListener("click", () => finish({ off: true }));
    dlg.querySelector('[data-ask="cancel"]').addEventListener("click", () => finish(null));
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); finish(null); });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) finish(null); });
    dlg.showModal();
    const q = dlg.querySelector('[name="min"]'); q.focus({ preventScroll: true }); q.select?.();
  });
}
