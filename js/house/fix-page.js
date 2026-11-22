/* 出了问题：页面、第 ② 层问咩咩、结果。 */
import { $, esc, num, toast, todayISO } from "../core/util.js";
import { Store } from "../core/store.js";
import { houseCars, houseProps } from "../core/crumb-base.js";
import { aiIcon, aiQuota, aiReady, askText, generalPrompt, quotaMessage, visionCapable } from "../core/ai.js";
import { aiSettings, providerOf } from "../core/ai-common.js";
import { ctx as askCtx } from "../core/ask.js";
import { assetName, isVehicle } from "./assets.js";
import { candidates, current, partRow, quickFixes } from "./fix-parts.js";
import { crumbNav } from "../core/hub.js";
import { href } from "../core/router.js";
import { isFixture, unitsText } from "./asset-common.js";
import { lang, t } from "../core/i18n.js";
import { propertyName } from "../core/alerts.js";
import { state } from "../core/state.js";
import { MAX_IMAGES, PARTS, fx, region, vehQuick } from "./fix-common.js";

/* ── 页面 ── */
export function viewFix() {
  const f = fx();
  const qa = state.route.q.get("asset");
  if (qa && qa !== f.asset) Object.assign(f, { asset: qa, result: null, error: "", logged: false, added: {} });   // 从别的设备进来：换目标，清上次结果
  PARTS.clear();
  const a = current(), ready = aiReady(), p = providerOf(aiSettings().provider);
  const q = ready ? aiQuota() : null, blocked = !!q && !q.ok, canImg = ready && visionCapable(p);
  const veh = isVehicle(a);
  const pid = a?.property_id || state.propertyId, pn = pid ? propertyName(pid) : "";
  const crumb = crumbNav([...(isVehicle(a) ? houseCars() : houseProps()), ...(pn && !isVehicle(a) ? [{ href: `${href("house", "overview")}?prop=${pid}`, label: pn, icon: "🏠" }] : []),
    ...(isVehicle(a) ? [] : [{ href: `${href("house", "assets")}${pid ? `?prop=${pid}` : ""}`, label: t("设备保养") }]), ...(a ? [{ href: href("asset", a.id), label: assetName(a), icon: a.t?.icon || "⚙️" }] : []), { label: t("出了问题？"), icon: "🩺" }]);
  const opt = (x) => `<option value="${esc(x.id)}" ${x.id === f.asset ? "selected" : ""}>${x.t?.icon || "⚙️"} ${esc(assetName(x))}${isFixture(x) && unitsText(x) ? `（${esc(unitsText(x, 2))}）` : x.location ? `（${esc(t(x.location))}）` : ""}</option>`;
  const list = candidates();
  const info = a ? [a.t ? t(a.t.name) : "", [a.brand, a.model].filter(Boolean).join(" "), a.ageYears != null ? t("已用 {n} 年", { n: Math.floor(a.ageYears) }) : "", a.lastService ? t("上次保养 {d}", { d: String(a.lastService).slice(0, 10) }) : "", isFixture(a) ? unitsText(a) : ""].filter(Boolean).join(" · ") : "";
  const submit = ready && !blocked ? `<button type="submit" class="btn btn-primary" ${f.busy ? "disabled" : ""}>${aiIcon(16)} ${f.busy ? t("咩咩诊断中…") : f.result ? t("重新问") : t("问咩咩")}</button>` : "";
  return `<section class="section fix-page">
    ${crumb}
    <form id="fixForm" class="panel" novalidate>
      <p class="muted" style="margin:0 0 10px;font-size:13px">${!ready ? t("描述毛病，先看下面的常见小毛病；没填 key 时「复制提示词」拿去任一 AI 问。") : blocked ? esc(quotaMessage(q)) : t("描述哪里不对（声音、现象、从什么时候开始、试过什么）；能拍照更准。咩咩会给原因、方案和要买的配件——涉及燃气、电、结构一定找人。")}</p>
      <div class="form-grid">
        ${veh ? `<input type="hidden" name="asset" id="fixAsset" value="${esc(a.id)}"><p class="span-2 fix-veh-line"><b>🚗 ${esc(assetName(a))}</b>${info ? `<small>${esc(info)}</small>` : ""}</p>
        <div class="span-2"><span class="fix-quick-title">${t("常见问题，点一下直接问")}</span><div class="chips fix-quick-chips">${vehQuick(a).map((x, i) => `<button type="button" class="chip" data-action="fix-quick" data-i="${i}" ${f.busy ? "disabled" : ""}>${esc(t(x.label))}</button>`).join("")}</div></div>` : `<label>${t("哪台设备 / 哪里")}
          <select name="asset" id="fixAsset"><option value="">${t("不是具体设备 / 不确定")}</option>${list.map(opt).join("")}</select>
          ${info ? `<small>${esc(info)}</small>` : ""}
        </label>`}
        <label class="span-2">${t("怎么了？")}
          <textarea name="text" id="fixText" data-autosize rows="3" maxlength="800" placeholder="${veh ? t("例如：冷车启动后发动机故障灯亮了，怠速有点抖；开出去一段路后灯还亮着") : t("例如：主卫马桶冲完一直有细细的水声，隔十几分钟会自己补一下水；把手正常")}">${esc(f.text)}</textarea>
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
export function fixPrompt() {
  const f = fx(), a = current(), en = lang === "en";
  const base = generalPrompt("", { withContext: false });
  const veh = isVehicle(a);
  const system = veh ? `${base.system}\n${en
    ? "Task: diagnose a problem with the user's CAR from the description (and photos if attached). Use the vehicle's year, make, model, powertrain and mileage. Prefer repairing or replacing the failed PART over bigger jobs. Name parts generically so they can be searched at an auto-parts store. Give price ranges only as rough estimates. SAFETY FIRST: for brakes, steering, overheating, fuel or burning smells, warning lights that mean stop-now, or anything uncertain, say clearly to stop driving and call roadside assistance or a mechanic, and put it in \"urgent\". Reply in English."
    : "这次的任务：根据描述（和照片）诊断用户这辆车的毛病。要结合这辆车的年款、品牌、型号、动力类型和里程。优先修或换坏的那个零件，不要一上来就大修。配件名用通用、能在汽配店搜到的叫法；价格只给大致区间。安全第一：涉及刹车、转向、过热、漏油 / 烧焦味、必须马上停车的警告灯，或者拿不准的情况，要明确说“先停车，叫拖车 / 找修理厂”，并写进 urgent。用简体中文回答。"}`
    : `${base.system}\n${en
    ? "Task: diagnose a household / appliance / vehicle problem from the description (and photos if attached). Prefer repairing or replacing the failed PART over replacing the whole unit. Be concrete: name the part generically and searchably (e.g. \"toilet flapper 3 inch\"), with the spec needed to buy the right one, and a typical price range for the region. Say clearly when gas, electrical, structural or safety issues mean calling a professional. Return ONLY JSON, no markdown."
    : "这次的任务：根据描述（和照片）诊断家里设备 / 装置 / 车辆的毛病。优先修或换坏的那个零件，而不是换整台。要具体：配件名用通用、能搜到的叫法（如“马桶止水皮 3 英寸”），写清买对的规格和当地常见价格区间。涉及燃气、电、结构、安全的情况要明确说叫人。只返回 JSON，不要 markdown。"}`;
  const ctxLines = a ? (isVehicle(a) ? askCtx.vehicle(a) : askCtx.asset(a)) : [];
  const units = a && isFixture(a) ? unitsText(a, 8) : "";
  const shape = '{"summary":"","urgent":"","replace":"","causes":[{"cause":"","likelihood":"high|medium|low","check":""}],"fixes":[{"title":"","diy":true,"difficulty":"easy|medium|hard","mins":30,"steps":[""],"tools":[""],"parts":[{"name":"","q":"english search keywords","spec":"","qty":1,"unit":"","price":"","where":"hardware|online|appliance|auto|dealer"}],"cost":"","note":""}],"pro":{"when":"","who":"","cost":""}}';
  const user = [
    a ? `${veh ? (en ? "Vehicle" : "车辆") : (en ? "Item" : "设备")}：${assetName(a)}${ctxLines.length ? `（${ctxLines.join(en ? "; " : "；")}）` : ""}` : (en ? "Item: not a specific registered device" : "设备：没有指定（家里某处）"),
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
export function answerText(r) {
  const L = [r.summary, r.urgent ? `${t("马上处理")}：${r.urgent}` : "", r.causes.length ? `${t("可能原因")}：\n${r.causes.map((c) => `- ${c.cause}${c.check ? `（${c.check}）` : ""}`).join("\n")}` : ""];
  r.fixes.forEach((x, i) => L.push(`${i + 1}. ${x.title}${x.diy ? "" : `（${t("一般要叫人")}）`}\n${x.steps.map((s, k) => `  ${k + 1}) ${s}`).join("\n")}${x.parts.length ? `\n  ${t("要买的配件")}：${x.parts.map((p) => `${p.name}${p.spec ? ` ${p.spec}` : ""}${p.price ? ` ${p.price}` : ""}`).join("；")}` : ""}`));
  if (r.pro?.when) L.push(`${t("什么时候叫人")}：${r.pro.when}${r.pro.who ? `（${r.pro.who}）` : ""}`);
  return L.filter(Boolean).join("\n\n");
}
/** 记成一条「检查：需维修」：设备进待处理、首页提醒，直到记维修 / 更换 */
export async function logFix() {
  const f = fx(), a = current(); if (!a || !f.result || isVehicle(a)) return;
  const notes = `${t("诊断")}：${f.text.trim().slice(0, 200)}${f.result.summary ? ` → ${f.result.summary}` : ""}`.slice(0, 500);
  await Store.addMaintLog({ asset_id: a.id, done_on: todayISO(), kind: "inspect", cost: null, currency: null, diy: true, vendor: null, notes, purchase_id: null, result: "needs_repair", service_item: null, odometer: null });
  f.logged = true;
  toast(t("已记录：{name} 需维修，会提醒到记下维修为止", { name: assetName(a) }));
}
