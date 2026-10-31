/* 设置 → 家庭与成员：成员列表（一人一行）+ 成员资料页 #/me/settings?sec=family&member=<user_id>
 * 谁能做什么（数据库同样强制，见 migrations/050、052）：
 *   · 家主：看、改所有人的资料；开关财务权限、设 / 取消家主、移出家庭（不能对自己操作，最后一位家主不能被取消或移出）。
 *   · 普通成员：改自己的资料；别人的只能看，没有任何开关。
 * 隐私：电话、邮箱、地址是个人数据，只在这两页显示；不进 AI 提示词、不进备份 / 导出（backup.js 只带 user_id 和称呼）。 */
import { state } from "../core/state.js";
import { CloudStore, DemoStore, Store } from "../core/store.js";
import { esc, fmtShort } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";

const demo = () => Store.mode === "demo";
/** 当前家庭的正式成员（演示模式读本机演示库，不动 state.members） */
export const famMembers = () => (demo() ? DemoStore.members() : state.members || []);
export const meId = () => (demo() ? "me" : state.user?.id);
export const amOwner = () => famMembers().some((m) => m.user_id === meId() && m.role === "owner");
/** 改动之后重读成员（云端）；演示模式直接读本机库，不用重读 */
export async function reloadMembers() { if (!demo()) state.members = await CloudStore.listMembers(); }
/** 没执行迁移 052：资料字段灰掉（演示模式总是可用） */
const noCols = () => !demo() && !!state.noProfileCols;

export const memberHref = (id) => `${href("me", "settings")}?sec=family&member=${encodeURIComponent(id)}`;
export const familyHref = () => `${href("me", "settings")}?sec=family`;
const canEdit = (m) => amOwner() || m.user_id === meId();

