/* 出了问题？诊断与配件（设计：docs/design-fix.md）
 * 三层，越往下越“重”：
 *   ① 常见小毛病：data/care.js QUICK_FIXES 按设备类型写死（离线、零成本）——症状 → 多半是什么 → 自己怎么修 → 要买什么 → 什么情况叫人
 *   ② 问咩咩：描述毛病（文字 + 最多 3 张照片）+ 这台设备的情况 → 结构化 JSON：结论 / 可能原因 / 方案（步骤、工具、配件）/ 什么时候叫人 / 修还是换
 *   ③ 配件：先查家里有没有（库存按名字匹配）→ 没有就一键加采购清单（分类 维修耗材，带估价）→ 常用五金店 / 网店的搜索链接；结论可记成一条「检查：需维修」进待处理
 * 页面：#/house/fix?asset=<id>（从设备枢纽进来带设备；也可不选设备直接问）。模型不会联网比价：价格是估计区间，链接只是搜索入口。 */
import { state, STATUS } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, esc, num, toast, todayISO } from "../core/util.js";
import { href } from "../core/router.js";
import { lang, t } from "../core/i18n.js";
import { aiIcon, aiQuota, aiReady, aiSettings, askText, generalPrompt, providerOf, quotaMessage, visionCapable } from "../core/ai.js";
import { ctx as askCtx } from "../core/ask.js";
import { compressImage } from "../core/autofill.js";
import { crumbNav } from "../core/hub.js";
import { propertyName } from "../core/alerts.js";
import { activeVehicles, assetName, isFixture, isVehicle, myAssets, unitsText } from "./assets.js";

const C = () => window.CARE, H = () => window.HOUSE;
const MAX_IMAGES = 3;
const SHOP_CAT = "house_repair";   // 配件进采购清单的分类：房屋耗材 → 维修耗材
// 常用店的搜索入口（不是比价：模型不联网，价格只是估计；点进去按价格排序自己比）
const STORES = {
  na: [["Home Depot", "https://www.homedepot.com/s/"], ["Lowe's", "https://www.lowes.com/search?searchTerm="], ["Ace Hardware", "https://www.acehardware.com/search?query="], ["Menards", "https://www.menards.com/main/search.html?search="], ["Amazon", "https://www.amazon.com/s?k="], ["Walmart", "https://www.walmart.com/search?q="]],
  cn: [["京东", "https://search.jd.com/Search?keyword="], ["淘宝", "https://s.taobao.com/search?q="], ["拼多多", "https://mobile.yangkeduo.com/search_result.html?search_key="]],
};
const region = () => state.houseProfile?.region || (window.Units?.region?.system === "us" ? "na" : "cn");

const fx = () => (state.fix ||= { asset: "", text: "", images: [], busy: false, error: "", result: null, raw: "", added: {}, logged: false });
const PARTS = new Map();   // 本次渲染登记的配件：key → part（按钮只带 key，不把数据塞进属性）
const repaint = () => { const m = $("#main"); if (m && state.route.section === "house" && state.route.sub === "fix") m.innerHTML = viewFix(); };

/* ── 设备候选：当前房产的设备 + 全家的车 ── */
const candidates = () => [...myAssets(), ...activeVehicles()];
const current = () => candidates().find((a) => a.id === fx().asset) || state.assetsEnriched.find((a) => a.id === fx().asset) || null;

/* ── 配件 ↔ 库存 / 采购清单：按名字匹配，宁可漏不可错（“马桶止水皮”不能对上“马桶纸”）──
 * 命中规则：① 一方包含另一方；② 纯英文：配件名末尾的名词整词出现在库存名里（flapper / lubricant），前面的形容词不算；
 * ③ 带数字 / 连字符的型号词整词相同（wd-40、a23、16x25x1）；④ 中文：共享两个及以上双字词（“炉子滤网”对“新风滤网”只共享“滤网”，不算） */
