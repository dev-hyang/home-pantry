/* 家庭分摊 · 纯逻辑（Node 测试也引用）：参与者 = 家庭成员（人）；一个人几台设备记的账合在一起；
 * 没链接家庭成员的设备各算一个参与者。占比键 = 家庭成员 id；旧的键是设备 id（按设备存的），读的时候还认。 */
const num = (v) => (Number.isFinite(+v) ? +v : 0);
const r2 = (v) => Math.round(v * 100) / 100;

/** people = 大人名册；members = 设备（带 person_id）；返回 [{ key, name, userIds }] */
export function splitParts(people, members) {
  const adults = people.filter((p) => (p.kind || "adult") === "adult").map((p) => ({ key: p.id, name: p.name, userIds: members.filter((m) => m.person_id === p.id).map((m) => m.user_id) })).filter((x) => x.userIds.length);
  const loose = members.filter((m) => !m.person_id).map((m) => ({ key: `dev:${m.user_id}`, name: m.display_name, userIds: [m.user_id] }));
  return [...adults, ...loose];
}
/** 某位参与者的占比（没设过 = 平分；设过家庭成员 id 的优先，其次旧的设备 id） */
export function splitWeight(w, part, n) {
  if (w[part.key] != null && w[part.key] !== "") return num(w[part.key]);
  const old = part.userIds.map((u) => w[u]).find((x) => x != null && x !== "");
  return old != null ? num(old) : 100 / n;
}
/** rows = [{ created_by, sum }]（这个月按记账设备聚合的花费）。返回 { total, net: [{ part, paid, share, net }], moves: [{ from, to, a }] } */
export function splitSettle(parts, w, rows) {
  const isPart = (u) => parts.some((x) => x.userIds.includes(u)), rec = rows.filter((r) => isPart(r.created_by)), total = rec.reduce((s, r) => s + num(r.sum), 0);
  const weight = (x) => splitWeight(w, x, parts.length), wsum = parts.reduce((s, x) => s + weight(x), 0) || 1;
  const net = parts.map((x) => { const paid = rec.filter((r) => x.userIds.includes(r.created_by)).reduce((s, r) => s + num(r.sum), 0), share = (total * weight(x)) / wsum; return { part: x, paid, share, net: r2(paid - share) }; });
  const cred = net.filter((r) => r.net > 0.5).map((r) => ({ ...r })), debt = net.filter((r) => r.net < -0.5).map((r) => ({ ...r })), moves = [];
  for (const d of debt) for (const c of cred) { const a = Math.min(-d.net, c.net); if (a > 0.5) { moves.push({ from: d.part.name, to: c.part.name, a }); d.net += a; c.net -= a; } }
  return { total, net, moves };
}
