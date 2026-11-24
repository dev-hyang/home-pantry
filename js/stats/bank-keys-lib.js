/* 对账单导入指纹的纯函数（不碰页面 / 数据库，方便测试）；说明见 bank-keys.js */
/** 18 位小写字母数字哈希（两个 32 位 FNV 变体拼起来；不是加密用途，只要同一输入永远得到同一输出、不同输入几乎不撞） */
export function hashKey(s) {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193) >>> 0; b = Math.imul(b + c + i, 0x85ebca6b) >>> 0; b = (b ^ (b >>> 13)) >>> 0; }
  const h = (n) => n.toString(36).padStart(7, "0").slice(-7);
  return `${h(a)}${h(b)}${h((a ^ b) >>> 0)}`.slice(0, 18);
}
/** 账户身份：尾号优先，其次 id，没选账户为空 */
export const acctKeyOf = (account) => (!account || account.mode === "none" ? "" : String(account.last4 || "").trim() || (account.mode === "id" ? String(account.id) : ""));
/** 一行的指纹：fk = 「日期|金额|描述#序号」（bank-rows 里已经按同一天同描述同金额编了序号） */
export const importKeyOf = (acctKey, fk) => hashKey(`${acctKey}¦${fk}`);

