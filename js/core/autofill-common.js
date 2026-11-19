/* 自动填表各部分共用的小件。从 autofill.js 抽出来，各部分依赖这里。 */
import { lang, t } from "./i18n.js";
import { KINDS as medKinds } from "../bills/medical.js";

export const MAX_IMAGES = 3;
export const CONSENT_TEXT = "这张图会发给你在设置里选的 AI 服务商来识别，账单可能含医疗 / 法律等隐私内容，不会保存。要发送吗？";
export const H = () => window.HOUSE;
export const B = () => window.BILLS;
export const MED = () => medKinds;
/** 手机上先压缩（长边 1600px、JPEG），铭牌和小票几百 KB 就够认 */
export async function compressImage(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const url = c.toDataURL("image/jpeg", 0.82);
  return { mime: "image/jpeg", b64: url.split(",")[1], url };
}
/* ───────────── 通用小工具 ───────────── */
export const clean = (v) => (v == null ? "" : String(v).trim());
export const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "") && !Number.isNaN(Date.parse(v));
export const numOr = (v) => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : null; };
export const last4 = (v) => clean(v).replace(/[^0-9A-Za-z]/g, "").slice(-4);
export function parseJson(text) {
  const c = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(c); } catch { /* 再试截取 */ }
  const a = c.indexOf("{"), b = c.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(c.slice(a, b + 1));
  throw new Error(t("没能读出内容，换一张更清楚的图再试。"));
}
export const idList = (arr) => arr.map((x) => `${x.id}=${x.name}`).join(", ");
export const SYSTEM = [
  "You extract fields from photos of documents and labels (appliance nameplates, warranty cards, bills, invoices, odometers, vehicle and insurance cards, product packaging) and return ONLY JSON.",
  "Use null for anything not clearly visible. NEVER guess serial numbers, policy numbers or dates. For any account number return only the last 4 characters.",
  `Write free-text fields in ${lang === "en" ? "English" : "简体中文"} unless the text is a proper name, model or serial number (copy those exactly as printed).`,
  "Dates are YYYY-MM-DD. Money is a plain number without currency symbols.",
].join("\n");
