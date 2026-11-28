/* 录入购物：粘贴的订单 / 小票文字，发给 AI 之前先在本机抹掉个人信息（纯函数，不碰页面，方便测试）。
 * 抹掉：收货 / 账单地址整块、街道 / 城市邮编行、问候语里的姓名、电话、邮箱、卡号 / 卡尾号、物流单号、订单号。
 * 保留：日期、商品名、数量、价格、税费、合计。订单号不发给 AI，只在本机提取出来（供以后去重用）。
 * 图片没法这样处理：截图会原样发送，由页面上的提示 + 发送前确认负责。 */

const BLOCK_LABEL = /^\s*(ship(?:ped)?\s+to|deliver(?:ed|ing)?\s+to|shipping\s+address|delivery\s+address|billing\s+address|bill(?:ed)?\s+to|sold\s+to|recipient|收货地址|收件人|送货地址|配送至|账单地址)\b\s*[:：]?/i;
const STOP_LINE = /^\s*(order|total|subtotal|payment|items?|arriving|arrives|delivered|delivery|shipping\s*&|grand|estimated|tax|promotion|qty|quantity|sold by|订单|合计|总计|付款)/i;
const MONEY = /[$¥￥€£]\s?\d|\d+\.\d{2}\b/;
const STREET = /\b\d{1,6}\s+[A-Za-z0-9 .'-]{2,40}\s(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place|Pkwy|Parkway|Cir|Circle|Ter|Terrace|Hwy|Highway)\b\.?/i;
const CITY_ZIP = /,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/;
const ZIP_ONLY = /^\s*\d{5}(?:-\d{4})?\s*$/;
const GREETING = /^\s*(hi|hello|dear)\s+[^\s,]+/i;
const ORDER_NO = /\b[D]?\d{2,3}-\d{7}-\d{7}\b/g;
const MAX_BLOCK = 6;   // 地址块最多吃掉标签后的几行

/** @returns {{ text: string, orderRefs: string[], dropped: { address: number, name: number, contact: number, card: number } }} */
export function redactOrderText(raw) {
  const dropped = { address: 0, name: 0, contact: 0, card: 0 };
  const orderRefs = [];
  const src = String(raw ?? "").replace(/\r/g, "").split("\n");
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const line = src[i];
    if (BLOCK_LABEL.test(line)) {   // 标签行 + 后面不像金额 / 别的字段的几行（姓名、街道、城市）一起丢；标签和内容同一行也丢
      dropped.address++;
      let n = 0;
      while (n < MAX_BLOCK && i + 1 < src.length && src[i + 1].trim() && !STOP_LINE.test(src[i + 1]) && !MONEY.test(src[i + 1])) { i++; n++; dropped.address++; }
      continue;
    }
    if (STREET.test(line) || CITY_ZIP.test(line) || ZIP_ONLY.test(line)) { dropped.address++; continue; }
    if (GREETING.test(line) && !MONEY.test(line)) { dropped.name++; continue; }
    out.push(line);
  }
  let text = out.join("\n");
  const count = (re, key, rep) => { text = text.replace(re, () => { dropped[key]++; return rep; }); };
  text = text.replace(ORDER_NO, (m) => { if (!orderRefs.includes(m)) orderRefs.push(m); return "[订单号]"; });
  count(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "contact", "[邮箱]");
  count(/(?:\+?1[ .-]?)?\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g, "contact", "[电话]");
  count(/(?:ending\s+in|ends\s+with|last\s*4(?:\s*digits)?|尾号)\s*:?\s*\d{4}\b/gi, "card", "[卡尾号]");
  count(/(?:[*•·x]{2,}[ -]?)+\d{4}\b/gi, "card", "[卡尾号]");
  count(/\b(?:\d[ -]?){12,19}\b/g, "card", "[卡号]");
  count(/\bTBA\d{6,}\b|\b1Z[0-9A-Z]{14,}\b/g, "contact", "[物流单号]");
  count(/\b\d{9,}\b/g, "contact", "[号码]");
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return { text, orderRefs, dropped };
}

/** 抹掉了多少处（给发送前的确认文字用）：总数 + 各类 */
export const droppedTotal = (d) => d.address + d.name + d.contact + d.card;
