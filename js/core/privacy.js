/* 金额遮挡（2026-11-07，隐私）：今日「钱 · 本月」和财务各页看板上的大数字。
 * 两种模式（记在这台设备上）：
 *   遮挡（外出，默认）：大数字模糊；点哪个露哪个 10 秒；单击眼睛 = 全部露 10 秒
 *   常显示（在家）    ：全部显示；单击眼睛 = 马上遮起来（切回遮挡）
 * 双击或长按眼睛 = 在两种模式之间切换；我的 → 设置 也能选。常显示时页面在后台放了 30 分钟以上，回来自动切回遮挡（出门忘了切也不会一直露着）。
 * 只是不让旁边的人一眼看到：数字仍在页面里，不是加密。
 * 哪些算「大数字」：带 data-money 的元素；财务页的看板（.kpi > b、.sum-main b 等）在每次画完页面后由 decoratePrivacy() 标上，明细表格和图表不遮。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";

const KEY = "hmh-money-mask", AWAY_KEY = "hmh-money-away", PEEK_MS = 10e3, AWAY_MS = 30 * 60e3, HOLD_MS = 550;
let toastFn = () => {};
export const initPrivacy = ({ toast }) => { toastFn = toast || toastFn; applyMode(); };

export const moneyHidden = () => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } };
export function setMoneyHidden(hide) {
  try { localStorage.setItem(KEY, hide ? "1" : "0"); } catch { /* 忽略 */ }
  applyMode(); syncEyes();
}
function applyMode() { document.documentElement.classList.toggle("money-hide", moneyHidden()); document.documentElement.classList.remove("money-peek"); }

/** 眼睛按钮：闭眼 = 遮挡模式，睁眼 = 常显示 */
const EYE_OFF = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M3 10c2.2 3 5.4 4.6 9 4.6s6.8-1.6 9-4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 13.2 4.6 15.4M12 14.6v2.6M18 13.2l1.4 2.2M9 14.3l-.8 2.4M15 14.3l.8 2.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const EYE_ON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const eyeLabel = (hide) => (hide ? t("金额已遮挡（外出）。单击：全部显示 10 秒；双击或长按：切到常显示（在家）") : t("金额常显示（在家）。单击：马上遮起来；双击或长按：切回遮挡（外出）"));
export function moneyEye(cls = "") {
  const hide = moneyHidden();
  return `<button type="button" class="money-eye ${cls}" data-moneyeye aria-pressed="${!hide}" aria-label="${esc(eyeLabel(hide))}" title="${esc(eyeLabel(hide))}"><span class="me-ico">${hide ? EYE_OFF : EYE_ON}</span><svg class="me-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16"/></svg></button>`;
}
function syncEyes() {
  const hide = moneyHidden();
  document.querySelectorAll("[data-moneyeye]").forEach((b) => { b.setAttribute("aria-pressed", String(!hide)); b.setAttribute("aria-label", eyeLabel(hide)); b.title = eyeLabel(hide); b.querySelector(".me-ico").innerHTML = hide ? EYE_OFF : EYE_ON; });
}

/** 财务页画完以后：给看板上的大数字标 data-money，并在每组看板右上角放一只眼睛（今日的钱卡在自己的标记里已经有了） */
const BOARD_NUMS = ".kpi > b, .sum-main b, .stat .v, .nw-card-bal, [data-money-auto] b";
export function decoratePrivacy(route) {
  const main = document.getElementById("main"); if (!main) return;
  if (route?.section !== "bills") return;
  main.querySelectorAll(BOARD_NUMS).forEach((el) => el.setAttribute("data-money", ""));
  main.querySelectorAll(".kpis, .sum-main").forEach((box) => {   // 每组看板：右上角一只眼睛（同一个容器只放一次）
    if (box.previousElementSibling?.classList?.contains("money-eye-row") || !box.querySelector("[data-money]") && !box.matches("[data-money], .sum-main")) return;
    box.insertAdjacentHTML("beforebegin", `<div class="money-eye-row">${moneyEye()}</div>`);
  });
}

/* ── 交互 ── */
let peekTimer = 0, clickTimer = 0, holdTimer = 0, held = false;
function peekAll() {
  const root = document.documentElement; root.classList.add("money-peek");
  document.querySelectorAll("[data-moneyeye]").forEach((b) => { b.classList.remove("is-counting"); void b.offsetWidth; b.classList.add("is-counting"); });
  clearTimeout(peekTimer); peekTimer = setTimeout(() => { root.classList.remove("money-peek"); document.querySelectorAll("[data-moneyeye]").forEach((b) => b.classList.remove("is-counting")); }, PEEK_MS);
}
function switchMode() {
  const hide = !moneyHidden(); setMoneyHidden(hide);
  toastFn(hide ? t("已切回遮挡（外出）：点单个金额看 10 秒") : t("已切到常显示（在家）：页面在后台超过 30 分钟会自动切回遮挡"));
}
function singleTap() {
  if (moneyHidden()) { peekAll(); toastFn(t("显示 10 秒。要一直显示：双击或长按眼睛")); }
  else { setMoneyHidden(true); toastFn(t("已遮起来。要一直显示：双击或长按眼睛")); }
}
if (typeof document !== "undefined") {
  // 眼睛：单击 / 双击（300ms 内第二下）/ 长按（0.55 秒）
  document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest?.("[data-moneyeye]"); if (!b) return;
    held = false; clearTimeout(holdTimer); holdTimer = setTimeout(() => { held = true; clearTimeout(clickTimer); clickTimer = 0; switchMode(); }, HOLD_MS);
  });
  const cancelHold = () => clearTimeout(holdTimer);
  document.addEventListener("pointerup", cancelHold); document.addEventListener("pointercancel", cancelHold);
  document.addEventListener("contextmenu", (e) => { if (e.target.closest?.("[data-moneyeye]")) e.preventDefault(); });   // 长按不弹系统菜单
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-moneyeye]");
    if (b) {
      e.preventDefault(); e.stopPropagation();
      if (held) { held = false; return; }   // 长按已经切换过了
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = 0; switchMode(); return; }   // 双击
      clickTimer = setTimeout(() => { clickTimer = 0; singleTap(); }, 300);
      return;
    }
    // 遮挡时点一个大数字：只露它 10 秒（它在链接里也先不跳转，再点一次才进去）
    const root = document.documentElement; if (!root.classList.contains("money-hide") || root.classList.contains("money-peek")) return;
    const m = e.target.closest?.("[data-money]"); if (!m || m.classList.contains("is-peek")) return;
    e.preventDefault(); e.stopPropagation();
    m.classList.add("is-peek"); clearTimeout(m._peek); m._peek = setTimeout(() => m.classList.remove("is-peek"), PEEK_MS);
  }, true);
  // 常显示时离开 30 分钟以上：回来自动切回遮挡
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { try { localStorage.setItem(AWAY_KEY, String(Date.now())); } catch { /* 忽略 */ } return; }
    let at = 0; try { at = +localStorage.getItem(AWAY_KEY) || 0; } catch { /* 忽略 */ }
    if (at && Date.now() - at >= AWAY_MS && !moneyHidden()) { setMoneyHidden(true); toastFn(t("离开超过 30 分钟，金额已自动遮挡")); }
  });
}
