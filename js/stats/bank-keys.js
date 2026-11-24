/* 对账单导入指纹（迁移 109 的 import_key）：同一份对账单的同一行，不管导入几次、中间有没有手动改过，都只进一次。
 *  指纹 = 账户身份 + 这一行的「日期 | 金额 | 描述 # 同一天同描述同金额的第几笔」，取哈希（只有小写字母和数字，18 位）。
 *  账户身份：选了卡 / 账户就用它的尾号（没有尾号用它的 id），没选账户为空——所以第一次没选账户、第二次才选，指纹会变，防重就失效，
 *  导入页会在没选账户时提醒。
 *  已经导入过的指纹存在 purchases / income_records 的 import_key 里；预览时按指纹去库里查（Store.importKeysExist），
 *  查到的 = 这一行以前导入过，默认不再导入（也不再让它去占别的行的「金额相同」匹配）。 */
import { Store } from "../core/store.js";
import { acctKeyOf, hashKey, importKeyOf } from "./bank-keys-lib.js";
export { acctKeyOf, hashKey, importKeyOf };

/** 已经查过的指纹：key → 以前导入的那条记录的 id；查过没有的记 null */
const KNOWN = new Map();
if (typeof window !== "undefined") window.addEventListener("spend-rows-changed", () => KNOWN.clear());
export const knownKey = (k) => KNOWN.get(k) || null;
/** keys 里还没查过的向数据库查一次；返回 true = 查到了新东西（调用方重画） */
export async function loadKnownKeys(keys) {
  const todo = [...new Set(keys)].filter((k) => !KNOWN.has(k)); if (!todo.length) return false;
  let found = false;
  try {
    const m = await Store.importKeysExist(todo);
    for (const k of todo) { const id = m.get(k) || null; KNOWN.set(k, id); if (id) found = true; }
  } catch (e) { console.warn("[import_key]", e.message); }
  return found;
}