const norm = (s) => String(s || "").toLowerCase().trim();
const toks = (s) => norm(s).split(/[\s/／,，、()（）+·]+/).filter(Boolean);
const bigrams = (s) => { const b = new Set(), c = norm(s).replace(/[^㐀-鿿]/g, ""); for (let i = 0; i + 1 < c.length; i++) b.add(c.slice(i, i + 2)); return b; };
function matchScore(partName, itemName) {
  const n = norm(partName), i = norm(itemName); if (!n || !i) return 0;
  if (i.includes(n) || n.includes(i)) return 3;
  const pt = toks(n), it = new Set(toks(i));
  if (pt.some((x) => x.length >= 3 && /\d|-/.test(x) && it.has(x))) return 2;
  if (/^[\x00-\x7f]+$/.test(n)) { const head = pt.at(-1) || ""; return head.length >= 4 && it.has(head) ? 2 : 0; }
  const pb = bigrams(n), ib = bigrams(i); let shared = 0; for (const b of pb) if (ib.has(b)) shared++;
  return shared >= 2 ? 1 : 0;
}
export function findStock(name) {
  return state.enriched.filter((it) => it.qty > 0 && matchScore(name, it.name) > 0).sort((a, b) => matchScore(name, b.name) - matchScore(name, a.name))[0] || null;
}
const inShop = (label) => state.shopping.find((s) => s.status !== "bought" && String(s.name).trim().toLowerCase() === label.trim().toLowerCase());
const partLabel = (p) => `${t(p.name)}${p.spec ? ` · ${t(p.spec)}`.slice(0, 60 - t(p.name).length) : ""}`.slice(0, 60);
/** “$8–15” → 8（取区间下限做预估金额，预算提示用） */
const priceNum = (s) => { const m = String(s || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/); return m ? Math.round(parseFloat(m[0]) * 100) / 100 : null; };
const storeLinks = (p) => {
  const q = encodeURIComponent(region() === "cn" ? t(p.name) : p.q || (lang === "en" ? p.name : `${p.name}`));
  return (STORES[region()] || STORES.na).map(([n, u]) => `<a class="chip" href="${u}${q}" target="_blank" rel="noopener noreferrer">${esc(n)}</a>`).join("");
};
/** 一个配件：家里有 → 显示在哪、剩多少；已在采购 → 标记；否则「加入采购」+ 在哪买 */
function partRow(p, key) {
  PARTS.set(key, p);
  const have = findStock(p.name), label = partLabel(p), open = inShop(label) || (have && state.shopping.find((s) => s.item_id === have.id && s.status !== "bought"));
  const meta = [p.spec ? t(p.spec) : "", p.qty ? `${num(p.qty)} ${t(p.unit || "个")}` : "", p.price ? `≈ ${t(p.price)}` : ""].filter(Boolean).join(" · ");
  const haveLine = have ? `<small class="fix-have">✓ ${t("家里有：{name}", { name: have.name })}${have.location ? ` · 📍${esc(t(have.location))}` : ""} · ${t("剩 {q} {u}", { q: Math.round(have.dqty * 100) / 100, u: t(have.du) })}${have.status !== "ok" ? ` <span class="badge ${STATUS[have.status].cls}">${t(STATUS[have.status].label)}</span>` : ""}</small>` : "";
  const act = fx().added[key] || open ? `<span class="badge b-ok">${t("已在采购清单")}</span>`
    : `<button type="button" class="btn btn-sm ${have ? "btn-ghost" : "btn-primary"}" data-action="fix-part-add" data-key="${esc(key)}">${have ? t("还是买一个") : t("加入采购")}</button>`;
  return `<li class="fix-part"><div class="grow"><b>${esc(t(p.name))}</b>${meta ? `<small>${esc(meta)}</small>` : ""}${haveLine}
      <details class="fix-where"><summary>${t("在哪买")}</summary><div class="chips" style="margin:4px 0 0">${storeLinks(p)}</div></details></div>${act}</li>`;
}
export async function addPart(key) {
  const p = PARTS.get(key); if (!p) return;
  const label = partLabel(p);
  if (inShop(label)) { fx().added[key] = true; toast(t("已经在清单里了")); return repaint(); }
  await Store.saveShopping({ item_id: null, name: label, quantity: num(p.qty) > 0 ? num(p.qty) : 1, unit: String(t(p.unit || "个")).slice(0, 10), category: SHOP_CAT, amount: priceNum(p.price) });
  fx().added[key] = true;
  toast(t("已加入采购清单：{name}", { name: label }));
}

