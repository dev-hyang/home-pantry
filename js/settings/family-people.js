/* 设置 → 家庭与成员 里的「家庭成员」（人）：家主新建、改名、合并、删除；一个人可以有多台登录设备（household_members.person_id）。
 *   · 家主：看到全部人和全部设备；普通成员：只看到自己（和自己名下的设备）。
 *   · 第一次用一台新设备登录，会问「这台设备是谁？」：选已有的人，或新建；以后换设备登录选同一个人就不会多出一个人。
 *   · 账单「谁负责」、一次性账单的患者、收入 都关联到「人」，不是设备。
 * 数据：名册 household_people（state.people，全家共用），设备 household_members（state.members）。设计见迁移 084 / 085。 */
import { state } from "../core/state.js";
import { CloudStore, DemoStore, Store } from "../core/store.js";
import { $, esc, toast } from "../core/util.js";
import { t } from "../core/i18n.js";
import { PEOPLE_KINDS } from "../bills/medical.js";
import { amOwner, famMembers, meId, reloadMembers } from "./members.js";

const KIND_ICON = { adult: "🧑", child: "👶", pet: "🐾" };
const demo = () => Store.mode === "demo";

export const myMember = () => famMembers().find((m) => m.user_id === meId()) || null;
export const myPersonOf = () => myMember()?.person_id || null;
export const devicesOf = (personId) => famMembers().filter((m) => m.person_id === personId);
export const personNameOf = (id) => state.people.find((p) => p.id === id)?.name || "";
export const adultPeople = () => state.people.filter((p) => (p.kind || "adult") === "adult");
/** 当前人能看到的人：家主全部；本人只有自己 */
export const visiblePeople = () => (amOwner() ? state.people : state.people.filter((p) => p.id === myPersonOf()));
/** 当前人能看到的设备：家主全部；本人只有自己名下的（含这台） */
export const visibleDevices = () => (amOwner() ? famMembers() : famMembers().filter((m) => m.user_id === meId() || (myPersonOf() && m.person_id === myPersonOf())));

/** 把设备链接到某个人（空 = 取消链接）；设备自己或家主可以 */
export async function setDevicePerson(userId, personId) {
  if (demo()) { DemoStore.demoMember(userId).person_id = personId || null; DemoStore.persist(); }
  else await CloudStore.setMemberPerson(userId, personId || null);
  await reloadMembers();
}
/** 新建一个人，返回 id */
export async function createPerson(name, kind = "adult") {
  const id = await Store.savePerson({ name: String(name).trim().slice(0, 40), kind });
  state.people = await Store.listPeople();
  return id || state.people.find((p) => p.name === String(name).trim())?.id;
}

/** 「这台设备是谁？」：这台设备还没链接到任何人时显示（今日页和家庭页顶上）；演示模式不显示 */
export function deviceLinkPrompt() {
  if (demo()) return "";
  const m = myMember(); if (!m || m.person_id) return "";
  const opts = adultPeople().map((p) => `<option value="${esc(p.id)}">${esc(p.name)}${devicesOf(p.id).length ? ` · ${t("{n} 台设备", { n: devicesOf(p.id).length })}` : ""}</option>`).join("");
  return `<section class="panel device-link" role="region" aria-label="${esc(t("这台设备是谁？"))}">
    <h3>📱 ${t("这台设备是谁？")}</h3>
    <p class="muted">${t("选你自己，账单的“谁负责”、收入和医疗账单才会记在同一个人名下；换了新设备再登录，选同一个人就行，不会多出一个人。")}</p>
    ${opts ? `<div class="dl-row"><select id="devLinkPick" aria-label="${esc(t("选择家庭成员"))}"><option value="">${t("选择家庭成员…")}</option>${opts}</select><button type="button" class="btn btn-primary" data-action="device-link">${t("就是我")}</button></div>` : ""}
    <div class="dl-row"><input id="devLinkNew" maxlength="40" placeholder="${esc(t("我是新成员，名字："))}" value="${esc(opts ? "" : m.display_name || "")}" aria-label="${esc(t("新成员的名字"))}"><button type="button" class="btn ${opts ? "btn-ghost" : "btn-primary"}" data-action="device-link-new">${t("新建并链接")}</button></div></section>`;
}
export async function deviceLinkDo() {
  const id = $("#devLinkPick")?.value; if (!id) return toast(t("先选一位家庭成员。"));
  await setDevicePerson(meId(), id); toast(t("已链接"));
}
export async function deviceLinkNew() {
  const name = $("#devLinkNew")?.value.trim(); if (!name) return toast(t("请填名字。"));
  const hit = state.people.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
  if (hit && !window.confirm(t("名册里已经有「{n}」。确定 = 就是这位，链接过去；取消 = 返回。", { n: hit.name }))) return;
  const id = hit ? hit.id : await createPerson(name, "adult");
  await setDevicePerson(meId(), id); toast(t("已链接"));
}

