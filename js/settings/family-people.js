/* 设置 → 家庭与成员：家庭成员（人）卡片列表 + 成员详情页（基本资料 / 登录设备 / 登录记录，三块都能折叠，右上角各有编辑）。
 *   · 一个人可以有多台登录设备（household_members.person_id）；账单「谁负责」、一次性账单的患者、收入都关联「人」，不是设备。
 *   · 家主：看到全部人、全部设备、全部登录记录；普通成员：只看到自己和自己名下的设备 / 记录。
 *   · 第一次用一台新设备登录会问「这台设备是谁？」（链接过就不再出现，可折叠）。
 * 数据：名册 household_people（state.people），设备 household_members（state.members），登录记录见 logins.js。迁移 084 / 085 / 087 / 088。 */
import { state } from "../core/state.js";
import { CloudStore, DemoStore, Store } from "../core/store.js";
import { $, esc, fmtDate, fmtDateTime, toast } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { moreMenu } from "../core/more-menu.js";
import { PEOPLE_KINDS } from "../bills/medical.js";
import { DEVICE_ICON } from "../core/device-info.js";
import { amOwner, famMembers, familyHref, meId, reloadMembers } from "./members.js";
import { deviceText, ensureLogins, L, lastLoginOf, loginHasMore, loginRowHtml, loginWindow } from "./logins.js";

const demo = () => Store.mode === "demo";
export const personHref = (id) => `${familyHref()}&person=${encodeURIComponent(id)}`;
const F = { edit: null, devShow: 6, devOpen: null, scopeAll: false };   // 当前正在编辑的块、设备显示几行、哪台设备展开了详情、登录记录是否看全家

/* ── 数据小工具 ── */
export const myMember = () => famMembers().find((m) => m.user_id === meId()) || null;
export const myPersonOf = () => myMember()?.person_id || null;
export const devicesOf = (personId) => famMembers().filter((m) => m.person_id === personId);
export const personNameOf = (id) => state.people.find((p) => p.id === id)?.name || "";
export const adultPeople = () => state.people.filter((p) => (p.kind || "adult") === "adult");
export const visiblePeople = () => (amOwner() ? state.people : state.people.filter((p) => p.id === myPersonOf()));
const personOk = (p) => amOwner() || p.id === myPersonOf();
const roleOf = (p) => (devicesOf(p.id).some((d) => d.role === "owner") ? "owner" : devicesOf(p.id).length ? "member" : null);
const avatarOf = (p) => (p.kind === "pet" ? "🐾" : p.kind === "child" ? (p.gender === "female" ? "👧" : p.gender === "male" ? "👦" : "🧒") : p.gender === "female" ? "👩" : p.gender === "male" ? "👨" : "🧑");

/** 把设备链接到某个人（空 = 取消链接）；设备自己、或家主可以 */
export async function setDevicePerson(userId, personId) {
  if (demo()) { DemoStore.demoMember(userId).person_id = personId || null; DemoStore.persist(); }
  else await CloudStore.setMemberPerson(userId, personId || null);
  await reloadMembers();
}
export async function createPerson(name, kind = "adult") {
  const id = await Store.savePerson({ name: String(name).trim().slice(0, 40), kind });
  state.people = await Store.listPeople();
  return id || state.people.find((p) => p.name === String(name).trim())?.id;
}

/* ── 这台设备是谁？（可折叠；已经链接就不显示） ── */
export function deviceLinkPrompt() {
  if (demo()) return "";
  const m = myMember(); if (!m || m.person_id) return "";
  const opts = adultPeople().map((p) => `<option value="${esc(p.id)}">${esc(p.name)}${devicesOf(p.id).length ? ` · ${t("{n} 台设备", { n: devicesOf(p.id).length })}` : ""}</option>`).join("");
  return `<details class="panel device-link" open><summary><b>📱 ${t("这台设备是谁？")}</b></summary>
    <p class="muted">${t("选你自己，账单的“谁负责”、收入和医疗账单才会记在同一个人名下；换了新设备再登录，选同一个人就行，不会多出一个人。")}</p>
    ${opts ? `<div class="dl-row"><select id="devLinkPick" aria-label="${esc(t("选择家庭成员"))}"><option value="">${t("选择家庭成员…")}</option>${opts}</select><button type="button" class="btn btn-primary" data-action="device-link">${t("就是我")}</button></div>` : ""}
    <div class="dl-row"><input id="devLinkNew" maxlength="40" placeholder="${esc(t("我是新成员，名字："))}" value="${esc(opts ? "" : m.display_name || "")}" aria-label="${esc(t("新成员的名字"))}"><button type="button" class="btn ${opts ? "btn-ghost" : "btn-primary"}" data-action="device-link-new">${t("新建并链接")}</button></div></details>`;
}
export async function deviceLinkDo() { const id = $("#devLinkPick")?.value; if (!id) return toast(t("先选一位家庭成员。")); await setDevicePerson(meId(), id); toast(t("已链接")); }
export async function deviceLinkNew() {
  const name = $("#devLinkNew")?.value.trim(); if (!name) return toast(t("请填名字。"));
  const hit = state.people.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
  if (hit && !window.confirm(t("名册里已经有「{n}」。确定 = 就是这位，链接过去；取消 = 返回。", { n: hit.name }))) return;
  await setDevicePerson(meId(), hit ? hit.id : await createPerson(name, "adult")); toast(t("已链接"));
}