/* ── 常见小毛病（第 ① 层）── */
function quickFixes(a) {
  const list = a ? C().fixesOf(a.type) : [];
  if (!list.length) return "";
  return `<section class="section"><div class="section-head"><h2>🔎 ${t("常见小毛病：先看这里")}</h2><p>${t("不用问 AI；配件能直接加采购")}</p></div>
    <div class="panel fix-quick">${list.map((q, i) => `<details class="care-card"><summary>${esc(t(q.s))}</summary>
      <p><b>${t("多半是")}</b>${esc(t(q.why))}</p>
      ${q.diy?.length ? `<div class="care-sec care-diy"><h4>${t("自己能做")}</h4><ol class="tips">${q.diy.map((x) => `<li>${esc(t(x))}</li>`).join("")}</ol></div>` : ""}
      ${q.parts?.length ? `<div class="care-sec"><h4>${t("要买什么")}</h4><ul class="restock-list fix-parts">${q.parts.map((p, j) => partRow(p, `q-${a.type}-${i}-${j}`)).join("")}</ul></div>` : ""}
      ${q.pro ? `<div class="care-sec care-pro"><h4>${t("什么时候叫人")}</h4><p style="padding:0">${esc(t(q.pro))}</p></div>` : ""}
      ${q.note ? `<p class="care-meta"><b>${t("提醒")}</b>${esc(t(q.note))}</p>` : ""}
    </details>`).join("")}</div></section>`;
}

/* ── 页面 ── */
export function viewFix() {
  const f = fx();
  const qa = state.route.q.get("asset");
  if (qa && qa !== f.asset) Object.assign(f, { asset: qa, result: null, error: "", logged: false, added: {} });   // 从别的设备进来：换目标，清上次结果
  PARTS.clear();
  const a = current(), ready = aiReady(), p = providerOf(aiSettings().provider);
  const q = ready ? aiQuota() : null, blocked = !!q && !q.ok, canImg = ready && visionCapable(p);
  const pid = a?.property_id || state.propertyId, pn = pid ? propertyName(pid) : "";
  const crumb = crumbNav([{ href: href("house"), label: t("房屋") }, ...(pn && !isVehicle(a) ? [{ href: `${href("house", "pages")}?prop=${pid}`, label: pn, icon: "🏠" }] : []),
    { href: isVehicle(a) ? href("house", "vehicles") : `${href("house", "assets")}${pid ? `?prop=${pid}` : ""}`, label: isVehicle(a) ? t("车辆") : t("设备保养") }, ...(a ? [{ href: href("asset", a.id), label: assetName(a), icon: a.t?.icon || "⚙️" }] : []), { label: t("出了问题？"), icon: "🩺" }]);
  const opt = (x) => `<option value="${esc(x.id)}" ${x.id === f.asset ? "selected" : ""}>${x.t?.icon || "⚙️"} ${esc(assetName(x))}${isFixture(x) && unitsText(x) ? `（${esc(unitsText(x, 2))}）` : x.location ? `（${esc(t(x.location))}）` : ""}</option>`;
  const list = candidates();
  const info = a ? [a.t ? t(a.t.name) : "", [a.brand, a.model].filter(Boolean).join(" "), a.ageYears != null ? t("已用 {n} 年", { n: Math.floor(a.ageYears) }) : "", a.lastService ? t("上次保养 {d}", { d: String(a.lastService).slice(0, 10) }) : "", isFixture(a) ? unitsText(a) : ""].filter(Boolean).join(" · ") : "";
  const submit = ready && !blocked ? `<button type="submit" class="btn btn-primary" ${f.busy ? "disabled" : ""}>${aiIcon(16)} ${f.busy ? t("咩咩诊断中…") : f.result ? t("重新问") : t("问咩咩")}</button>` : "";
  return `<section class="section fix-page">
    ${crumb}
    <form id="fixForm" class="panel" novalidate>
      <p class="muted" style="margin:0 0 10px;font-size:13px">${!ready ? t("描述毛病，先看下面的常见小毛病；没填 key 时「复制提示词」拿去任一 AI 问。") : blocked ? esc(quotaMessage(q)) : t("描述哪里不对（声音、现象、从什么时候开始、试过什么）；能拍照更准。咩咩会给原因、方案和要买的配件——涉及燃气、电、结构一定找人。")}</p>
      <div class="form-grid">
        <label>${t("哪台设备 / 哪里")}
          <select name="asset" id="fixAsset"><option value="">${t("不是具体设备 / 不确定")}</option>${list.map(opt).join("")}</select>
          ${info ? `<small>${esc(info)}</small>` : ""}
        </label>
        <label class="span-2">${t("怎么了？")}
          <textarea name="text" id="fixText" rows="3" maxlength="800" placeholder="${t("例如：主卫马桶冲完一直有细细的水声，隔十几分钟会自己补一下水；把手正常")}">${esc(f.text)}</textarea>
        </label>
      </div>
      <div class="scan-thumbs" style="margin-top:8px">
        ${f.images.map((im, i) => `<span class="scan-thumb"><img src="${im.url}" alt="${t("第 {n} 张", { n: i + 1 })}"><button type="button" data-action="fix-img-del" data-i="${i}" aria-label="${t("删除这张")}">×</button></span>`).join("")}
        ${f.images.length < MAX_IMAGES ? `<label class="scan-add ${canImg ? "" : "is-off"}" title="${canImg ? "" : esc(t("当前模型不能读图；换成 Gemini 可拍照"))}"><input type="file" id="fixFile" accept="image/*" multiple ${canImg ? "" : "disabled"}><span>📷 ${t("拍照 / 选图")}</span></label>` : ""}
      </div>
      <div class="form-actions" style="margin-top:10px">
        ${submit}
        <button type="button" class="btn ${ready && !blocked ? "btn-ghost" : "btn-primary"}" data-action="fix-copy">${t("复制提示词")}</button>
        <a class="btn btn-sm btn-ghost" href="${href("me", "settings")}?sec=ai">${ready ? t("换模型") : t("填 API key 直接出结果")}</a>
        ${f.result || f.text || f.images.length ? `<button type="button" class="btn btn-sm btn-ghost" data-action="fix-reset">${t("清空")}</button>` : ""}
      </div>
      ${f.error ? `<p class="form-error" role="alert">${esc(f.error)}</p>` : ""}
    </form>
    ${f.result ? resultHtml(f.result, a) : ""}
    ${quickFixes(a)}
  </section>`;
}

