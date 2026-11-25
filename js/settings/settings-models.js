/* 设置：AI 模型下拉（常用免费模型目录 + 这个 key 实际能用的列表）和 AI 设置。 */
import { numAttrs } from "../core/ui-num.js";
import { AUTH_STYLES, FREE_MODELS, FREE_MODELS_AS_OF, aiChanges, aiIcon, aiQuota, aiReady, autoModel, catalogAgeDays, effective, listModels, modelInfo, modelsCachedAt } from "../core/ai.js";
import { DATE_FMTS, dateFormat, esc, fmtDay, toast } from "../core/util.js";
import { LANGS, detectLang, langOverride, t } from "../core/i18n.js";
import { PAGE_SIZES, pageSize } from "../core/pager.js";
import { PROVIDERS, aiSettings, providerOf } from "../core/ai-common.js";
import { SETTING_SECTIONS, quotaBlock, saveAiForm } from "./settings-menu.js";
import { Store } from "../core/store.js";
import { backupPanel, backupSummary } from "./backup-views.js";
import { categoriesPanel, locationsPanel, termsPanel } from "./settings-names.js";
import { customLocations } from "../core/locations.js";
import { peoplePanel, personPage } from "./family-people.js";
import { famMembers, viewMemberProfile } from "./members.js";
import { financeOk } from "../core/finance-access.js";
import { href } from "../core/router.js";
import { moneyHidden } from "../core/privacy.js";
import { state } from "../core/state.js";
import { tempUnitPref } from "../core/weather.js";
import { usageHTML } from "../core/usage.js";
import { viewPrintSettings } from "./print.js";
import { inviteLine, isOwner, pendingList, sisterAppsPanel } from "./settings-common.js";
import { financeRequestCard, financeRequestsPanel } from "./finance-request.js";
import { deviceLinkPrompt } from "./family-lite.js";