/** 家庭成员（人）面板：每人一行（种类、名字、设备）；家主能改名 / 合并 / 删除 / 添加 */
export function peoplePanel() {
  const owner = amOwner(), list = visiblePeople(), edit = state.personEdit, merging = state.personMerge;
  const used = (id) => (state.medBills || []).filter((b) => b.patient_id === id || b.guarantor_id === id).length;
  const row = (p) => {
    const devs = devicesOf(p.id), info = [devs.length ? `📱 ${devs.map((d) => esc(d.display_name)).join("、")}` : null, used(p.id) ? t("{n} 张一次性账单", { n: used(p.id) }) : null].filter(Boolean).join(" · ");
    return `<li class="person-row" ${owner ? 'data-swipe-del="person"' : ""}>
      <span class="badge" style="background:var(--surface-2)">${KIND_ICON[p.kind] || ""} ${t(PEOPLE_KINDS[p.kind] || p.kind)}</span>
      <div class="person-main">${edit === p.id ? `<input id="personEditName" maxlength="40" value="${esc(p.name)}" aria-label="${esc(t("姓名"))}">` : `<span class="name">${esc(p.name)}</span><small>${info}</small>`}</div>
      ${owner ? `<div class="person-actions">${edit === p.id ? `<button type="button" class="btn btn-sm btn-primary" data-action="person-edit-save" data-id="${p.id}">${t("保存")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="person-edit-cancel">${t("取消")}</button>`
        : `<button type="button" class="btn btn-sm btn-ghost" data-action="person-edit" data-id="${p.id}">${t("改名")}</button>${state.people.length > 1 ? `<button type="button" class="btn btn-sm btn-ghost" data-action="person-merge-open" data-id="${p.id}" aria-expanded="${merging === p.id}">${t("合并")}</button>` : ""}<button type="button" class="btn btn-sm btn-danger-ghost swipe-src" data-action="person-del" data-id="${p.id}">${t("删除")}</button>`}</div>` : ""}
      ${owner && merging === p.id && edit !== p.id ? `<div class="person-merge"><span class="muted">${t("把“{n}”合并到：", { n: esc(p.name) })}</span>
        <select data-merge-for="${p.id}" aria-label="${esc(t("合并到"))}"><option value="">${t("选一个人…")}</option>${state.people.filter((x) => x.id !== p.id).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select>
        <button type="button" class="btn btn-sm btn-primary" data-action="person-merge" data-id="${p.id}">${t("确认合并")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="person-merge-cancel">${t("取消")}</button>
        <small class="muted">${t("它的账单、设备都会归到所选的人名下，然后这一条被删除。")}</small></div>` : ""}</li>`;
  };
  const add = owner ? `<div class="people-add"><h4>${t("添加家庭成员")}</h4>
      <div class="form-grid"><label class="span-2">${t("名字（每行一个）")}<textarea id="peopleBulkNames" rows="2" maxlength="600"></textarea></label>
        <label>${t("类别")}<select id="peopleBulkKind">${Object.entries(PEOPLE_KINDS).map(([k, n]) => `<option value="${k}" ${k === "adult" ? "selected" : ""}>${t(n)}</option>`).join("")}</select></label></div>
      <div class="form-actions"><button type="button" class="btn btn-primary btn-sm" data-action="people-bulk">${t("添加")}</button></div></div>` : "";
  return `<div class="panel"><h3 class="mem-h">${t("家庭成员（{n}）", { n: list.length })}</h3>
      ${list.length ? `<ul class="restock-list">${list.map(row).join("")}</ul>` : `<div class="empty"><strong>${t("还没有家庭成员")}</strong>${t("家主可以在下面添加。")}</div>`}
      <p class="muted mem-note">${owner ? t("一位家庭成员可以有多台登录设备；账单的“谁负责”、一次性账单的患者、收入都关联到这里的人。") : t("你只能看到自己；家主管理全部家庭成员。")}</p>${add}</div>`;
}

/** 设备资料页里的「属于哪位家庭成员」选择（设备自己或家主可改） */
export function devicePersonField(m) {
  const can = amOwner() || m.user_id === meId();
  const opts = state.people.filter((p) => (p.kind || "adult") === "adult").map((p) => `<option value="${esc(p.id)}" ${p.id === m.person_id ? "selected" : ""}>${esc(p.name)}</option>`).join("");
  return `<div class="panel"><h3 class="mem-h">${t("属于哪位家庭成员")}</h3>
    ${can ? `<select data-link-person="${esc(m.user_id)}" aria-label="${esc(t("属于哪位家庭成员"))}"><option value="">${t("（还没链接）")}</option>${opts}</select>` : `<p>${esc(personNameOf(m.person_id) || t("（还没链接）"))}</p>`}
    <p class="muted mem-note">${t("同一个人的几台设备选同一位家庭成员就行，不会多出一个人。")}</p></div>`;
}
