/* 云端模式（Supabase）的数据读写：家庭成员、名册、邀请、登录记录。 */
import { PROFILE_COLS, personError } from "../store.js";
import { state } from "../state.js";
import { t } from "../i18n.js";

export const cloudPeople = {
  /* 家庭成员 / 孩子 / 宠物名册（迁移 029）：同一个家庭里“看起来一样”的名字由数据库唯一索引拦住 */
  async listPeople() { return this.must(await this.sb.from("household_people").select("*").eq("household_id", this.hid).order("created_at")); },
  async savePerson(p) {
    const row = { name: String(p.name).trim().slice(0, 40), kind: p.kind || "adult", birth: p.birth || null, gender: p.gender || null, phone: p.phone || null, email: p.email || null, address: p.address || null, member_user_id: p.member_user_id || null, household_id: this.hid };
    if (p.id) { const { error } = await this.sb.from("household_people").update(row).eq("id", p.id); if (error) throw new Error(personError(error)); return p.id; }
    const { data, error } = await this.sb.from("household_people").insert(row).select("id").single(); if (error) throw new Error(personError(error)); return data.id;
  },
  async deletePerson(id) { this.must(await this.sb.from("household_people").delete().eq("id", id)); },   // 账单里的 patient_id 自动置空，名字文字仍保留
  async mergePeople(fromId, toId) {
    this.must(await this.sb.from("bills_one_time").update({ patient_id: toId }).eq("patient_id", fromId));
    this.must(await this.sb.from("bills_one_time").update({ guarantor_id: toId }).eq("guarantor_id", fromId));
    this.must(await this.sb.from("household_people").delete().eq("id", fromId));
  },
  async listMembers() {   // 只列正式成员（迁移 049 起新加入的人先是「待批准」）；没执行 049 时没有 status 列，退回原来的读法
    const base = "user_id,display_name,role,joined_at,person_id";   // person_id：这台设备属于哪位家庭成员（迁移 084）；没读回来界面就会一直显示「还没链接」
    const q = (cols, active) => { let b = this.sb.from("household_members").select(cols).eq("household_id", this.hid); if (active) b = b.eq("status", "active"); return b.order("joined_at"); };
    let r = await q(`${base},can_finance,finance_requested_at,finance_request_note,${PROFILE_COLS}`, true);   // finance_requested_at / finance_request_note：财务权限申请（迁移 105）
    if (r.error && /finance_request/i.test(r.error.message)) r = await q(`${base},can_finance,${PROFILE_COLS}`, true);
    if (r.error && /person_id/i.test(r.error.message)) { const b0 = base.replace(",person_id", ""); r = await q(`${b0},can_finance,${PROFILE_COLS}`, true); }   // 还没执行迁移 084   // 电话 / 邮箱 / 地址：成员资料（迁移 052）
    state.noProfileCols = !!(r.error && /phone|email|address|can_finance|status|does not exist|schema cache/i.test(r.error.message));
    if (state.noProfileCols) r = await q(`${base},can_finance`, true);   // 没执行 052：资料字段在界面上灰掉，提示先执行迁移
    if (r.error && /can_finance/i.test(r.error.message)) r = await q(base, true);   // can_finance：财务权限（迁移 050）；没执行 050：普通成员按「没有财务权限」处理
    if (r.error && /status/i.test(r.error.message)) r = await q(base, false);
    return this.must(r);
  },
  /** 家主给某位成员开 / 关财务权限（security definer RPC，迁移 050） */
  async setMemberFinance(userId, on) {
    const r = await this.sb.rpc("set_member_finance", { p_household: this.hid, p_user: userId, p_on: !!on });
    if (r.error && /set_member_finance|could not find the function|schema cache/i.test(r.error.message || "")) throw new Error(t("数据库还没升级：请先执行 migrations/050_finance_access.sql"));
    this.must(r);
  },
  /** 等家主批准的加入申请（读不到 = 没有） */
  async listPendingMembers() {
    const r = await this.sb.from("household_members").select("user_id,display_name,joined_at,join_note,finance_requested_at").eq("household_id", this.hid).eq("status", "pending").order("joined_at");   // join_note / finance_requested_at：迁移 105
    if (r.error && /join_note|finance_requested_at/i.test(r.error.message)) { const r2 = await this.sb.from("household_members").select("user_id,display_name,joined_at").eq("household_id", this.hid).eq("status", "pending").order("joined_at"); return r2.error ? [] : r2.data; }
    return r.error ? [] : r.data;
  },
  async approveMember(userId, { finance = false, person = null } = {}) { this.must(await this.sb.rpc("approve_member", { p_household: this.hid, p_user: userId, p_finance: !!finance, p_person: person || null })); },
  /* 财务权限申请（迁移 105）：成员申请 / 撤回 / 关掉自己的；家主同意 / 拒绝 */
  async requestFinance(note) { this.must(await this.sb.rpc("request_finance", { p_household: this.hid, p_note: note || null })); },
  async cancelFinanceRequest() { this.must(await this.sb.rpc("cancel_finance_request", { p_household: this.hid })); },
  async disableMyFinance() { this.must(await this.sb.rpc("disable_my_finance", { p_household: this.hid })); },
  async decideFinanceRequest(userId, approve) { this.must(await this.sb.rpc("decide_finance_request", { p_household: this.hid, p_user: userId, p_approve: !!approve })); },
  async closeInvite() { this.must(await this.sb.rpc("close_invite", { p_household: this.hid })); },
  /* 家主管理（security definer RPC，见 migrations/004、005） */
  async setMemberRole(userId, role) { this.must(await this.sb.rpc("set_member_role", { p_household: this.hid, p_user: userId, p_role: role })); },
  async removeMember(userId) { this.must(await this.sb.rpc("remove_member", { p_household: this.hid, p_user: userId })); },
  /* 登录记录（迁移 086）：只有云端有；没执行迁移时读不到，按没有记录处理 */
  async recordLogin({ device, os, browser, ua }) { return this.must(await this.sb.rpc("record_login", { p_household: this.hid, p_device: device, p_os: os, p_browser: browser, p_ua: ua })); },
  async listLogins(sinceIso) { const r = await this.sb.from("login_events").select("*").eq("household_id", this.hid).gte("at", sinceIso).order("at", { ascending: false }).limit(500); if (r.error) throw new Error(r.error.message); return r.data; },
  async listSuspiciousLogins() { const since = new Date(Date.now() - 30 * 864e5).toISOString(); const r = await this.sb.from("login_events").select("*").eq("household_id", this.hid).is("acked_at", null).or("new_device.eq.true,new_ip.eq.true").gte("at", since).order("at", { ascending: false }).limit(50); if (r.error) throw new Error(r.error.message); return r.data; },
  async ackLogin(id) { this.must(await this.sb.rpc("ack_login", { p_event: id })); },
  async setMemberPerson(userId, personId) { this.must(await this.sb.rpc("set_member_person", { p_household: this.hid, p_user: userId, p_person: personId })); },   // 设备 ↔ 家庭成员（迁移 084）
  async setMemberName(userId, name) { this.must(await this.sb.rpc("set_member_name", { p_household: this.hid, p_user: userId, p_name: name })); },
  /** 改成员资料（称呼 + 电话 / 邮箱 / 地址）：本人改自己的、家主改任何人的，数据库函数里校验（迁移 052）。没执行 052 时只改称呼（迁移 005 的 set_member_name） */
  async setMemberProfile(userId, p) {
    if (state.noProfileCols) return this.setMemberName(userId, p.display_name);
    const r = await this.sb.rpc("set_member_profile", { p_household: this.hid, p_user: userId, p_name: p.display_name, p_phone: p.phone || null, p_email: p.email || null, p_address: p.address || null });
    if (r.error && /set_member_profile|could not find the function|schema cache/i.test(r.error.message || "")) throw new Error(t("数据库还没升级：请先执行 migrations/052_member_profile.sql"));
    this.must(r);
  },
};