/* ── 模型下拉：常用免费模型目录（带上限）+ 这个 key 实际能用的列表（画出来后后台查，缓存一天）；没有目录的服务商仍是手填 ── */
const modelOption = (pid, m, cur) => {
  const lim = m.rpm ? ` · ${t("{a}/分 · {b}/天", { a: m.rpm, b: m.rpd })}` : m.live ? ` · ${t("上限以控制台为准")}` : "";
  return `<option value="${esc(m.id)}" ${m.id === cur ? "selected" : ""} ${m.dead ? "disabled" : ""}>${esc(t(m.name))}${m.name !== m.id ? ` (${esc(m.id)})` : ""}${lim}${m.dead ? `（${t("这个 key 已不可用")}）` : ""}</option>`;
};
export const modelOptionsHtml = (pid, list, cur, custom) => `<option value="">${t("自动：按这个 key 能用的模型自动选（推荐）")}</option>${list.map((m) => modelOption(pid, m, custom ? "" : cur)).join("")}${cur && !custom && !list.some((m) => m.id === cur) ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : ""}<option value="__custom" ${custom ? "selected" : ""}>${t("其他（手填模型名）…")}</option>`;
export function limitHint(pid, id) {
  if (!id) return t("自动：按可用列表从新到旧试，某个模型超限或下线会自动换下一个。上限用下面的默认值。");
  const m = modelInfo(pid, id);
  if (m?.rpm) return t("免费档公布值：每分钟 {a} 次、每天 {b} 次，已带入下面的上限（会变，以控制台为准）。它超限或下线时仍会自动换别的模型。", { a: m.rpm, b: m.rpd });
  return t("这个模型的免费上限目录里没有：下面的上限留空用默认值，或按控制台 Rate limits 页手填。");
}
function modelField(s, p) {
  if (!FREE_MODELS[p.id]) return `<label>${t("模型名（留空用默认）")}<input name="model" maxlength="80" placeholder="${esc(autoModel(p.id) || p.model)}" value="${esc(s.model)}"></label>`;
  const cur = s.model || "", list = FREE_MODELS[p.id].filter((m) => m.free !== false).map((m) => ({ ...m, live: false })), custom = !!cur && !list.some((m) => m.id === cur) && !(autoModel(p.id) === cur);
  return `<label class="span-2">${t("模型")}<select name="modelSel" data-provider="${p.id}">${modelOptionsHtml(p.id, list, cur, custom)}</select>
      <small id="modelLimitHint">${limitHint(p.id, custom ? "" : cur)}</small></label>
    <div class="span-2 model-refresh"><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" id="modelRefreshBtn" data-action="ai-models-refresh">↻ ${t("刷新模型列表")}</button><small id="modelListNote" class="muted">${t("正在查这个 key 实际能用的模型…")}</small></div>
    <div class="span-2" id="modelNotices">${modelNotices(p.id, cur, null)}</div>
    <label class="span-2" id="modelCustomWrap" ${custom ? "" : "hidden"}>${t("模型名（照服务商控制台里的写）")}<input name="model" maxlength="80" placeholder="${esc(p.model)}" value="${esc(cur)}"></label>`;
}
/** 目录 / 模型列表 / 额度和现实对不上时的提醒；live = 刚查到的实际列表（没查到是 null） */
export function modelNotices(pid, cur, live) {
  const age = catalogAgeDays(), rows = [];
  const fld = { rpd: t("每天"), rpm: t("每分钟") };
  for (const c of aiChanges(pid)) {
    if (c.type === "limit") rows.push(`⚠️ ${t("Google 返回的 {m} {f}上限是 {n} 次，目录里是 {w}，已按实际的更新。", { m: esc(c.model), f: fld[c.field], n: c.now, w: c.was ?? t("没有") })}`);
    else rows.push(`🔔 ${t("这个 key 的模型列表有变化：")}${c.added?.length ? ` ${t("新增")} ${c.added.map(esc).join("、")}` : ""}${c.removed?.length ? ` ${t("下线")} ${c.removed.map(esc).join("、")}` : ""}`);
  }
  if (cur && live && !live.some((m) => m.id === cur && m.live)) rows.push(`⚠️ ${t("你选的 {m} 已不在这个 key 的可用列表里，会自动换别的模型；建议改选“自动”或另一个。", { m: esc(cur) })}`);
  const ageTxt = FREE_MODELS[pid] ? t("免费上限目录更新于 {d}（{n} 天前）", { d: FREE_MODELS_AS_OF, n: age }) + (age > 45 ? `，${t("可能已过期，上限以控制台为准")}` : "") : "";
  return `${rows.length ? `<div class="notice-box" role="status">${rows.map((r) => `<p>${r}</p>`).join("")}<button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="ai-notice-dismiss" data-provider="${pid}">${t("知道了")}</button></div>` : ""}
    ${ageTxt ? `<p class="muted" style="margin:6px 0 0;font-size:12.5px">${ageTxt}</p>` : ""}`;
}
/** 画出设置页后：后台查实际可用的模型，把下拉换成真实列表（选中项不变） */
export async function hydrateModelSelect({ refresh = false } = {}) {
  const sel = document.querySelector("#aiSettingsForm [name=modelSel]"); if (!sel) return false;
  const pid = sel.dataset.provider, btn = document.getElementById("modelRefreshBtn"), before = modelsCachedAt(pid);
  if (btn) btn.disabled = true;
  let list; try { list = await listModels(pid, { refresh }); } finally { if (btn) btn.disabled = false; }
  const sel2 = document.querySelector("#aiSettingsForm [name=modelSel]"); if (!sel2 || sel2.dataset.provider !== pid) return false;
  const shown = list.filter((m) => m.free !== false);   // 免费档额度为 0 的不列（Pro、2 Flash 等）
  const custom = sel2.value === "__custom", cur = sel2.form.elements.model.value.trim();
  sel2.innerHTML = modelOptionsHtml(pid, shown, cur, custom);
  const nb = document.getElementById("modelNotices"); if (nb) nb.innerHTML = modelNotices(pid, cur, list);   // 刚查到的列表可能带来新的“下线 / 新增”提醒
  const note = document.getElementById("modelListNote");
  const at = modelsCachedAt(pid), when = at ? new Date(at).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  if (note) note.textContent = list.some((m) => m.live) ? t("列表是这个 key 实际能用的模型（每天自动查一次，也可手动刷新；上次 {when}）；灰色的是已对这个 key 下线的。", { when }) : t("还没查到实际列表（填好 key 并保存后会查），先列常用的。");
  return at > before;   // 这次真的查到了新列表
}
/** 下拉选了模型：同步到隐藏的模型名输入框，带入上限，自动保存 */
export async function onModelPick(sel) {
  const f = sel.form, wrap = document.getElementById("modelCustomWrap"), custom = sel.value === "__custom", pid = sel.dataset.provider;
  wrap.hidden = !custom;
  if (custom) { f.elements.model.value = ""; f.elements.model.focus(); return; }
  f.elements.model.value = sel.value;
  const m = modelInfo(pid, sel.value);
  f.elements.rpm.value = m?.rpm ? m.rpm : ""; f.elements.rpd.value = m?.rpd ? m.rpd : "";
  const h = document.getElementById("modelLimitHint"); if (h) h.textContent = limitHint(pid, sel.value);
  await saveAiForm(f); toast(sel.value ? t("已选 {m}，上限已带入并保存", { m: sel.value }) : t("已改回自动选模型"));
}
function aiBlock() {
  const s = aiSettings(), p = providerOf(s.provider), custom = p.id === "custom";
  const COST = { free: t("免费额度"), cheapest: t("最便宜"), cheap: t("便宜"), mid: t("中等") };
  return `<form id="aiSettingsForm" class="panel">
    <p class="muted" style="margin:0 0 10px;font-size:13px">${t("key 只保存在这台设备的浏览器里，不进仓库也不进数据库；浏览器直连模型，家人各自填自己的。没填 key 时菜单助手会改成“复制提示词”模式，照样能用。")}</p>
    <div class="form-grid">
      <label>${t("模型服务")}<select name="provider">${PROVIDERS.map((x) => `<option value="${x.id}" ${x.id === s.provider ? "selected" : ""}>${esc(t(x.name))}${COST[x.cost] ? ` · ${COST[x.cost]}` : ""}</option>`).join("")}</select>
        <small>${esc(t(p.hint || ""))}${p.signup ? ` <a href="${p.signup}" target="_blank" rel="noopener noreferrer">${t("去申请 key")}</a>` : ""}</small></label>
      <label>${t("API key")}<input name="key" type="password" autocomplete="off" maxlength="300" value="${esc(s.key)}" placeholder="${esc(p.keyPrefix ? `${[].concat(p.keyPrefix)[0]}…` : "sk-…")}">
        <small>${esc(t(p.keyHint || "在服务商控制台创建 API key，整段粘贴到这里"))}</small></label>
      <label>${t("家庭人数（菜单份量）")}<input name="people" ${numAttrs("int", { max: 20, min: 1, step: null })} value="${s.people || 4}"></label>
    </div>
    ${custom ? "" : `<p class="hint">${t("模型名和接口地址已内置（{model}），一般不用改；要换模型再展开下面的“高级”。", { model: effective(s, p).model })}${s.model || s.base ? ` <button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="ai-clear-adv">${t("清掉手填的模型名 / 地址")}</button>` : ""}</p>`}
    <details class="adv" ${custom ? "open" : ""}><summary>${custom ? t("接口地址、模型与鉴权（自定义必填）") : t("高级：换模型 / 自定义接口地址")}</summary>
      <div class="form-grid" style="margin-top:8px">
        ${modelField(s, p)}
        <label>${t("接口地址（自定义时填）")}<input name="base" maxlength="200" placeholder="${esc(p.base || "https://…/v1")}" value="${esc(s.base)}"><small>${t("要填真正的 API 域名（到 /v1 为止），不是官网；401 多半是 key 和地址不配")}</small></label>
        <label>${t("鉴权头（自定义时）")}<select name="auth">${Object.entries(AUTH_STYLES).map(([k, n]) => `<option value="${k}" ${(s.auth || "bearer") === k ? "selected" : ""}>${t(n)}</option>`).join("")}</select></label>
      </div>
    </details>
    ${quotaBlock(s, p)}
    <div class="form-actions" style="margin-top:10px"><button type="submit" class="ui-btn" data-size="sm" data-tone="primary">${t("保存")}</button>
      <button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="ai-test">${t("测试连接")}</button><span id="aiTestOut" class="muted"></span></div>
    <p class="hint">${t("性价比：DeepSeek、通义千问 qwen-turbo、豆包 lite 一次菜单约几分钱；Gemini Flash 有免费额度。只用于生成菜单，不会上传备注等个人信息。")}</p>
  </form>`;
}
export function viewSettings() {
  const cloud = Store.mode === "cloud";
  const notif = "Notification" in window ? Notification.permission : "unsupported";
  const sec = state.route?.q?.get("sec");
  const meta = SETTING_SECTIONS.find((s) => s.id === sec);
  if (!meta) {
    const status = {
      family: cloud ? t("{name} · {n} 位成员", { name: state.household?.name || "", n: state.members.length }) : t("本地演示：数据只保存在这个浏览器里"),
      prefs: `${LANGS[langOverride() || detectLang()]} · ${t(Units.region.name)} · ${Units.region.currency}`,
      categories: t("{n} 个分类 · 自建 {m} · 改过 {k}", { n: CATEGORIES.filter((c) => !c.hidden).length, m: CATEGORIES.filter((c) => c.custom).length, k: CATEGORIES.filter((c) => c.overridden).length }),
      locations: t("{n} 个位置 · 自定义 {m}", { n: window.LOCATIONS.length, m: customLocations().length }),
      modules: [state.houseEnabled ? t("房屋 ✓") : t("房屋 ✗"), state.billsEnabled ? t("账单 ✓") : t("账单 ✗"), state.gearEnabled ? t("家居耐用品 ✓") : t("家居耐用品 ✗")].join(" · "),
      print: state.billsEnabled ? t("购物车、账单概览") : t("购物车"),
      data: notif === "granted" ? t("通知已开启") : t("通知未开启"),
      backup: financeOk() ? backupSummary() : t("需要财务权限"),
      usage: cloud ? t("数据库与文件存储，对照免费额度") : t("本地演示：没有云端空间"),
      ai: aiReady() ? `${t("{p} · 已填 key", { p: t(providerOf(aiSettings().provider).name) })}${(() => { const q = aiQuota(); return q.cap ? ` · ${t("今天 {n}/{cap}", { n: q.used, cap: q.cap })}` : ""; })()}` : t("未填 key，用“复制提示词”模式"),
      apps: t("小月亮、家庭学堂；介绍与注意事项"),
    };
    return `<section class="section menu-page"><div class="section-head"><p>${t("家庭、房产、语言、存放位置、模块、同步与备份、AI、姐妹站点")}</p></div>
      <div class="panel mlist">${SETTING_SECTIONS.map((s) => `<a class="ui-row mrow" href="${href("me", "settings")}?sec=${s.id}"><span class="mi" aria-hidden="true">${s.icon === "__AI__" ? aiIcon(24) : s.icon}</span><span class="mt"><b>${t(s.name)}</b><small>${esc(status[s.id])}</small></span><span class="ui-chev" aria-hidden="true">›</span></a>`).join("")}</div>
      <div class="form-actions" style="margin-top:14px">${cloud ? `<button type="button" class="ui-btn" data-tone="danger" data-action="logout">${t("退出登录")}</button>` : `<button type="button" class="ui-btn" data-tone="danger" data-action="reset-demo">${t("恢复演示数据")}</button>`}</div>
    </section>`;
  }
  const sw = (id, on, title, desc) => `<div class="panel"><div class="kv"><div><b>${title}</b><div class="muted">${desc}</div></div>
      <label class="switch"><input type="checkbox" id="${id}" ${on ? "checked" : ""}><span>${on ? t("已打开") : t("已关闭")}</span></label></div></div>`;
  const blocks = {
    family: () => {
      const q = state.route.q;
      if (q.get("person")) return personPage(q.get("person"));
      if (q.get("member")) { const m = famMembers().find((x) => x.user_id === q.get("member")); return m?.person_id ? personPage(m.person_id) : viewMemberProfile(q.get("member")); }   // 旧的设备资料链接：转到这台设备所属的家庭成员
      return `
    <div class="panel">
      <div class="kv"><div><b>${esc(state.household?.name || "")}</b><div class="muted">${cloud ? t("云端协同：家人修改会实时同步") : t("本地演示：数据只保存在这个浏览器里")}</div></div>
        ${cloud ? `<a class="ui-btn" data-size="sm" data-tone="ghost" href="${href("me", "settings")}?sec=backup">${t("同步与备份")} ›</a>` : ""}</div>
      ${cloud && state.households.length > 1 ? `<label style="display:grid;gap:4px;margin-top:12px">${t("切换家庭")}<select id="hhSwitch">${state.households.map((h) => `<option value="${h.id}" ${h.id === state.household.id ? "selected" : ""}>${esc(h.name)}</option>`).join("")}</select></label>` : ""}
    </div>
    ${cloud ? `
    <div class="panel">
      <div class="kv"><div><div class="muted">${t("邀请家人：把这个邀请码发给他们")}</div><div class="code">${esc(state.household.invite_code)}</div><div class="muted small">${inviteLine()}</div></div>
        <div class="head-acts"><button type="button" class="ui-btn" data-size="sm" data-action="copy-invite">${t("复制邀请码")}</button>
          ${isOwner() ? `<button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="rotate-invite">${t("重新生成")}</button><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="close-invite">${t("关闭邀请")}</button>` : ""}</div></div>
      <p class="muted" style="font-size:12px;margin:8px 0 0">${t("家人用邀请码申请加入（不用收邮件），邀请码 7 天有效；申请后要家主在这里批准才能进来。邀请码泄露了或家人都加好了，请家主点「重新生成」或「关闭邀请」，旧码立即失效，已加入的家人不受影响。")}</p>
      ${state.user?.is_anonymous ? `<p class="muted" style="font-size:12px;margin:6px 0 0">${t("你是通过邀请码直接进入的，身份保存在本设备浏览器里；清除浏览器数据或换手机后需要重新用邀请码进入。")}</p>` : ""}
    </div>` : ""}
    ${cloud ? deviceLinkPrompt() : ""}
    ${cloud ? pendingList() : ""}
    ${cloud ? financeRequestsPanel() : ""}
    ${cloud ? financeRequestCard() : ""}
    ${peoplePanel()}
    ${cloud ? "" : `    <div class="panel config-diag">
      <b>${t("为什么还是本地演示模式")}</b>
      <p>${esc(t(state.configIssue || "没有检测到 Supabase 配置。"))}</p>
      <p class="muted" style="margin:0">${t("自查：在浏览器打开 {link}，确认看到的是你填好的地址和 key；改完后等 1–2 分钟，再按 Ctrl+F5（Mac：Cmd+Shift+R）强制刷新。", { link: `<a href="config.js" target="_blank" rel="noopener">${t("本站的 config.js")}</a>` })}</p>
    </div>`}`;
    },
    prefs: () => `
    <div class="panel">
      <label class="field-label" for="langSel">${t("语言")}</label>
      <select id="langSel">
        <option value="" ${!langOverride() ? "selected" : ""}>${t("自动（检测为{lang}）", { lang: LANGS[detectLang()] })}</option>
        ${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${langOverride() === k ? "selected" : ""}>${v}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${t("繁體中文由简体自动转换；English 没有翻译到的文案会显示中文。自己起的位置 / 分类 / 小类名字可以在下面填各语言叫法；物品名称不翻译。")}</p>
    </div>
    ${termsPanel()}
    <div class="panel">
      <label class="field-label" for="regionSel">${t("地区与单位")}</label>
      <select id="regionSel">
        <option value="" ${!Units.override ? "selected" : ""}>${t("自动（检测为{region}{tz}）", { region: esc(t(Units.detected().name)), tz: Units.timeZone() ? t("，时区 {tz}", { tz: esc(Units.timeZone()) }) : "" })}</option>
        ${Object.values(Units.REGIONS).map((r) => `<option value="${r.id}" ${Units.override === r.id ? "selected" : ""}>${t(r.name)}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${t("当前：{units}，货币 {cur}。", { units: Units.region.system === "us" ? t("美制单位 lb、oz、fl oz、qt、gal") : t("公制单位 kg、g、斤、L、mL"), cur: Units.region.currency })}
        ${t("已有物品按原单位保存，显示时自动换算；按“个、盒、袋”计数的物品不换算。")}</p>
    </div>
    <div class="panel">
      <label class="field-label" for="dateFmtSel">${t("日期格式")}</label>
      <select id="dateFmtSel" data-nosearch>
        ${DATE_FMTS.map((k) => `<option value="${k}" ${dateFormat() === k ? "selected" : ""}>${esc(k === "auto" ? t("跟随语言（{ex}）", { ex: fmtDay(new Date(), false, "auto") }) : fmtDay(new Date(), false, k) + ({ ymd: "  (YYYY-MM-DD)", mdy: "  (MM/DD/YYYY)", dmy: "  (DD/MM/YYYY)", cn: "" }[k] || ""))}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${t("花费、收入、账单等列表里的日期都按这个显示，按金额 / 名称排序时也看得出年月。只存在这台设备上；导出的 CSV 仍是 YYYY-MM-DD。")}</p>
    </div>
    ${financeOk() ? `<div class="panel">
      <label class="field-label" for="moneyModeSel">${t("金额显示")}</label>
      <select id="moneyModeSel" data-nosearch>
        <option value="hide" ${moneyHidden() ? "selected" : ""}>${t("遮挡（外出）：大数字模糊，点一个看 10 秒")}</option>
        <option value="show" ${moneyHidden() ? "" : "selected"}>${t("常显示（在家）")}</option>
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${t("今日「钱 · 本月」和财务各页看板上的大数字。也可以在那里点眼睛：单击全部显示 10 秒，双击或长按切换模式。常显示时页面在后台超过 30 分钟，回来自动切回遮挡。只存在这台设备上。")}</p>
    </div>` : ""}
    <div class="panel">
      <label class="field-label" for="tempUnitSel">${t("温度单位")}</label>
      <select id="tempUnitSel" data-nosearch>
        ${[["auto", t("跟随地区（现在是 {u}）", { u: Units.region.system === "us" ? "°F" : "°C" })], ["c", t("摄氏 °C")], ["f", t("华氏 °F")]].map(([k, l]) => `<option value="${k}" ${tempUnitPref() === k ? "selected" : ""}>${esc(l)}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${t("今日页日期旁的天气用这个单位。只存在这台设备上。")}</p>
    </div>
    <div class="panel">
      <label class="field-label" for="pageSizeSel">${t("列表每次显示")}</label>
      <select id="pageSizeSel" data-nosearch>
        ${PAGE_SIZES.map((n) => `<option value="${n}" ${pageSize() === n ? "selected" : ""}>${t("{n} 条", { n })}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${t("花费、缴费、收入、库存、设备等长列表先显示这么多条，往下点“继续加载”再看更多。只存在这台设备上；没改过时手机 10 条、电脑 20 条。")}</p>
    </div>`,
    modules: () => `
    ${sw("houseToggle", state.houseEnabled, t("房屋维护模块"), t("关闭后导航和首页只显示日常消耗品，适合租房或不需要的家庭；数据不会删除"))}
    ${sw("billsToggle", state.billsEnabled, t("财务模块"), t("水电气、网络、HOA、房产税、房贷、保险等周期账单的提醒与记录；关闭后导航里不再显示，数据不会删除"))}
    ${sw("gearToggle", state.gearEnabled, t("家居耐用品模块"), t("床品、电器、自行车、工具等耐用品，只记数量和位置；关闭后储藏里不再显示“家居耐用品”，数据不会删除"))}`,
    data: () => `
    <div class="panel"><div class="kv"><div><b>${t("浏览器通知")}</b><div class="muted">${t("打开网页时，若有新的缺货或少货会弹出提醒")}</div></div>
      ${notif === "granted" ? `<span class="badge b-ok">${t("已开启")}</span>` : notif === "unsupported" ? `<span class="muted">${t("此浏览器不支持")}</span>` : `<button type="button" class="ui-btn" data-size="sm" data-action="notif">${t("开启通知")}</button>`}</div></div>
    `,
    backup: () => (financeOk() ? backupPanel() : `<div class="panel"><p style="margin:0">${t("备份里有全家的收入、预算和对账单，只有家主和有财务权限的家人能备份、恢复。数据本身已经实时存在云端。")}</p></div>`),
    usage: () => `<p class="muted" style="margin:0 0 10px">${t("看看数据占了 Supabase 免费空间的多少，快满之前会变黄、变红提醒你。")}</p>${usageHTML()}`,
    ai: () => aiBlock(),
    print: () => viewPrintSettings(),
    locations: () => locationsPanel(),
    categories: () => categoriesPanel(),
    apps: () => `
    ${sisterAppsPanel()}
    <div class="panel"><div class="kv"><div><b>${t("介绍与注意事项")}</b><div class="muted">${t("这个网站是什么、第一次怎么用、提醒怎么分级、哪些事要注意")}</div></div>
      <a class="ui-btn" data-size="sm" href="${href("me", "about")}">${t("查看介绍")}</a></div></div>`,
  };
  // 面包屑“‹ 我的 / 设置 / 家庭与成员”由 menu.js 统一画，这里不再另起标题行
  return `<section class="section"><div class="settings">${blocks[meta.id]()}</div></section>`;
}
