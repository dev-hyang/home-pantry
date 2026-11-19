/* 演示模式（数据存在浏览器里）的数据读写：家庭成员、名册、邀请、登录记录。 */
import { personKey } from "../store.js";
import { state } from "../state.js";
import { t } from "../i18n.js";
import { uid } from "../util.js";

export const demoPeople = {
  async listMembers() { return this.members(); },
  demoMember(id) { this.members(); const m = this.db.members.find((x) => x.user_id === id); if (!m) throw new Error(t("没有找到这位成员")); return m; },
  async setMemberProfile(id, p) {
    const name = (p.display_name || "").trim(); if (!name || name.length > 20) throw new Error(t("称呼要 1–20 个字"));
    Object.assign(this.demoMember(id), { display_name: name, phone: p.phone || null, email: p.email || null, address: p.address || null });
    if (id === "me") state.displayName = name;
    this.persist();
  },
  async setMemberFinance(id, on) { this.demoMember(id).can_finance = !!on; this.persist(); },
  async setMemberRole(id, role) {
    const m = this.demoMember(id);
    if (role !== "owner" && m.role === "owner" && this.db.members.filter((x) => x.role === "owner").length < 2) throw new Error(t("最后一位家主不能被取消或移出"));
    m.role = role === "owner" ? "owner" : "member"; this.persist();
  },
  async removeMember(id) {
    const m = this.demoMember(id);
    if (m.role === "owner" && this.db.members.filter((x) => x.role === "owner").length < 2) throw new Error(t("最后一位家主不能被取消或移出"));
    this.db.members = this.db.members.filter((x) => x.user_id !== id); this.persist();
  },
  async listPendingMembers() { return []; },
  /* 家庭成员 / 孩子 / 宠物名册 */
  async listPeople() { return this.db.people.map((x) => ({ ...x })); },
  async savePerson(p) {
    const key = personKey(p.name);
    if (this.db.people.some((x) => x.id !== p.id && personKey(x.name) === key)) throw new Error(t("名册里已经有“{n}”了", { n: p.name }));
    if (p.id) { const i = this.db.people.findIndex((x) => x.id === p.id); if (i >= 0) this.db.people[i] = { ...this.db.people[i], ...p }; this.persist(); return p.id; }
    const id = uid(); this.db.people.push({ ...p, id, created_at: new Date().toISOString() }); this.persist(); return id;
  },
  async deletePerson(id) { this.db.people = this.db.people.filter((x) => x.id !== id); for (const b of this.db.bills_one_time) { if (b.patient_id === id) b.patient_id = null; if (b.guarantor_id === id) b.guarantor_id = null; } this.persist(); },
  async mergePeople(fromId, toId) {
    for (const b of this.db.bills_one_time) { if (b.patient_id === fromId) b.patient_id = toId; if (b.guarantor_id === fromId) b.guarantor_id = toId; }
    this.db.people = this.db.people.filter((x) => x.id !== fromId); this.persist();
  },
};