/* ── 家庭成员卡片列表 ── */
const badgesOf = (p) => {
  const role = roleOf(p);
  return [`<span class="badge mem-b">${t(PEOPLE_KINDS[p.kind] || p.kind)}</span>`, role === "owner" ? `<span class="badge b-ok">${t("家主")}</span>` : role === "member" ? `<span class="badge mem-b">${t("家庭成员")}</span>` : "",
    p.id === myPersonOf() ? `<span class="badge mem-b">${t("我")}</span>` : ""].filter(Boolean).join(" ");
};
function cardHtml(p) {
  const owner = amOwner(), devs = devicesOf(p.id), last = devs.length ? lastLoginOf(devs.map((d) => d.user_id)) : null, me = p.id === myPersonOf();
  const contact = [p.phone ? `📞 <a href="tel:${esc(p.phone.replace(/[^\d+]/g, ""))}">${esc(p.phone)}</a>` : "", p.email ? `✉️ <a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ""].filter(Boolean).join(" · ");
  const lastTxt = devs.length ? (last ? `🕘 ${esc(fmtDateTime(last.at))} · ${DEVICE_ICON[last.device] || "💻"} ${esc(deviceText(last.device))}${last.location ? ` · 🌐 ${esc(last.location)}` : ""}${last.ip ? ` · IP ${esc(last.ip)}` : ""}` : `<span class="muted">${t("还没有登录记录（这台设备打开新版本后才开始记）")}</span>`) : "";
  const merging = state.personMerge === p.id;
  const menu = moreMenu([{ label: t("详情"), href: personHref(p.id), first: true }, owner && state.people.length > 1 ? { label: t("合并"), action: "person-merge-open", data: { id: p.id } } : null, owner && !me ? { label: t("移出"), action: "person-remove", data: { id: p.id }, danger: true } : null, me && !demo() ? { label: t("退出"), action: "logout" } : null], { label: `${p.name} · ${t("更多操作")}` });
  return `<li class="fam-card" data-href="${esc(personHref(p.id))}">
    <div class="fam-row"><span class="fam-av" aria-hidden="true">${avatarOf(p)}</span>
      <div class="fam-main"><b class="fam-name">${esc(p.name)}</b><span class="mem-badges">${badgesOf(p)}</span>
        ${contact ? `<small>${contact}</small>` : ""}${lastTxt ? `<small class="fam-last">${lastTxt}</small>` : ""}</div>
      <div class="fam-act">${menu}</div></div>
    ${owner && merging ? `<div class="person-merge"><span class="muted">${t("把“{n}”合并到：", { n: esc(p.name) })}</span>
        <select data-merge-for="${p.id}" aria-label="${esc(t("合并到"))}"><option value="">${t("选一个人…")}</option>${state.people.filter((x) => x.id !== p.id).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select>
        <button type="button" class="btn btn-sm btn-primary" data-action="person-merge" data-id="${p.id}">${t("确认合并")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="person-merge-cancel">${t("取消")}</button>
        <small class="muted">${t("它的账单、设备都会归到所选的人名下，然后这一条被删除。")}</small></div>` : ""}</li>`;
}
export function peoplePanel() {
  ensureLogins();
  const owner = amOwner(), list = visiblePeople();
  const add = owner ? `<a class="btn btn-primary btn-sm" href="${personHref("new")}">＋ ${t("添加")}</a>` : "";
  return `<div class="panel"><div class="fam-head"><h3 class="mem-h">${t("家庭成员（{n}）", { n: list.length })}</h3>${add}</div>
      ${list.length ? `<ul class="fam-list">${list.map(cardHtml).join("")}</ul>` : `<div class="empty"><strong>${t("还没有家庭成员")}</strong>${t("家主可以点上面的“＋ 添加”。")}</div>`}
      <p class="muted mem-note">${owner ? t("点右边的 ⋯ 看详情（资料、登录设备、登录记录）。账单的“谁负责”、一次性账单的患者、收入都关联到这里的人。") : t("你只能看到自己；家主管理全部家庭成员。")}</p></div>`;
}

/* ── 成员详情页 ── */
/** 一个可折叠的块：标题 + 右上角编辑；编辑按钮在 <summary> 里，点它不折叠（见底部的点击处理） */
const sec = (id, icon, title, body, { edit = false, open = true, count = "" } = {}) => `<details class="panel prof-card fam-sec" data-fam-sec="${id}" ${open ? "open" : ""}>
    <summary class="prof-head"><span class="mi" aria-hidden="true">${icon}</span><div class="prof-t"><h3>${title}</h3>${count ? `<small>${count}</small>` : ""}</div>${edit ? `<button type="button" class="btn btn-sm btn-ghost prof-edit" data-fam-edit="${id}" aria-pressed="${F.edit === id}">${F.edit === id ? t("完成") : t("编辑")}</button>` : ""}<span class="mch" aria-hidden="true">›</span></summary>${body}</details>`;
const fact = (k, v) => `<div class="fact"><dt>${k}</dt><dd>${v || `<span class="muted">${t("没填")}</span>`}</dd></div>`;

function basicBody(p) {
  const owner = amOwner(), devs = devicesOf(p.id), role = roleOf(p), fin = devs.some((d) => d.role === "owner" || d.can_finance === true);
  if (F.edit !== "basic") return `<dl class="fact-grid one">${fact(t("名字"), esc(p.name))}${fact(t("类别"), esc(t(PEOPLE_KINDS[p.kind] || p.kind)))}${p.kind !== "pet" ? fact(t("性别"), p.gender ? t(p.gender === "male" ? "男" : "女") : "") : ""}${fact(t("生日"), p.birth ? esc(fmtDate(p.birth)) : "")}
      ${fact(t("电话"), p.phone ? `<a href="tel:${esc(p.phone.replace(/[^\d+]/g, ""))}">${esc(p.phone)}</a>` : "")}${fact(t("邮箱"), p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : "")}${fact(t("地址"), p.address ? `<span class="mem-addr">${esc(p.address)}</span>` : "")}
      ${role ? fact(t("角色"), role === "owner" ? t("家主") : t("家庭成员")) : ""}${role && owner ? fact(t("财务权限"), fin ? t("有") : t("没有")) : ""}</dl>
      <p class="muted mem-note">🔒 ${t("电话、邮箱、地址只给本家庭的成员看；不会发给 AI，也不会放进备份或导出。")}</p>`;
  const sel = (name, cur, opts) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${v}" ${cur === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  return `<form id="personForm" data-id="${esc(p.id)}" novalidate><div class="form-grid">
      <label>${t("名字")}<input name="name" required maxlength="40" value="${esc(p.name)}"></label>
      <label>${t("类别")}${sel("kind", p.kind || "adult", Object.entries(PEOPLE_KINDS).map(([k, n]) => [k, t(n)]))}</label>
      <label>${t("性别")}${sel("gender", p.gender || "", [["", t("不填")], ["male", t("男")], ["female", t("女")]])}</label>
      <label>${t("生日")}<input name="birth" type="date" value="${esc(p.birth || "")}"></label>
      <label>${t("电话")}<input name="phone" type="tel" inputmode="tel" maxlength="40" value="${esc(p.phone || "")}"></label>
      <label>${t("邮箱")}<input name="email" type="email" maxlength="120" value="${esc(p.email || "")}"></label>
      <label class="span-2">${t("地址")}<textarea name="address" rows="2" maxlength="300">${esc(p.address || "")}</textarea></label>
      ${owner && devs.length ? `<label>${t("角色")}${sel("role", role, [["member", t("家庭成员")], ["owner", t("家主")]])}</label>
        <label>${t("财务权限")}${sel("finance", fin ? "1" : "0", [["0", t("没有")], ["1", t("有")]])}<small>${t("家主恒有财务权限。")}</small></label>` : ""}
    </div><p id="personErr" class="form-error" role="alert"></p>
    <div class="form-actions form-actions-split"><button type="button" class="btn btn-ghost" data-fam-edit="basic">${t("取消")}</button><button type="submit" class="btn btn-primary">${t("保存")}</button></div></form>`;
}

function deviceRow(m, p, editing) {
  const mine = m.user_id === meId(), last = lastLoginOf([m.user_id]), canRemove = !mine && (amOwner() || (p && p.id === myPersonOf()));
  const opts = adultPeople().map((x) => `<option value="${esc(x.id)}" ${x.id === m.person_id ? "selected" : ""}>${esc(x.name)}</option>`).join("");
  const open = F.devOpen === m.user_id;
  const hist = open ? `<ul class="restock-list login-list">${(L.rows.filter((e) => e.user_id === m.user_id).slice(0, 20).map((e) => loginRowHtml(e, personNameOf)).join("")) || `<li class="muted">${t("没有登录记录")}</li>`}</ul>` : "";
  return `<li class="dev-card"><div class="dev-row"><span class="login-ico" aria-hidden="true">${DEVICE_ICON[last?.device] || "📱"}</span>
      <div class="grow"><b>${esc(m.display_name)}</b>${mine ? ` <span class="badge b-ok">📍 ${t("这是你的设备")}</span>` : ""}${m.role === "owner" ? ` <span class="badge mem-b">${t("家主")}</span>` : ""}
        <small class="login-meta">${last ? `${esc(fmtDateTime(last.at))} · ${esc(deviceText(last.device))} · ${esc(last.browser || "")}${last.location ? ` · 🌐 ${esc(last.location)}` : ""}${last.ip ? ` · IP ${esc(last.ip)}` : ""}` : t("还没有登录记录（这台设备打开新版本后才开始记）")}</small></div>
      <div class="dev-acts"><button type="button" class="btn btn-sm btn-ghost" data-action="dev-detail" data-id="${esc(m.user_id)}" aria-expanded="${open}">${t("详情")}</button>
        ${editing && canRemove ? `<button type="button" class="btn btn-sm btn-danger-ghost" data-action="member-remove" data-id="${esc(m.user_id)}">${t("移除")}</button>` : ""}
        ${editing && mine && !demo() ? `<button type="button" class="btn btn-sm btn-ghost" data-action="logout">${t("退出")}</button>` : ""}</div></div>
    ${editing && (amOwner() || mine || (p && p.id === myPersonOf())) ? `<label class="dev-link">${t("属于哪位家庭成员")}<select data-link-person="${esc(m.user_id)}"><option value="">${t("（还没链接）")}</option>${opts}</select></label>` : ""}${hist}</li>`;
}
function devicesBody(p) {
  const editing = F.edit === "devices", own = devicesOf(p.id), unlinked = amOwner() ? famMembers().filter((m) => !m.person_id) : [];
  const shown = own.slice(0, F.devShow);
  return `${own.length ? `<ul class="dev-list">${shown.map((m) => deviceRow(m, p, editing)).join("")}</ul>` : `<p class="muted">${t("这位家庭成员还没有链接任何登录设备。")}</p>`}
    ${own.length > F.devShow ? `<div class="form-actions"><button type="button" class="btn btn-sm btn-ghost" data-action="dev-more">${t("加载更多")}</button></div>` : ""}
    ${unlinked.length ? `<h4 class="fam-sub">${t("还没链接家庭成员的设备")}</h4><ul class="dev-list">${unlinked.map((m) => deviceRow(m, null, true)).join("")}</ul>` : ""}
    <p class="muted mem-note">${editing ? t("“移除”= 把那台设备从家庭里移出，等于从它上面登出；它下次打开要重新用邮箱或邀请码登录。") : amOwner() ? t("家主能管理全部设备；点“编辑”可以改设备属于谁、移除可疑设备。") : t("这里是你名下的设备；点“编辑”可以移除不用的设备。")}</p>`;
}
function logsBody(p) {
  ensureLogins();
  const devs = devicesOf(p.id).map((d) => d.user_id), all = amOwner() && F.scopeAll, rows = loginWindow(all ? null : devs), more = loginHasMore(all ? null : devs);
  const scope = amOwner() ? `<div class="chips fam-scope" role="group" aria-label="${esc(t("范围"))}"><button type="button" class="chip" aria-pressed="${!all}" data-action="logs-scope" data-all="0">${t("只看 {n}", { n: esc(p.name) })}</button><button type="button" class="chip" aria-pressed="${all}" data-action="logs-scope" data-all="1">${t("全家")}</button></div>` : "";
  return `${scope}<p class="muted mem-note" style="margin-top:0">${t("最近 {d} 天；出现没见过的设备或网络会标“可疑”，并在“注意事项”里提醒。", { d: L.days })}</p>
    ${!L.loaded ? `<p class="muted" role="status">${t("加载中…")}</p>` : rows.length ? `<ul class="restock-list login-list">${rows.map((e) => loginRowHtml(e, personNameOf)).join("")}</ul>` : `<div class="empty"><strong>${t("这段时间没有登录记录")}</strong></div>`}
    ${more ? `<div class="form-actions"><button type="button" class="btn btn-sm btn-ghost" data-action="logins-more">${t("加载更多（再往前 6 天）")}</button></div>` : ""}
    ${amOwner() && L.bad.length ? `<details class="login-help" open><summary>${t("不是我们家人登录的？怎么办")}</summary><ol class="muted"><li>${t("在上面“登录设备”里点“编辑”，把可疑的设备“移除”")}</li><li>${t("回到家庭与成员页，点“重新生成”换一个邀请码，旧邀请码立刻作废")}</li><li>${t("检查登录用的邮箱 / 手机号有没有被别人动过，必要时改密码或开启两步验证")}</li></ol></details>` : ""}`;
}

export function personPage(id) {
  if (id === "new") return amOwner() ? newPersonPage() : `<div class="panel empty"><strong>${t("只有家主能添加家庭成员")}</strong><p><a class="btn" href="${familyHref()}">${t("回家庭与成员")}</a></p></div>`;
  const p = state.people.find((x) => x.id === id);
  if (!p || !personOk(p)) return `<div class="panel empty"><strong>${t("没有找到这位家庭成员")}</strong><p><a class="btn" href="${familyHref()}">${t("回家庭与成员")}</a></p></div>`;
  const owner = amOwner(), hasDev = devicesOf(p.id).length > 0 || (owner && famMembers().some((m) => !m.person_id));
  const head = `<div class="panel mem-head"><span class="fam-av lg" aria-hidden="true">${avatarOf(p)}</span><div class="mem-head-t"><h2>${esc(p.name)}</h2><div class="mem-badges">${badgesOf(p)}</div></div></div>`;
  const danger = owner && p.id !== myPersonOf() && !devicesOf(p.id).length ? `<div class="panel mem-danger"><h3 class="mem-h">${t("危险操作")}</h3><div class="mem-perm"><div class="grow"><b>${t("删除这位家庭成员")}</b><div class="muted">${t("相关账单里的名字会保留，但不再关联到这个人。")}</div></div>
      <button type="button" class="btn btn-sm btn-danger-ghost" data-action="person-del-page" data-id="${esc(p.id)}">${t("删除")}</button></div></div>` : "";
  return `<div class="mem-profile">${head}
    ${sec("basic", "🪪", t("基本资料"), basicBody(p), { edit: true })}
    ${p.kind !== "pet" && hasDev ? sec("devices", "📱", t("登录设备"), devicesBody(p), { edit: true, count: t("{n} 台", { n: devicesOf(p.id).length }) }) : ""}
    ${p.kind !== "pet" && hasDev ? sec("logs", "🕘", t("登录记录"), logsBody(p)) : ""}${danger}</div>`;
}

/** 新建家庭成员：基本资料表单页（取消在左、保存在右） */
function newPersonPage() {
  const sel = (name, opts) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select>`;
  return `<div class="mem-profile"><section class="panel prof-card"><div class="prof-head"><span class="mi" aria-hidden="true">🪪</span><div class="prof-t"><h3>${t("添加家庭成员")}</h3></div></div>
    <form id="personForm" data-id="" novalidate><div class="form-grid">
      <label>${t("名字")}<input name="name" required maxlength="40" autocomplete="off"></label>
      <label>${t("类别")}${sel("kind", Object.entries(PEOPLE_KINDS).map(([k, n]) => [k, t(n)]))}</label>
      <label>${t("性别")}${sel("gender", [["", t("不填")], ["male", t("男")], ["female", t("女")]])}</label>
      <label>${t("生日")}<input name="birth" type="date"></label>
      <label>${t("电话")}<input name="phone" type="tel" inputmode="tel" maxlength="40"></label>
      <label>${t("邮箱")}<input name="email" type="email" maxlength="120"></label>
      <label class="span-2">${t("地址")}<textarea name="address" rows="2" maxlength="300"></textarea></label>
    </div><p id="personErr" class="form-error" role="alert"></p>
    <div class="form-actions form-actions-split"><button type="button" class="btn btn-ghost" data-action="person-new-cancel">${t("取消")}</button><button type="submit" class="btn btn-primary">${t("保存")}</button></div></form></section></div>`;
}

/* ── 事件：块的编辑 / 折叠 / 设备详情 / 范围 / 保存 ── */
const rerender = () => window.dispatchEvent(new HashChangeEvent("hashchange"));
document.addEventListener("click", async (e) => {
  const card = e.target.closest(".fam-card[data-href]");
  if (card && !e.target.closest("a, button, select, input, .act-more, .person-merge")) { location.hash = card.dataset.href; return; }
  const ed = e.target.closest("[data-fam-edit]");
  if (ed) { e.preventDefault(); const id = ed.dataset.famEdit; F.edit = F.edit === id ? null : id; rerender(); return; }
  const a = e.target.closest("[data-action]")?.dataset; if (!a) return;
  if (a.action === "dev-detail") { F.devOpen = F.devOpen === a.id ? null : a.id; rerender(); }
  else if (a.action === "dev-more") { F.devShow += 6; rerender(); }
  else if (a.action === "logs-scope") { F.scopeAll = a.all === "1"; rerender(); }
});
export const resetFamilyUi = () => { F.edit = null; F.devShow = 6; F.devOpen = null; F.scopeAll = false; };

const val = (f, n) => (f.elements[n] ? f.elements[n].value.trim() : "");
/** 保存基本资料：人的资料 + （家主）角色和财务权限施加到这位成员名下的每台设备 */
export async function savePersonForm(f) {
  const err = $("#personErr"), fail = (m) => { if (err) err.textContent = m; return false; };
  const p = f.dataset.id ? state.people.find((x) => x.id === f.dataset.id) : {}; if (!p) return false;
  const row = { ...p, name: val(f, "name"), kind: val(f, "kind") || "adult", gender: val(f, "gender") || null, birth: val(f, "birth") || null, phone: val(f, "phone") || null, email: val(f, "email") || null, address: val(f, "address") || null };
  if (!row.name) return fail(t("请填名字。"));
  if (row.phone && !/^[0-9+() .#*/xX-]{1,40}$/.test(row.phone)) return fail(t("电话只能有数字、空格和 + - ( ) 等符号"));
  if (row.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) return fail(t("邮箱格式不对"));
  const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
  try {
    await Store.savePerson(row);
    if (!f.dataset.id) { state.people = await Store.listPeople(); toast(t("已添加 {name}", { name: row.name })); return true; }
    if (amOwner() && f.elements.role) {
      const role = f.elements.role.value, fin = f.elements.finance.value === "1";
      for (const d of devicesOf(p.id)) {
        if (d.role !== role) await Store.setMemberRole(d.user_id, role);
        if (role !== "owner" && (d.can_finance === true) !== fin) await Store.setMemberFinance(d.user_id, fin);
      }
    }
    state.people = await Store.listPeople(); await reloadMembers(); F.edit = null; toast(t("已保存"));
    return true;
  } catch (e) { btn.disabled = false; return fail(t("保存失败：{msg}", { msg: e.message })); }
}

/** 把一个人移出家庭：移出名下所有设备（等于从那些设备登出），再删掉这个人（账单里的名字保留，只是不再关联）；最后一位家主的设备移不掉，会提示 */
export async function removePerson(id) {
  const p = state.people.find((x) => x.id === id); if (!p) return;
  const devs = devicesOf(id);
  if (!window.confirm(t("把「{n}」移出家庭？{d}相关账单里的名字会保留，但不再关联到这个人。", { n: p.name, d: devs.length ? t("名下 {c} 台设备会被移出，下次打开要重新登录。", { c: devs.length }) : "" }))) return;
  try {
    for (const d of devs) await Store.removeMember(d.user_id);
    await Store.deletePerson(id);
    state.people = await Store.listPeople(); await reloadMembers(); toast(t("已移出 {name}", { name: p.name }));
  } catch (e) { await reloadMembers(); state.people = await Store.listPeople(); toast(t("操作失败：{msg}", { msg: e.message })); }
}
