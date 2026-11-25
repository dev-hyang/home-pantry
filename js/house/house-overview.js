/* 房屋概览：房屋卡片、耗材提醒、设备 / 季节任务 / 交易的摘要面板。 */
import { numAttrs } from "../core/ui-num.js";
import { EMERGENCY_FIELDS, emergencyFilled, emergencyOf } from "./house-draft.js";
import { RENT_POLICIES, amountSource, curPid, hoaOf, hoaRegular, hoaTotalHtml, noteArea, refSection, statusLine } from "./house-fees.js";
import { alertAct, alertBadge, alertText, assetAlerts, myAssets } from "./asset-common.js";
import { alertsOf } from "../core/logic.js";
import { assetAsk, assetMenu, assetName } from "./assets.js";
import { canManageHome } from "../settings/members.js";
import { currentProp, dealHref, taskRow as dealTaskRow, dealTasks, openDeal } from "./deals.js";
import { dotRow } from "../core/alerts.js";
import { esc, inSpace, money } from "../core/util.js";
import { houseBar } from "./property-form.js";
import { houseFacts } from "./house-sections.js";
import { houseNavTiles } from "./house-menu.js";
import { href } from "../core/router.js";
import { monthName, monthTasks, taskRow } from "./tasks.js";
import { moreMenu } from "../core/more-menu.js";
import { ownerIcon, ownerMatch, ownerName, showOwner } from "../pantry/owner.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { H } from "./asset-common.js";
import { restockPanel, rsHint, shelfGrid } from "../pantry/restock.js";

