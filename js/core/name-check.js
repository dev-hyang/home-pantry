/* 同名称呼检查：同一个人用多个浏览器 / 设备（邀请码直接进入）会变成多位“爸爸”。
 * 加入家庭后发现和别的成员同名，就推荐“爸爸#2”“爸爸 10/22”这样的称呼；改称呼时也检查。 */
import { state } from "./state.js";
import { esc, todayISO } from "./util.js";
import { t } from "./i18n.js";

const MAX_LEN = 20;   // 称呼输入框的长度上限
export const nameKey = (n) => String(n || "").trim().replace(/\s+/g, " ").toLowerCase();
const SKIP_KEY = "hmh-name-ok";   // 选了“保持不变”的 用户 + 称呼，不再提示

/** 别的成员里和 name 同名的那一位（忽略大小写和空格）；没有返回 null */
export function sameNameMember(name, members = state.members, myId = state.user?.id) {
  const k = nameKey(name); if (!k) return null;
  return (members || []).find((m) => m.user_id !== myId && nameKey(m.display_name) === k) || null;
}

/** 推荐称呼：序列号（爸爸#2、#3…取第一个没人用的）和日期（爸爸 10/22；日期也被占了就再加序列号）。结果不会超过输入框长度。 */
export function suggestNames(name, members = state.members, myId = state.user?.id, today = todayISO()) {
  const base = String(name || "").trim().replace(/\s*#\d+$/, "").replace(/\s+\d{1,2}\/\d{1,2}$/, "") || "家人";
  const used = new Set((members || []).filter((m) => m.user_id !== myId).map((m) => nameKey(m.display_name)));
  const fit = (stem, tail) => `${stem.slice(0, Math.max(1, MAX_LEN - tail.length))}${tail}`;
  const free = (candidate) => !used.has(nameKey(candidate));
  let n = 2; while (!free(fit(base, `#${n}`))) n++;
  const bySerial = fit(base, `#${n}`);
  const [, mm = "0", dd = "0"] = today.split("-");
  const dateTail = ` ${+mm}/${+dd}`;
  let byDate = fit(base, dateTail), k = 2;
  while (!free(byDate)) byDate = fit(base, `${dateTail}#${k++}`);
  return [...new Set([bySerial, byDate])];
}

const skipped = () => { try { return JSON.parse(localStorage.getItem(SKIP_KEY) || "[]"); } catch { return []; } };
const markSkipped = (key) => { try { localStorage.setItem(SKIP_KEY, JSON.stringify([...new Set([...skipped(), key])].slice(-20))); } catch { /* 忽略 */ } };

/** 加入家庭后调用：我的称呼和别人撞了，弹窗让用户一键改成推荐的称呼，或保持不变。resolve 为新的称呼（没改返回 null）。 */
export function promptDuplicateName({ save }) {
  const me = state.user?.id, mine = state.displayName;
  const other = sameNameMember(mine);
  const memo = `${me}:${nameKey(mine)}`;
  if (!me || !other || skipped().includes(memo)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const picks = suggestNames(mine);
    const box = document.createElement("div");
    box.className = "name-dup-overlay";
    box.innerHTML = `<div class="name-dup panel" role="dialog" aria-modal="true" aria-labelledby="ndTitle">
      <h3 id="ndTitle">${t("家里已经有一位叫“{n}”的了", { n: esc(mine) })}</h3>
      <p class="muted">${t("如果这是同一个人用了另一个浏览器或设备，保持不变也可以；如果是不同的人，改个称呼方便区分。")}</p>
      <div class="chips" role="group" aria-label="${t("推荐称呼")}">${picks.map((p) => `<button type="button" class="chip" data-pick="${esc(p)}">${esc(p)}</button>`).join("")}</div>
      <form><input name="display_name" required maxlength="${MAX_LEN}" value="${esc(picks[0])}" aria-label="${t("我的称呼")}">
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${t("用这个称呼")}</button><button class="btn btn-ghost" type="button" data-keep>${t("保持不变")}</button></div></form></div>`;
    document.body.appendChild(box);
    const form = box.querySelector("form"), input = form.elements.display_name, err = box.querySelector(".form-error");
    const close = (v) => { box.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const keep = () => { markSkipped(memo); close(null); };
    const onKey = (e) => { if (e.key === "Escape") keep(); };
    document.addEventListener("keydown", onKey);
    box.addEventListener("click", (e) => {
      const p = e.target.closest("[data-pick]"); if (p) { input.value = p.dataset.pick; input.focus(); }
      if (e.target.closest("[data-keep]")) keep();
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = input.value.trim(); if (!v) return;
      if (sameNameMember(v)) { err.textContent = t("“{n}”也有人用了，换一个或点上面的推荐", { n: v }); err.hidden = false; return; }
      try { await save(v); close(v); } catch (x) { err.textContent = x.message; err.hidden = false; }
    });
    input.focus(); input.select();
  });
}