/* ── 第 ② 层：问咩咩 ── */
function fixPrompt() {
  const f = fx(), a = current(), en = lang === "en";
  const base = generalPrompt("", { withContext: false });
  const system = `${base.system}\n${en
    ? "Task: diagnose a household / appliance / vehicle problem from the description (and photos if attached). Prefer repairing or replacing the failed PART over replacing the whole unit. Be concrete: name the part generically and searchably (e.g. \"toilet flapper 3 inch\"), with the spec needed to buy the right one, and a typical price range for the region. Say clearly when gas, electrical, structural or safety issues mean calling a professional. Return ONLY JSON, no markdown."
    : "这次的任务：根据描述（和照片）诊断家里设备 / 装置 / 车辆的毛病。优先修或换坏的那个零件，而不是换整台。要具体：配件名用通用、能搜到的叫法（如“马桶止水皮 3 英寸”），写清买对的规格和当地常见价格区间。涉及燃气、电、结构、安全的情况要明确说叫人。只返回 JSON，不要 markdown。"}`;
  const ctxLines = a ? (isVehicle(a) ? askCtx.vehicle(a) : askCtx.asset(a)) : [];
  const units = a && isFixture(a) ? unitsText(a, 8) : "";
  const shape = '{"summary":"","urgent":"","replace":"","causes":[{"cause":"","likelihood":"high|medium|low","check":""}],"fixes":[{"title":"","diy":true,"difficulty":"easy|medium|hard","mins":30,"steps":[""],"tools":[""],"parts":[{"name":"","q":"english search keywords","spec":"","qty":1,"unit":"","price":"","where":"hardware|online|appliance|auto|dealer"}],"cost":"","note":""}],"pro":{"when":"","who":"","cost":""}}';
  const user = [
    a ? `${en ? "Item" : "设备"}：${assetName(a)}${ctxLines.length ? `（${ctxLines.join(en ? "; " : "；")}）` : ""}` : (en ? "Item: not a specific registered device" : "设备：没有指定（家里某处）"),
    units ? `${en ? "Locations" : "位置与数量"}：${units}` : "",
    `${en ? "Region" : "地区"}：${region() === "cn" ? (en ? "China" : "中国") : (en ? "North America" : "北美")}`,
    `${en ? "Problem" : "问题描述"}：${f.text.trim() || (en ? "(see photos)" : "（见照片）")}`,
    f.images.length ? (en ? `${f.images.length} photo(s) attached.` : `附 ${f.images.length} 张照片。`) : "",
    `${en ? "Return exactly this shape" : "严格按这个结构返回"}：${shape}`,
    en ? "summary = one-sentence conclusion; urgent = what to do right now or \"\"; replace = repair-vs-replace advice or \"\"; causes ≤ 4 sorted by likelihood; fixes ≤ 3, DIY first; steps ≤ 8 short imperative sentences; parts only what must be bought; q = English search keywords for hardware-store sites; pro.when = when to call, who = trade, cost = typical range."
      : "summary 一句话结论；urgent 现在马上要做的事（没有填空）；replace 修还是换的建议（没有填空）；causes 最多 4 条按可能性排序；fixes 最多 3 个、自己能做的放前面；steps 最多 8 步、每步一句祈使句；parts 只列必须买的；q 是去五金店网站搜索用的英文关键词；pro.when 什么情况叫人、who 找哪一行、cost 常见价格。",
  ].filter(Boolean).join("\n");
  return { system, user, text: `${system}\n\n${user}` };
}
const str = (v, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const arr = (v, n, f) => (Array.isArray(v) ? v.slice(0, n).map(f).filter(Boolean) : []);
/** 只接受合法 JSON，逐字段清洗、截断；任何内容都只当文字显示 */
function parseFix(text) {
  const clean = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let j = null; try { j = JSON.parse(clean); } catch { const a = clean.indexOf("{"), b = clean.lastIndexOf("}"); if (a >= 0 && b > a) { try { j = JSON.parse(clean.slice(a, b + 1)); } catch { /* 下面报错 */ } } }
  if (!j || typeof j !== "object") throw new Error(t("咩咩的回答没能整理成方案，再试一次或换个说法。"));
  const part = (p) => (p && str(p.name, 60) ? { name: str(p.name, 60), q: str(p.q, 80), spec: str(p.spec, 120), qty: num(p.qty, 1) > 0 ? num(p.qty, 1) : 1, unit: str(p.unit, 10), price: str(p.price, 40), where: str(p.where, 20) } : null);
  const fix = (x) => (x && str(x.title, 120) ? { title: str(x.title, 120), diy: x.diy !== false, difficulty: ["easy", "medium", "hard"].includes(x.difficulty) ? x.difficulty : "", mins: num(x.mins, 0) > 0 ? Math.round(num(x.mins)) : null,
    steps: arr(x.steps, 8, (s) => str(s, 240)), tools: arr(x.tools, 8, (s) => str(s, 60)), parts: arr(x.parts, 6, part), cost: str(x.cost, 80), note: str(x.note, 240) } : null);
  const out = { summary: str(j.summary, 300), urgent: str(j.urgent, 300), replace: str(j.replace, 300),
    causes: arr(j.causes, 4, (c) => (c && str(c.cause, 200) ? { cause: str(c.cause, 200), likelihood: ["high", "medium", "low"].includes(c.likelihood) ? c.likelihood : "", check: str(c.check, 200) } : null)),
    fixes: arr(j.fixes, 3, fix), pro: j.pro && typeof j.pro === "object" ? { when: str(j.pro.when, 300), who: str(j.pro.who, 80), cost: str(j.pro.cost, 80) } : null };
  if (!out.summary && !out.fixes.length && !out.causes.length) throw new Error(t("咩咩的回答没能整理成方案，再试一次或换个说法。"));
  return out;
}
export async function runFix() {
  const f = fx();
  f.text = ($("#fixText")?.value ?? f.text).trim();
  if (!f.text && !f.images.length) { f.error = t("先写一句哪里不对，或拍张照"); return; }
  f.busy = true; f.error = "";
  try {
    const p = fixPrompt();
    f.raw = await askText(p.system, p.user, { json: true, maxTokens: 2200, temperature: 0.3, images: f.images.map((i) => ({ mime: i.mime, b64: i.b64 })) });
    f.result = parseFix(f.raw); f.logged = false; f.added = {};
  } catch (e) { f.error = e.message; }
  finally { f.busy = false; }
}

/* ── 结果 ── */
const LIKELY = { high: ["很可能", "b-out"], medium: ["可能", "b-soon"], low: ["不太可能", "b-low"] };
function resultHtml(r, a) {
  const fixCard = (x, i) => `<article class="panel fix-plan">
    <div class="fix-plan-head"><h3>${i + 1}. ${esc(x.title)}</h3><div class="asset-badges">
      <span class="badge ${x.diy ? "b-ok" : "b-soon"}">${x.diy ? t("自己能做") : t("一般要叫人")}</span>
      ${x.difficulty ? `<span class="badge" style="background:var(--surface-2)">${t({ easy: "简单", medium: "中等", hard: "有难度" }[x.difficulty])}</span>` : ""}
      ${x.mins ? `<span class="badge" style="background:var(--surface-2)">⏱ ${t("约 {n} 分钟", { n: x.mins })}</span>` : ""}
      ${x.cost ? `<span class="badge" style="background:var(--surface-2)">💲 ${esc(x.cost)}</span>` : ""}</div></div>
    ${x.steps.length ? `<ol class="tips fix-steps">${x.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
    ${x.tools.length ? `<p class="care-meta"><b>${t("工具")}</b>${esc(x.tools.join(" · "))}</p>` : ""}
    ${x.parts.length ? `<div class="fix-parts-wrap"><div class="section-head" style="margin:6px 0 2px"><h4 style="margin:0;font-size:13.5px">${t("要买的配件")}</h4>${x.parts.length > 1 ? `<button type="button" class="btn btn-sm btn-ghost" data-action="fix-parts-all" data-fix="${i}">${t("全部加入采购")}</button>` : ""}</div>
      <ul class="restock-list fix-parts">${x.parts.map((p, j) => partRow(p, `f-${i}-${j}`)).join("")}</ul></div>` : ""}
    ${x.note ? `<p class="care-meta"><b>${t("注意")}</b>${esc(x.note)}</p>` : ""}
  </article>`;
  return `<section class="section fix-result">
    <div class="panel ai-answer" style="margin-top:0"><div class="ai-answer-head">${aiIcon(20)} <b>${t("咩咩的诊断")}</b><span class="spacer"></span>
      <button type="button" class="btn btn-sm btn-ghost" data-action="fix-copy-answer">${t("复制")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="fix-more">${t("追问")}</button></div>
      ${r.summary ? `<p class="fix-summary">${esc(r.summary)}</p>` : ""}
      ${r.urgent ? `<p class="care-urgent fix-urgent"><b>⚠️ ${t("马上处理")}</b>${esc(r.urgent)}</p>` : ""}
      ${r.causes.length ? `<h4>${t("可能原因")}</h4><ul class="tips fix-causes">${r.causes.map((c) => `<li>${c.likelihood ? `<span class="badge ${LIKELY[c.likelihood][1]}">${t(LIKELY[c.likelihood][0])}</span> ` : ""}${esc(c.cause)}${c.check ? `<small class="muted"> — ${t("怎么确认")}：${esc(c.check)}</small>` : ""}</li>`).join("")}</ul>` : ""}
      ${r.replace ? `<p class="care-meta"><b>${t("修还是换")}</b>${esc(r.replace)}</p>` : ""}
    </div>
    ${r.fixes.map(fixCard).join("")}
    ${r.pro && (r.pro.when || r.pro.who) ? `<div class="panel fix-pro"><h4>☎ ${t("什么时候叫人")}</h4>${r.pro.when ? `<p>${esc(r.pro.when)}</p>` : ""}<p class="muted">${[r.pro.who ? t("找：{who}", { who: r.pro.who }) : "", r.pro.cost ? t("常见费用：{c}", { c: r.pro.cost }) : ""].filter(Boolean).join(" · ")}</p></div>` : ""}
    <div class="form-actions">
      ${a && !isVehicle(a) ? (fx().logged ? `<span class="badge b-ok">${t("已记到保养记录（待处理）")}</span>` : `<button type="button" class="btn btn-sm" data-action="fix-log">${t("记到保养记录：待处理")}</button>`) : ""}
      ${a ? `<a class="btn btn-sm btn-ghost" href="${href("asset", a.id)}?log=1">${t("修好了，记一笔维修")}</a>` : ""}
    </div>
    <p class="disclaimer">${t("AI 回答仅供参考；价格是估计、链接只是搜索入口，不是比价结果。涉及燃气、电、结构、法律、医疗请找专业人士。")}</p>
  </section>`;
}
function answerText(r) {
  const L = [r.summary, r.urgent ? `${t("马上处理")}：${r.urgent}` : "", r.causes.length ? `${t("可能原因")}：\n${r.causes.map((c) => `- ${c.cause}${c.check ? `（${c.check}）` : ""}`).join("\n")}` : ""];
  r.fixes.forEach((x, i) => L.push(`${i + 1}. ${x.title}${x.diy ? "" : `（${t("一般要叫人")}）`}\n${x.steps.map((s, k) => `  ${k + 1}) ${s}`).join("\n")}${x.parts.length ? `\n  ${t("要买的配件")}：${x.parts.map((p) => `${p.name}${p.spec ? ` ${p.spec}` : ""}${p.price ? ` ${p.price}` : ""}`).join("；")}` : ""}`));
  if (r.pro?.when) L.push(`${t("什么时候叫人")}：${r.pro.when}${r.pro.who ? `（${r.pro.who}）` : ""}`);
  return L.filter(Boolean).join("\n\n");
}
/** 记成一条「检查：需维修」：设备进待处理、首页提醒，直到记维修 / 更换 */
async function logFix() {
  const f = fx(), a = current(); if (!a || !f.result || isVehicle(a)) return;
  const notes = `${t("诊断")}：${f.text.trim().slice(0, 200)}${f.result.summary ? ` → ${f.result.summary}` : ""}`.slice(0, 500);
  await Store.addMaintLog({ asset_id: a.id, done_on: todayISO(), kind: "inspect", cost: null, currency: null, diy: true, vendor: null, notes, purchase_id: null, result: "needs_repair", service_item: null, odometer: null });
  f.logged = true;
  toast(t("已记录：{name} 需维修，会提醒到记下维修为止", { name: assetName(a) }));
}

/* ── 事件：main.js 把 fix-* 转过来；文件和下拉由这里自己监听 ── */
export async function fixAction(action, el, { refresh, render, go }) {
  const f = fx();
  switch (action) {
    case "fix-img-del": f.images.splice(+el.dataset.i, 1); return repaint();
    case "fix-reset": Object.assign(f, { text: "", images: [], result: null, raw: "", error: "", added: {}, logged: false }); return repaint();
    case "fix-copy": {
      f.text = ($("#fixText")?.value ?? f.text).trim();
      if (!f.text && !f.images.length) return toast(t("先写一句哪里不对"));
      try { await navigator.clipboard.writeText(fixPrompt().text); toast(t("提示词已复制，打开任一 AI 粘贴即可（照片要自己附上）")); } catch { window.prompt(t("复制下面的提示词"), fixPrompt().text); }
      return;
    }
    case "fix-copy-answer": if (f.result) { try { await navigator.clipboard.writeText(answerText(f.result)); toast(t("已复制")); } catch { /* 忽略 */ } } return;
    case "fix-more": {   // 带着问题和诊断去整页咩咩咩追问
      if (!f.result) return;
      state.aiPage = { ...(state.aiPage || {}), q: `${t("接着上面这个问题：")}${f.text.trim()}\n${t("你之前的回答：")}${answerText(f.result).slice(0, 600)}\n\n${t("我想再问：")}`, answer: null, error: null, withContext: true };
      return go(href("ai"));
    }
    case "fix-part-add": el.disabled = true; await addPart(el.dataset.key); return refresh();
    case "fix-parts-all": {
      const x = f.result?.fixes[+el.dataset.fix]; if (!x) return;
      el.disabled = true;
      for (let j = 0; j < x.parts.length; j++) { const key = `f-${el.dataset.fix}-${j}`; if (!f.added[key] && !inShop(partLabel(x.parts[j]))) await addPart(key); else f.added[key] = true; }
      return refresh();
    }
    case "fix-log": el.disabled = true; await logFix(); return refresh();
    default: return render();
  }
}
document.addEventListener("change", async (e) => {
  if (e.target.id === "fixFile") {
    const f = fx(), files = [...e.target.files].slice(0, MAX_IMAGES - f.images.length); e.target.value = "";
    f.error = "";
    for (const file of files) { try { f.images.push(await compressImage(file, 1280)); } catch { f.error = t("这张图读不了，换一张（JPG / PNG）。"); } }
    f.text = $("#fixText")?.value ?? f.text;
    repaint(); return;
  }
  if (e.target.id === "fixAsset") {
    const f = fx(); f.text = $("#fixText")?.value ?? f.text;
    Object.assign(f, { asset: e.target.value, result: null, error: "", logged: false, added: {} });
    // 地址带着设备 id，刷新 / 分享还是这台；不选设备就去掉参数
    const h = `${href("house", "fix")}${f.asset ? `?asset=${f.asset}` : ""}`;
    if (location.hash !== h) history.replaceState(null, "", h);
    repaint();
  }
});
document.addEventListener("input", (e) => { if (e.target.id === "fixText") fx().text = e.target.value; });