/** 头像：称呼的第一个字（emoji / 汉字 / 字母都按一个字算）；颜色按 user_id 固定，同一个人每次一样 */
const AV_TONES = 5;
const tone = (id) => [...String(id || "")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % AV_TONES;
const avatar = (m, cls = "") => `<span class="mem-av tone-${tone(m.user_id)} ${cls}" aria-hidden="true">${esc([...(m.display_name || "?").trim()][0] || "?")}</span>`;

/** 小标签：家主 / 成员、财务、我 */
function badges(m) {
  const isO = m.role === "owner";
  return [
    isO ? `<span class="badge b-ok">${t("家主")}</span>` : `<span class="badge mem-b">${t("成员")}</span>`,
    !isO && m.can_finance === true ? `<span class="badge mem-b-fin" title="${esc(t("能看、能改对账单、收入、预算和用卡"))}">💰 ${t("财务")}</span>` : "",
    m.user_id === meId() ? `<span class="badge mem-b">${t("我")}</span>` : "",
  ].filter(Boolean).join(" ");
}

/** 成员列表：一人一行，点进去是资料页；按钮都在资料页里 */
export function membersList() {
  const list = famMembers();
  if (!list.length) return `<p class="muted">${t("还没有成员")}</p>`;
  return `<div class="mlist mem-list">${list.map((m) => {
    const edit = canEdit(m), label = edit ? t("编辑") : t("查看");
    return `<a class="mrow mem-row" href="${memberHref(m.user_id)}" aria-label="${esc(`${m.display_name} · ${label}`)}">
      ${avatar(m)}
      <span class="mt"><b>${esc(m.display_name)}</b><span class="mem-badges">${badges(m)}${m.joined_at ? `<small>${t("{d} 加入", { d: fmtShort(m.joined_at) })}</small>` : ""}</span></span>
      <span class="mem-go">${label}<span class="mch" aria-hidden="true">›</span></span></a>`;
  }).join("")}</div>`;
}

/** 面包屑最后一项：成员称呼 */
export const memberCrumbLabel = (id) => famMembers().find((m) => m.user_id === id)?.display_name || t("成员");

const factRow = (k, v) => `<div class="fact"><dt>${k}</dt><dd>${v || `<span class="muted">${t("没填")}</span>`}</dd></div>`;
const telHref = (s) => `tel:${String(s).replace(/[^0-9+]/g, "")}`;

/** 成员资料页：能改的人看到表单，其余只读；家主对别人另有「权限」和「危险操作」两块 */
export function viewMemberProfile(id) {
  const list = famMembers(), m = list.find((x) => x.user_id === id);
  if (!m) return `<div class="panel empty"><strong>${t("没有找到这位成员")}</strong>${t("可能已经被移出家庭。")}<p><a class="btn" href="${familyHref()}">${t("回家庭与成员")}</a></p></div>`;
  const self = m.user_id === meId(), owner = amOwner(), isO = m.role === "owner", edit = canEdit(m), off = noCols();
  const owners = list.filter((x) => x.role === "owner").length;
  const head = `<div class="panel mem-head">${avatar(m, "lg")}
    <div class="mem-head-t"><h2>${esc(m.display_name)}</h2><div class="mem-badges">${badges(m)}</div>
      ${m.joined_at ? `<small class="muted">${t("{d} 加入", { d: fmtShort(m.joined_at) })}</small>` : ""}</div></div>`;
  const privacy = `<p class="muted mem-note">🔒 ${t("电话、邮箱、地址只给本家庭的成员看；不会发给 AI，也不会放进备份或导出。")}</p>`;

  const dis = off ? "disabled" : "";
  const info = edit ? `<form id="memberForm" class="panel" data-id="${esc(m.user_id)}" novalidate>
      <h3 class="mem-h">${t("资料")}</h3>
      <div class="form-grid">
        <label>${t("称呼")}<input name="display_name" required maxlength="20" autocomplete="nickname" value="${esc(m.display_name)}"></label>
        <label>${t("电话")}<input name="phone" type="tel" inputmode="tel" maxlength="40" autocomplete="${self ? "tel" : "off"}" value="${esc(m.phone || "")}" ${dis}></label>
        <label class="mem-wide">${t("邮箱")}<input name="email" type="email" maxlength="120" autocomplete="${self ? "email" : "off"}" value="${esc(m.email || "")}" ${dis}></label>
        <label class="mem-wide">${t("地址")}<textarea name="address" rows="2" maxlength="300" autocomplete="${self ? "street-address" : "off"}" ${dis}>${esc(m.address || "")}</textarea></label>
      </div>
      ${off ? `<p class="hint mem-mig">⚠️ ${t("需要先执行迁移 052（supabase/migrations/052_member_profile.sql）才能保存电话、邮箱和地址；现在只能改称呼。")}</p>` : ""}
      <p class="form-error" id="memberErr" role="alert"></p>
      ${privacy}
      <div class="form-actions"><button class="btn btn-primary" type="submit">${t("保存")}</button><a class="btn btn-ghost" href="${familyHref()}">${t("取消")}</a></div>
    </form>`
    : `<div class="panel"><h3 class="mem-h">${t("资料")}</h3>
      <dl class="fact-grid one">
        ${factRow(t("称呼"), esc(m.display_name))}
        ${factRow(t("电话"), m.phone ? `<a href="${esc(telHref(m.phone))}">${esc(m.phone)}</a>` : "")}
        ${factRow(t("邮箱"), m.email ? `<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : "")}
        ${factRow(t("地址"), m.address ? `<span class="mem-addr">${esc(m.address)}</span>` : "")}
      </dl>
      ${off ? `<p class="hint mem-mig">${t("需要先执行迁移 052 才能填写电话、邮箱和地址。")}</p>` : ""}
      <p class="muted mem-note">${t("只有本人和家主能修改。")}</p>
      ${privacy}</div>`;

  // 家主对别人：权限（财务开关、家主角色）
  const fin = !isO && m.can_finance === true;
  const perms = owner && !self ? `<div class="panel"><h3 class="mem-h">${t("权限")}</h3>
      <div class="mem-perm">
        <div class="grow"><b>💰 ${t("财务权限")}</b><div class="muted">${isO ? t("家主恒有财务权限。") : t("对账单、收入、预算：能看能改；用卡：能改。关闭时只能看用卡、照常记花费。")}</div></div>
        ${isO ? `<span class="badge b-ok">${t("已开")}</span>` : `<button type="button" class="tgl" role="switch" aria-checked="${fin}" aria-label="${esc(t("财务权限"))}" data-action="member-finance" data-id="${esc(m.user_id)}" data-on="${fin ? "0" : "1"}"><span class="tgl-knob" aria-hidden="true"></span></button><span class="tgl-state" aria-hidden="true">${fin ? t("已开") : t("未开")}</span>`}
      </div>
      <div class="mem-perm">
        <div class="grow"><b>👑 ${t("家主")}</b><div class="muted">${t("家主能批准加入、管理成员和邀请码，恒有财务权限。可以有多位家主。")}</div></div>
        ${isO ? (owners > 1 ? `<button type="button" class="btn btn-sm btn-ghost" data-action="member-role" data-id="${esc(m.user_id)}" data-role="member">${t("取消家主")}</button>` : `<small class="muted">${t("最后一位家主")}</small>`)
              : `<button type="button" class="btn btn-sm" data-action="member-role" data-id="${esc(m.user_id)}" data-role="owner">${t("设为家主")}</button>`}
      </div></div>` : "";

  // 危险操作放最后，单独一块
  const danger = owner && !self && (!isO || owners > 1) ? `<div class="panel mem-danger"><h3 class="mem-h">${t("危险操作")}</h3>
      <div class="mem-perm"><div class="grow"><b>${t("移出家庭")}</b><div class="muted">${t("对方会立刻看不到家里的数据；以后要回来，得重新用邀请码申请、再由家主批准。")}</div></div>
        <button type="button" class="btn btn-sm btn-danger-ghost" data-action="member-remove" data-id="${esc(m.user_id)}">${t("移出家庭")}</button></div></div>` : "";

  const selfNote = self && !owner ? `<p class="muted mem-note">${t("角色和财务权限由家主设置。")}</p>` : "";
  return `<div class="mem-profile">${head}${info}${perms}${danger}${selfNote}</div>`;
}

/** 读资料表单（去掉首尾空格；空的存 null） */
export function readMemberForm(f) {
  const v = (n) => (f.elements[n] && !f.elements[n].disabled ? f.elements[n].value.trim() : "");
  const m = famMembers().find((x) => x.user_id === f.dataset.id) || {};
  const out = { display_name: v("display_name"), phone: v("phone") || null, email: v("email") || null, address: v("address") || null };
  if (noCols()) Object.assign(out, { phone: m.phone ?? null, email: m.email ?? null, address: m.address ?? null });
  if (!out.display_name) throw new Error(t("请填写称呼。"));
  if (out.display_name.length > 20) throw new Error(t("称呼要 1–20 个字"));
  if (out.phone && !/^[0-9+() .#*/xX-]{1,40}$/.test(out.phone)) throw new Error(t("电话只能有数字、空格和 + - ( ) 等符号"));
  if (out.email && (out.email.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out.email))) throw new Error(t("邮箱格式不对"));
  if (out.address && out.address.length > 300) throw new Error(t("地址太长了（最多 300 字）"));
  return out;
}
/** 数据库函数（迁移 052）报的英文错误换成界面文案；其余原样 */
export function profileErr(msg) {
  const m = String(msg || "");
  if (/only an owner can (edit|rename) other members/i.test(m)) return t("只有家主能改别人的资料");
  if (/invalid email/i.test(m)) return t("邮箱格式不对");
  if (/invalid phone/i.test(m)) return t("电话只能有数字、空格和 + - ( ) 等符号");
  if (/name must be/i.test(m)) return t("称呼要 1–20 个字");
  if (/address too long/i.test(m)) return t("地址太长了（最多 300 字）");
  if (/member not found/i.test(m)) return t("没有找到这位成员");
  return m;
}