/* ── 房屋概览 ── */
export function viewHouse() {
  const p = state.houseProfile;
  const shelf = shelfGrid("house");
  if (!p) {
    return `${houseBar()}${statusLine()}<section class="section house-intro">
      <h2>${t("先说说你家的房子")}</h2>
      <p class="muted">${t("选一下房型、外墙和地面材料、家里有哪些设施，大约 1 分钟。之后会告诉你哪些部位归自己维护、各种材料怎么保养，并一次加好常用的汽车房屋消耗品。")}</p>
      <p><a class="ui-btn" data-tone="primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a>
         <a class="ui-btn" data-tone="ghost" href="${href("house", "supplies")}">${t("先直接记录耗材")}</a></p>
    </section>
    ${shelf ? `<section class="section"><div class="section-head"><h2>${t("汽车房屋消耗品")}</h2></div><div class="shelf">${shelf}</div></section>` : ""}`;
  }
  const ht = H().typeOf(p.region, p.house_type);
  const names = (group, ids) => ids.map((id) => H().MATERIALS[group].find((m) => m.id === id)).filter(Boolean);
  const ext = names("exterior", p.exterior || []), floors = names("flooring", p.flooring || []);
  const roof = p.roof ? names("roof", [p.roof]) : [];
  const featNames = H().FEATURES.filter((f) => (p.features || []).includes(f.id)).map((f) => t(f.name));
  const age = p.year_built ? new Date().getFullYear() - p.year_built : null;

  const ownerRows = H().SYSTEMS.map((s) => {
    const o = H().OWNERS[ht?.owners?.[s.id] || "varies"];
    return `<tr><th scope="row">${esc(t(s.name))}</th><td><span class="owner ${o.cls}">${esc(t(o.name))}</span></td></tr>`;
  }).join("");

  const careBlock = (title, mats) => mats.length ? `<div class="care">
      <h3>${title}</h3>
      ${mats.map((m) => `<details ${mats.length === 1 ? "open" : ""}><summary>${esc(t(m.name))}</summary><ul>${m.tips.map((x) => `<li>${esc(t(x))}</li>`).join("")}</ul></details>`).join("")}
    </div>` : "";

  const facts = houseFacts(p, { ext, roof, floors, featNames });
  const factRows = (list) => list.map((f) => `<div class="fact ${f.wide ? "wide" : ""}"><dt>${f.k}</dt><dd>${f.v}${f.sub ? `<small>${f.sub}</small>` : ""}</dd></div>`).join("");
  const emN = emergencyFilled(p), em = emergencyOf(p);
  const emDef = {
    title: `🚨 ${t("应急信息与关键位置")}`,
    hint: emN ? EMERGENCY_FIELDS.filter((f) => em[f.id]).slice(0, 4).map((f) => t(f.name)).join(" · ") : t("还没填：总水阀、燃气阀、配电箱在哪、怎么关"),
    body: emN ? `<dl class="fact-grid one">${EMERGENCY_FIELDS.filter((f) => em[f.id]).map((f) => `<div class="fact wide"><dt>${f.icon} ${t(f.name)}</dt><dd><span class="pre">${esc(em[f.id])}</span></dd></div>`).join("")}</dl>
        <p style="margin:10px 0 0"><a class="ui-btn" data-size="sm" data-tone="ghost" href="${href("house", "profile")}?sec=emergency">${t("修改")}</a></p>`
      : `${t("爆水管、跳闸、闻到燃气味时，家人打开手机就能看到总阀、配电箱、各表在哪、怎么关。")}<p style="margin:10px 0 0"><a class="ui-btn" data-size="sm" data-tone="primary" href="${href("house", "profile")}?sec=emergency">${t("现在填")}</a></p>` };
  const emBlock = `<div class="em-fold"><h3>${emDef.title}</h3><p class="muted" style="margin:0 0 8px;font-size:13px">${emDef.hint}</p>${emDef.body}</div>`;
  // 布局：先是这套房的身份卡（地址、保险、HOA 一眼可查），然后是“要做的事”（交易清单 → 本月季节任务 → 设备提醒 → 耗材提醒），
  // 最后是不常变的参考资料（归谁维护 / HOA 详情 / 材料保养），默认折叠
  return `
    ${houseBar()}
    <section class="section">
      <div class="house-card">
        <div class="house-head">
          <span class="house-ico" aria-hidden="true">${ht?.icon || "🏠"}</span>
          <div class="grow">
            <h2 class="house-name">${esc(currentProp()?.name || t(ht?.name || "我的房子"))}</h2>
          </div>
          <span class="head-acts">${moreMenu([{ label: t("详情"), href: href("house", "profile"), first: true }, ...(currentProp() && canManageHome() ? [{ label: t("归档"), action: "property-archive", data: { id: currentProp().id } }, { label: t("删除"), action: "property-delete", data: { id: currentProp().id }, danger: true }] : [])], { label: t("更多操作") })}</span>
        </div>
        ${statusLine(true)}
        <p class="muted house-sub">${esc(t(H().REGIONS[p.region]?.name || ""))}${p.year_built ? t("，{y} 年建成（约 {age} 年房龄）", { y: p.year_built, age }) : ""}</p>
        <dl class="fact-grid one">${factRows(facts.main)}</dl>
        <details class="facts-more"><summary>${t("材料设施应急")}<small>${[facts.count ? t("{n} 项", { n: facts.count }) : t("材料设施未填"), emN ? t("应急已填") : t("应急未填")].join(" · ")}</small></summary><dl class="fact-grid one">${factRows(facts.more)}</dl>${emBlock}</details>
      </div>
    </section>
    ${houseNavTiles()}
    ${suppliesRow()}

    <div class="section-head ref-head"><h2>${t("参考")}</h2><p>${t("按房型和材料整理，不常变；点开查看")}</p></div>
    ${refSection("house-owners", { title: t("哪些部位归谁维护"), hint: esc(t(ht?.desc || "")),
      body: `<div class="ch-scroll"><table class="owner-table"><tbody>${ownerRows}</tbody></table></div><p class="disclaimer">${t("这是该房型的常见情况，具体以 HOA 章程、物业服务合同或租约为准。")}</p>` })}
    ${ext.length || roof.length || floors.length ? refSection("house-care", { title: t("材料保养建议"), hint: [...ext, ...roof, ...floors].map((m) => t(m.name)).join("、"),
      body: `<div class="care-grid">${careBlock(t("外墙"), ext)}${careBlock(t("屋面"), roof)}${careBlock(t("地面"), floors)}</div><p class="disclaimer">${t("周期与寿命为常见经验值，实际以产品说明书和专业人士检查为准。")}</p>` })
      : refSection("house-care", { title: t("材料保养建议"), hint: t("还没填材料"), body: `${t("补充外墙、屋面和地面材料后，这里会给出对应的保养建议。")}<p><a class="ui-btn" data-size="sm" data-tone="ghost" href="${href("house", "profile")}">${t("补充材料")}</a></p>` })}`;
}
/** 消耗品范围：多套房产 / 有车时，每个入口只看自己的（加全家共用）；?veh= 指定某辆车，否则是当前房产。只有一套房产又没车时不分，返回 "" */
const supplyScope = () => (showOwner() ? (state.route?.q?.get("veh") ? `a:${state.route.q.get("veh")}` : `p:${state.propertyId}`) : "");
const scopedHouseItems = (scope) => state.enriched.filter(inSpace("house")).filter((x) => !scope || ownerMatch(x, scope, true));
/** 概览里的「汽车房屋消耗品」一行：点进这套房产的消耗品页 */
function suppliesRow() {
  const mine = scopedHouseItems(supplyScope()), n = alertsOf(mine).length;
  const stat = n ? t("{n} 项要补货", { n }) : mine.length ? t("{n} 种", { n: mine.length }) : t("还没有记录");
  return `<section class="section"><a class="hv-card hn-tile" href="${href("house", "supplies")}"><span class="hv-ico" aria-hidden="true">🧰</span>
    <span class="hv-txt"><b>${t("汽车房屋消耗品")}</b><small class="hn-stat">${esc(stat)}</small><small>${t("滤网、电池、融雪盐等")}</small></span>${n ? `<span class="badge b-soon mcount">${n}</span>` : ""}</a></section>`;
}
/** 房屋 / 消耗品页：始终是一页。多套房产 / 有车时只显示这一处自己的（含全家共用）；顶上「手动添加」「按房屋设备资料推荐」随时都在，右下角 ＋ 也能选 */
export function viewHouseSupplies() {
  const scope = supplyScope(), mine = scopedHouseItems(scope), alerts = alertsOf(mine), label = t("添加汽车房屋消耗品");
  const who = scope ? `${ownerIcon(scope)} ${ownerName(scope)}` : "";
  const q = scope.startsWith("a:") ? `&veh=${scope.slice(2)}` : scope ? `&prop=${scope.slice(2)}` : "";
  const buttons = `<a class="ui-btn" data-size="sm" data-tone="${mine.length ? "ghost" : "primary"}" href="${href("item", "new")}?space=house${q}">${t("手动添加")}</a>
    <a class="ui-btn" data-size="sm" data-tone="${mine.length ? "ghost" : "primary"}" href="${href("house", "template")}">${t("按房屋设备资料推荐")}</a>`;
  const body = !mine.length
    ? `<div class="panel"><div class="empty"><strong>${t("还没有汽车房屋消耗品")}</strong>${t("手动添加，或按你家的房屋和设备资料一次加好滤网、电池、融雪盐等。")}<p class="ui-acts" style="justify-content:center">${buttons}</p></div></div>`
    : `<div class="section-head"><p>${who ? `${esc(who)} · ` : ""}${t("{n} 种", { n: mine.length })}</p><div class="head-acts">${alerts.length ? `<button type="button" class="ui-btn" data-size="sm" data-tone="soft" data-action="shop-add-alerts" data-space="house" data-owner="${esc(scope)}">＋ ${t("全部加入购物车")}</button>` : ""}${buttons}</div></div>
      ${alerts.length ? `${rsHint()}<div class="panel">${restockPanel(alerts)}</div>` : ""}
      <div class="shelf" style="margin-top:10px">${shelfGrid("house", scope)}</div>
      <p style="margin-top:10px"><a class="ui-btn" data-size="sm" data-tone="ghost" href="${href("pantry", "inventory")}?space=house${scope ? `&owner=${encodeURIComponent(scope)}` : ""}">${t("看全部汽车房屋消耗品")} ›</a></p>`;
  return `${houseBar()}<section class="section">${body}</section>
    <button type="button" class="fab" data-action="supply-add-pick" data-scope="${esc(q)}" aria-label="${esc(label)}" title="${esc(label)}"><span aria-hidden="true">＋</span></button>`;
}
/* ── 概览里的设备与季节任务摘要（第二期） ── */
function assetsPanel() {
  const list = myAssets(), alerts = assetAlerts(list);
  const body = !list.length
    ? `<div class="empty"><strong>${t("还没有设备档案")}</strong>${t("按房屋资料一次生成炉子、热水器、排水泵等设备，记录保修和保养周期。")}<p><a class="ui-btn" data-tone="primary" href="${href("house", "asset-template")}">${t("生成设备清单")}</a></p></div>`
    : alerts.length
      ? `<ul class="restock-list">${alerts.slice(0, 4).map((a) => { const b = alertBadge(a), act = alertAct(a); return dotRow({ cls: b.cls, nameHtml: `<a class="link-name" href="${href("asset", a.id)}">${a.t?.icon || "⚙️"} ${esc(assetName(a))}</a>`,
          badge: b, detail: alertText(a), primary: { href: act.href, label: act.label }, menu: assetMenu(a), ask: assetAsk(a) }); }).join("")}</ul>`
      : `<div class="empty"><strong>${t("{n} 台设备，保养都在周期内", { n: list.length })}</strong></div>`;
  return `<section class="section">
    <div class="section-head"><h2>${t("设备档案")}</h2><div class="head-acts">
      ${list.length ? `<a class="ui-btn" data-size="sm" data-tone="ghost" href="${href("house", "asset-template")}">${t("生成更多")}</a>` : ""}
      <a class="ui-btn" data-size="sm" data-tone="ghost" href="${href("house", "assets")}">${t("全部设备")}${list.length ? `（${list.length}）` : ""}</a></div></div>
    <div class="panel">${body}</div>
  </section>`;
}
/** 本月季节任务：全部列出，做完的保留并打勾（不隐藏），未做的在前 */
function tasksPanel() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth() + 1;
  const list = monthTasks(y, m);
  if (!list.length) return "";
  const undone = list.filter((x) => !x.done), done = list.filter((x) => x.done);
  return `<section class="section">
    <div class="section-head"><h2>${t("{month}季节任务", { month: monthName(m) })}</h2><div class="head-acts"><p>${undone.length ? t("还有 {n} 项没做", { n: undone.length }) : t("本月都做完了")}</p>
      <a class="ui-btn" data-size="sm" data-tone="ghost" href="${href("house", "tasks")}">${t("全年任务")}</a></div></div>
    <div class="panel">
      ${undone.length ? `<ul class="task-list">${undone.map((x) => taskRow(x, y, m)).join("")}</ul>` : `<div class="empty"><strong>${t("本月都做完了")}</strong></div>`}
      ${done.length ? `<details class="done-fold"><summary>${t("已完成 {n} 项", { n: done.length })}</summary><ul class="task-list">${done.map((x) => taskRow(x, y, m)).join("")}</ul></details>` : ""}
    </div>
  </section>`;
}
/** 进行中交易的清单：未做的按到期排在前，做完的保留在后打勾 */
function dealPanel() {
  const d = openDeal(currentProp()?.id); if (!d) return "";
  const tasks = dealTasks(d).filter((x) => !x.skipped);   // 已跳过的不在这里显示
  if (!tasks.length) return "";
  const undone = tasks.filter((x) => !x.done).sort((a, b) => (a.due || "9").localeCompare(b.due || "9")), done = tasks.filter((x) => x.done);
  return `<section class="section">
    <div class="section-head"><h2>${t("{kind}清单", { kind: t(window.DEALS.KINDS[d.kind]) })}</h2><div class="head-acts"><p>${t("已完成 {a} / {b}", { a: done.length, b: tasks.length })}</p>
      <a class="ui-btn" data-size="sm" data-tone="ghost" href="${dealHref(d)}">${t("交易页")}</a></div></div>
    <div class="panel"><ul class="task-list">${[...undone.slice(0, 8), ...done.slice(-4)].map((x) => dealTaskRow(x)).join("")}</ul>
      ${undone.length > 8 ? `<p class="muted" style="margin:8px 0 0">${t("还有 {n} 项，", { n: undone.length - 8 })}<a href="${dealHref(d)}">${t("去交易页查看")}</a></p>` : ""}</div>
  </section>`;
}
/** HOA 常规费用（只读）：来自 HOA 账单；资料里以前填的单元 / 车位 / 其他月费和周期放在隐藏字段里原样保存（不丢），没账单时显示旧值并给预填的「创建账单」 */
function hoaDuesReadonly(d, hoa) {
  const reg = hoaRegular(curPid(), hoa);
  const hidden = [["hoa_dues", hoa.dues], ["hoa_dues_unit", hoa.dues_unit], ["hoa_dues_parking", hoa.dues_parking], ["hoa_dues_other", hoa.dues_other], ["hoa_dues_other_label", hoa.dues_other_label], ["hoa_dues_period", hoa.dues_period || "monthly"]]
    .map(([n, v]) => `<input type="hidden" name="${n}" value="${esc(v ?? "")}">`).join("");
  const split = reg.src === "profile" && (hoa.dues_unit || hoa.dues_parking || hoa.dues_other)
    ? ` <small class="muted">(${[hoa.dues_unit ? t("单元 {a}", { a: money(hoa.dues_unit) }) : "", hoa.dues_parking ? t("车位 {a}", { a: money(hoa.dues_parking) }) : "", hoa.dues_other ? `${esc(hoa.dues_other_label || t("其他"))} ${money(hoa.dues_other)}` : ""].filter(Boolean).join(" + ")})</small>` : "";
  const link = amountSource(reg.src, reg.bill, "hoa", curPid(), { amount: reg.legacy, freq: reg.freq, name: hoa.name ? `HOA · ${hoa.name}`.slice(0, 60) : t("HOA 月费"), payee: hoa.name || hoa.mgmt || "" });
  return `${hidden}<div class="span-2 form-field ro-field"><span class="field-label">${t("常规费用")}</span><span>${reg.src ? `<b>${reg.text}</b>${split} · ` : `<span class="muted">${t("未填")}</span> · `}${link}</span><small>${t("金额在账单里改：账单是唯一来源，预算和现金流都按它算")}</small></div>`;
}
/** 资料表单里的 HOA / 物业区块：叫法和默认值按当前房型 */
export function hoaFieldset(d) {
  const a = H().assocOf(d.house_type), hoa = hoaOf(d), label = t(a.label);
  return `<fieldset id="hoa">
    <legend>${esc(label)}</legend>
    <label class="check-inline" style="margin-bottom:8px"><input type="checkbox" name="hoa_enabled" ${hoa.enabled ? "checked" : ""}><span>${t("有 {label}（按房型默认，可改）", { label })}</span></label>
    <div class="form-grid">
      <label>${t("名称")}<input name="hoa_name" maxlength="80" placeholder="${t("例如：Lakeview Condominium Association")}" value="${esc(hoa.name || "")}"></label>
      <label>${t("管理公司 / 联系人")}<input name="hoa_mgmt" maxlength="80" value="${esc(hoa.mgmt || "")}"></label>
      <label>${t("电话")}<input name="hoa_phone" type="tel" maxlength="40" value="${esc(hoa.phone || "")}"></label>
      <label>${t("邮箱")}<input name="hoa_email" type="email" maxlength="120" value="${esc(hoa.email || "")}"></label>
      <label class="span-2">${t("业主门户 / 缴费网址")}<input name="hoa_url" type="url" maxlength="200" placeholder="https://" value="${esc(hoa.url || "")}"></label>
      ${hoaDuesReadonly(d, hoa)}
      <div class="span-2 hoa-total" data-hoa-total>${hoaTotalHtml(hoa)}</div>
      <p class="hint span-2" style="margin:0">${t("特别摊派（屋顶、电梯这类大额摊款）已搬到 HOA 账单里管理：分期、一次性结清、每一期是哪次缴费交的都在那里。")} ${(() => { const b = hoaRegular(state.propertyId, hoa).bill; return b ? `<a href="${href("bill", b.id)}?sec=assess">${t("去 HOA 账单的特别摊派")}</a>` : ""; })()}</p>
    </div>
    <h4 class="sub-legend">${t("出租规则")}<small>${t("公寓常见：出租比例上限、最短租期、要不要 HOA 审批；买前、想出租前都要看")}</small></h4>
    <div class="form-grid">
      <label>${t("能不能出租")}<select name="hoa_rent_policy">${RENT_POLICIES.map(([k, n]) => `<option value="${k}" ${(hoa.rent_policy || "unknown") === k ? "selected" : ""}>${t(n)}</option>`).join("")}</select></label>
      <label>${t("出租比例上限 %")}<input name="hoa_rent_cap" ${numAttrs("rate", { step: 1 })} value="${hoa.rent_cap_pct ?? ""}"></label>
      <label>${t("最短租期（月）")}<input name="hoa_rent_min" ${numAttrs("int")} value="${hoa.rent_min_months ?? ""}"></label>
      <label class="span-2">${t("说明")}${noteArea("hoa_rent_notes", hoa.rent_notes, t("例如：需自住满 1 年；出租名额已满，轮候中"))}</label>
    </div>
    <h4 class="sub-legend">${t("诉讼与纠纷")}<small>${t("HOA 正在打的官司会影响贷款和转手；买卖前问 22.1 披露")}</small></h4>
    <label class="check-inline"><input type="checkbox" name="hoa_lawsuit" ${hoa.lawsuit ? "checked" : ""}><span>${t("HOA / 楼盘目前有诉讼或纠纷")}</span></label>
    <div style="margin-top:6px">${noteArea("hoa_lawsuit_note", hoa.lawsuit_note, t("例如：和开发商的渗水诉讼，2025 年起；储备金是否受影响"))}</div>
    <h4 class="sub-legend">${t("规则与限制")}<small>${t("宠物、装修审批、停车、安静时段、搬家预约等")}</small></h4>
    <textarea name="hoa_rules" rows="3" maxlength="2000" placeholder="${t("例如：最多 2 只宠物、出租需满 1 年自住、装修 9–17 点、访客停车 48 小时")}">${esc(hoa.rules || "")}</textarea>
    <label style="display:block;margin-top:8px">${t("备注")}${noteArea("hoa_notes", hoa.notes, t("例如：年会 3 月、储备金研究 2025、门禁码在钥匙盒"))}</label>
    ${a.tips.length ? `<details class="hoa-tips" style="margin-top:10px"><summary>${t("{label}须知（{type}）", { label, type: t(H().typeOf(d.region, d.house_type)?.name || "") })}</summary><ul class="tips">${a.tips.map((x) => `<li>${esc(t(x))}</li>`).join("")}</ul></details>` : ""}
  </fieldset>`;
}
