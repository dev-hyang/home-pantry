/* 录入购物（线上订单）：读入 /pantry-orders 生成的订单 JSON，不调 AI，直接进确认页。校验和整理在 scan-json-lib.js。 */
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { normalize } from "./scan-parse.js";
import { parseOrders, parseOrdersText, partOf } from "./scan-json-lib.js";
import { markRefDups } from "./scan-order.js";
import { repaint, sc } from "./scan-common.js";

/** 付款卡尾号只对上一张在用的卡才自动选（两张同尾号就不猜） */
const uniqueCard = (last4) => { const m = (state.cards || []).filter((c) => c.active !== false && String(c.last4 || "") === last4); return m.length === 1 ? m[0] : null; };

export async function importOrdersJson() {
  sc.error = ""; const keepDate = sc.date;
  try {
    const r = parseOrders(parseOrdersText(sc.json));
    sc.kind = "order"; sc.record = "spend"; sc.date = "";   // 以前的订单：默认只记花费、不入库；日期用 JSON 里每个订单自己的
    const res = normalize([{ receipts: r.receipts.map((x, i) => ({ ...x, ref: i + 1, lines: x.lines.map((l) => (l.fee ? l : { ...l, category: "shop_misc" })) })) }]);   // ref 借来记「第几个订单」，对上 meta
    for (const rc of res.receipts) {
      const m = r.meta[rc.refNo - 1]; if (!m) continue;
      rc.orderRef = m.orderRef; rc.spendCat = "shop_misc";   // 没对上库存物品、只记花费的行：花费分类记「综合购物（待细分）」，不是「其他」
      const c = m.cardLast4 && uniqueCard(m.cardLast4); if (c) rc.pay = c.id;
    }
    await markRefDups(res.receipts);
    const p = partOf(r.part), dups = res.receipts.filter((x) => x.refDup).length;
    res.note = [
      t("来自订单 JSON：{n} 个订单", { n: res.receipts.length }) + (r.from && r.to ? `（${r.from} → ${r.to}）` : ""),
      p && p.m > 1 ? t("第 {a} / {b} 份，导入完这份再读入其余的。", { a: p.n, b: p.m }) : "",
      dups ? t("其中 {n} 个已经录入过，默认不再录入（可以勾选「仍然录入」）。", { n: dups }) : "",
      r.skipped ? t("{n} 个订单没有商品，已忽略。", { n: r.skipped }) : "",
      t("默认只记花费、不入库（以前的东西多半已经用掉）；要入库的行在下面改「放进库存」。"),
    ].filter(Boolean).join(" ");
    sc.result = res; sc.step = "review"; sc.json = "";
  } catch (e) { sc.error = t(e.message || String(e)); }
  finally { sc.date = keepDate; repaint(); }
}

/** 选了 JSON 文件：读成文字放进输入框，直接读入 */
export async function importOrdersFile(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { sc.error = t("文件太大（超过 2 MB），不像是订单 JSON。"); return repaint(); }
  sc.json = await file.text(); return importOrdersJson();
}
