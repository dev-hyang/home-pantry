import { alertsOf, hasStock, memberName, openShopFor } from "../core/logic.js";
import { STATUS, state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, catOf, catsOf, esc, fmt, inSpace, isGear, money, num, showQty } from "../core/util.js";
import { href } from "../core/router.js";
import { lastStore, storeDatalist } from "../stats/views.js";

/* ── 概览（储藏 / 房屋耗材共用）── */
export function restockPanel(alerts, limit = 8) {
  if (!alerts.length) return "";
  return `<ul class="restock-list">${alerts.slice(0, limit).map((it) => {
    const inList = openShopFor(it.id);
    return `<li>
      <span class="badge ${STATUS[it.status].cls}">${STATUS[it.status].label}</span>
      <div class="grow"><button type="button" class="link-name" data-action="edit" data-id="${it.id}">${esc(it.name)}</button>
        <small>剩 ${fmt(it.dqty)} ${esc(it.du)}${it.daysLeft != null && it.qty > 0 ? `，约够 ${Math.max(0, Math.floor(it.daysLeft))} 天` : ""}，建议买 ${fmt(it.dsuggest)} ${esc(it.du)}</small></div>
      ${inList ? `<span class="badge b-ok">已在清单</span>` : `<button type="button" class="btn btn-sm" data-action="shop-add-item" data-id="${it.id}">加入采购</button>`}
    </li>`;
  }).join("")}</ul>`;
}

export function shelfGrid(space) {
  const list = state.enriched.filter(inSpace(space));
  return catsOf(space).map((c) => {
    const inCat = list.filter((x) => x.category === c.id);
    if (!inCat.length) return "";
    // 装备没有库存状态：只显示件数和位置
    if (space === "gear") {
      const locs = [...new Set(inCat.map((x) => x.location).filter(Boolean))];
      return `<button type="button" class="shelf-cell" style="--cat:${c.color}" data-action="goto-cat" data-space="${space}" data-cat="${c.id}">
        <span class="ico" aria-hidden="true">${c.icon}</span><h3>${c.name}</h3>
        <p>${inCat.length} 种${locs.length ? `，在${esc(locs.slice(0, 2).join("、"))}${locs.length > 2 ? "等" : ""}` : ""}</p>
      </button>`;
    }
    const cnt = (s) => inCat.filter((x) => x.status === s).length;
    const seg = (s, color) => cnt(s) ? `<i style="width:${(cnt(s) / inCat.length) * 100}%;background:${color}"></i>` : "";
    const bad = inCat.length - cnt("ok");
    return `<button type="button" class="shelf-cell" style="--cat:${c.color}" data-action="goto-cat" data-space="${space}" data-cat="${c.id}">
      <span class="ico" aria-hidden="true">${c.icon}</span><h3>${c.name}</h3>
      <p>${inCat.length} 种${bad ? `，${bad} 种需补` : "，都充足"}</p>
      <div class="mix" aria-hidden="true">${seg("out", "var(--out)")}${seg("low", "var(--low)")}${seg("soon", "var(--mustard)")}${seg("ok", "var(--pine)")}</div>
    </button>`;
  }).join("");
}

export function viewDashboard() {
  const list = state.enriched.filter(inSpace("pantry"));
  const n = (s) => list.filter((x) => x.status === s).length;
  const expN = list.filter((x) => x.exp).length;
  const alerts = alertsOf(list);
  const expiring = list.filter((x) => x.exp).sort((a, b) => a.expDays - b.expDays);

  const tile = (cls, count, label, status) =>
    `<button type="button" class="alert-tile ${cls}" data-action="goto-status" data-space="pantry" data-status="${status}"><b>${count}</b><span>${label}</span></button>`;

  const shelf = shelfGrid("pantry");

  return `
    <section class="section" aria-labelledby="h-alert">
      <div class="section-head"><h2 id="h-alert">储藏概况</h2><p>按家人的使用记录估算</p></div>
      <div class="alert-strip">
        ${tile("t-out", n("out"), "缺货", "out")}
        ${tile("t-low", n("low"), "少货", "low")}
        ${tile("t-soon", n("soon"), "即将告罄", "soon")}
        ${tile("t-exp", expN, "临期或过期", "exp")}
      </div>
    </section>

    <section class="section" aria-labelledby="h-restock">
      <div class="section-head"><h2 id="h-restock">该补货了</h2>
        ${alerts.length ? `<button type="button" class="btn btn-primary btn-sm" data-action="shop-add-alerts">全部加入采购清单</button>` : ""}</div>
      <div class="panel">${alerts.length ? restockPanel(alerts) : `<div class="empty"><strong>库存都很充足</strong>用掉东西时在“库存”里点一下 −，提醒会更准。</div>`}</div>
    </section>

    ${expiring.length ? `<section class="section" aria-labelledby="h-exp">
      <div class="section-head"><h2 id="h-exp">先吃这些</h2><p>菜单推荐会优先用到它们</p></div>
      <div class="panel"><ul class="restock-list">${expiring.slice(0, 6).map((it) => `<li>
        <span class="badge b-exp">${it.exp === "expired" ? "已过期" : it.expDays === 0 ? "今天到期" : `${it.expDays} 天后到期`}</span>
        <div class="grow"><span class="name">${esc(it.name)}</span><small>${esc(it.location || "")} 剩 ${fmt(it.dqty)} ${esc(it.du)}</small></div></li>`).join("")}</ul></div>
    </section>` : ""}

    <section class="section" aria-labelledby="h-shelf">
      <div class="section-head"><h2 id="h-shelf">家里的货架</h2><p>点分类查看明细</p></div>
      ${shelf ? `<div class="shelf">${shelf}</div>` : `<div class="panel empty"><strong>还没有物品</strong><a class="btn btn-primary" href="${href("item", "new")}?space=pantry">添加第一件物品</a></div>`}
    </section>`;
}

/* ── 库存 ── */
export function viewInventory(space = "pantry") {
  if (state.filter.space !== space) Object.assign(state.filter, { space, cat: "all", q: "", status: state.filter.status });
  const f = state.filter;
  const house = space === "house", gear = space === "gear";
  if (gear) f.status = "all";   // 装备没有库存状态
  const chip = (id, label) => `<button type="button" class="chip" data-action="cat" data-cat="${id}" aria-pressed="${f.cat === id}">${label}</button>`;
  const shelf = gear ? shelfGrid("gear") : "";
  return `
    <section class="section">
      <div class="section-head"><h2>${gear ? "装备" : house ? "房屋耗材" : "库存清单"}</h2>
        <div class="head-acts">${house ? `<a class="btn btn-sm btn-ghost" href="${href("house", "template")}">按房屋资料推荐</a>` : ""}
        <a class="btn btn-primary" href="${href("item", "new")}?space=${space}">${gear ? "添加装备" : "添加物品"}</a></div></div>
      ${gear ? `<p class="muted" style="margin:-4px 0 12px;font-size:13px">床品、电器、自行车、千斤顶、工具这类耐用品：只记有几件、放在哪，不算消耗、不提醒补货。</p>` : ""}
      ${shelf ? `<div class="shelf" style="margin-bottom:14px">${shelf}</div>` : ""}
      <div class="toolbar">
        <input type="search" id="invSearch" placeholder="${gear ? "搜索，例如：被罩、千斤顶、自行车" : house ? "搜索，例如：滤网、电池" : "搜索物品，例如：纸、蛋"}" value="${esc(f.q)}" aria-label="搜索物品">
        ${gear ? "" : `<select id="invStatus" aria-label="按提醒筛选">
          ${[["all", "全部状态"], ["alert", "需要补货"], ["out", "缺货"], ["low", "少货"], ["soon", "即将告罄"], ["exp", "临期或过期"], ["ok", "充足"]]
            .map(([v, l]) => `<option value="${v}" ${f.status === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>`}
      </div>
      <div class="chips" role="group" aria-label="按分类筛选">
        ${chip("all", "全部")}${catsOf(space).map((c) => chip(c.id, `${c.icon} ${c.name}`)).join("")}
      </div>
      <div id="invList"></div>
    </section>`;
}

export function renderInvList() {
  const f = state.filter, q = f.q.trim();
  const mine = state.enriched.filter(inSpace(f.space));
  const list = mine.filter((it) => {
    if (f.cat !== "all" && it.category !== f.cat) return false;
    if (q && !(`${it.name}${it.subcategory || ""}${it.notes || ""}`).includes(q)) return false;
    if (f.status === "alert") return it.status !== "ok";
    if (f.status === "exp") return !!it.exp;
    if (f.status !== "all") return it.status === f.status;
    return true;
  });
  const host = $("#invList");
  if (!host) return;
  if (!list.length) {
    host.innerHTML = mine.length
      ? `<div class="panel empty"><strong>没有符合条件的物品</strong>换个关键词或分类试试。</div>`
      : f.space === "house"
        ? `<div class="panel empty"><strong>还没有房屋耗材</strong>按你家的房型和设施，一次加好常用的滤网、电池、融雪盐等。<p><a class="btn btn-primary" href="${href("house", "template")}">按房屋资料推荐</a></p></div>`
        : f.space === "gear"
          ? `<div class="panel empty"><strong>还没有装备</strong>床单被罩、电热毯、旅行床、自行车、千斤顶、园艺工具……这些只需要记数量和位置的东西都放这里。<p><a class="btn btn-primary" href="${href("item", "new")}?space=gear">添加第一件装备</a></p></div>`
          : `<div class="panel empty"><strong>库存还是空的</strong>从最常用的几样开始，例如鸡蛋、大米、抽纸。</div>`;
    return;
  }
  host.innerHTML = catsOf(f.space).map((c) => {
    const inCat = list.filter((x) => x.category === c.id)
      .sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || a.name.localeCompare(b.name, "zh"));
    if (!inCat.length) return "";
    return `<div class="cat-group" style="--cat:${c.color}"><h3><span class="dot" aria-hidden="true"></span>${c.icon} ${c.name}<span class="muted">（${inCat.length}）</span></h3>
      <div class="items">${inCat.map(itemCard).join("")}</div></div>`;
  }).join("");
}

export function itemCard(it) {
  const st = STATUS[it.status];
  const by = Store.mode === "cloud" ? memberName(it.updated_by) : null;
  // 装备卡片：没有存量罐和 −/+（数量在编辑页改），显示件数、位置和备注
  if (isGear(it)) {
    const meta = [
      it.subcategory && `<span>${esc(it.subcategory)}</span>`,
      it.location && `<span>📍${esc(it.location)}</span>`,
      it.notes && `<span class="note" title="${esc(it.notes)}">${esc(it.notes.length > 40 ? `${it.notes.slice(0, 40)}…` : it.notes)}</span>`,
      by && `<span>${esc(by)} 更新</span>`,
    ].filter(Boolean).join("");
    return `<article class="item is-gear" aria-label="${esc(`${it.name}，${fmt(it.dqty)} ${it.du}${it.location ? `，在${it.location}` : ""}`)}">
      <span class="gear-ico" aria-hidden="true">${catOf(it.category).icon}</span>
      <div class="item-main">
        <div class="item-title"><button type="button" data-action="edit" data-id="${it.id}">${esc(it.name)}</button></div>
        <div class="item-meta">${meta}</div>
      </div>
      <div class="qty"><output>${fmt(it.dqty)}<small>${esc(it.du)}</small></output></div>
    </article>`;
  }
  const meta = [
    it.subcategory && `<span>${esc(it.subcategory)}</span>`,
    it.location && `<span>📍${esc(it.location)}</span>`,
    it.daysLeft != null && `<span>约够 ${Math.max(0, Math.floor(it.daysLeft))} 天</span>`,
    it.rate && `<span title="${it.rateSrc === "manual" ? "手动设置" : "根据最近使用记录估算"}">日均 ${fmt(it.drate)} ${esc(it.du)}</span>`,
    by && `<span>${esc(by)} 更新</span>`,
  ].filter(Boolean).join("");
  const expBadge = it.exp ? `<span class="badge b-exp">${it.exp === "expired" ? "已过期" : `${it.expDays} 天内到期`}</span>` : "";
  const label = `${it.name}，剩余 ${fmt(it.dqty)} ${it.du}，${st.label}`;
  return `<article class="item st-${it.status}" aria-label="${esc(label)}">
    <div class="jar st-${it.status}" role="img" aria-label="存量约 ${Math.round(it.level * 100)}%">
      <i style="height:${Math.max(it.qty > 0 ? 6 : 0, it.level * 100)}%"></i>
      ${it.minMark != null ? `<span class="tick" style="bottom:${it.minMark * 100}%"></span>` : ""}
    </div>
    <div class="item-main">
      <div class="item-title"><button type="button" data-action="edit" data-id="${it.id}">${esc(it.name)}</button>
        ${it.status !== "ok" ? `<span class="badge ${st.cls}">${st.label}</span>` : ""}${expBadge}</div>
      <div class="item-meta">${meta}</div>
    </div>
    <div class="qty">
      <button type="button" data-action="consume" data-id="${it.id}" aria-label="${esc(it.name)} 用掉 ${Units.step(it.du)} ${esc(it.du)}">−</button>
      <output>${fmt(it.dqty)}<small>${esc(it.du)}</small></output>
      <button type="button" data-action="restock" data-id="${it.id}" aria-label="${esc(it.name)} 补充 ${Units.step(it.du)} ${esc(it.du)}">+</button>
    </div>
  </article>`;
}

/* ── 采购清单 ── */
export function viewShopping() {
  const by = (s) => state.shopping.filter((x) => x.status === s);
  const row = (s) => {
    const mine = Store.mode === "demo" || s.claimed_by === state.user?.id;
    let acts = "";
    if (s.status === "todo") acts = `<button type="button" class="btn btn-sm btn-dark" data-action="shop-claim" data-id="${s.id}">我来买</button>
      <button type="button" class="btn btn-sm btn-primary" data-action="shop-bought" data-id="${s.id}">已买到</button>`;
    if (s.status === "claimed") acts = `${mine ? `<button type="button" class="btn btn-sm btn-ghost" data-action="shop-unclaim" data-id="${s.id}">不买了</button>` : ""}
      <button type="button" class="btn btn-sm btn-primary" data-action="shop-bought" data-id="${s.id}">已买到</button>`;
    const priceBox = s.status === "bought" ? (s.amount != null ? `<div class="muted" style="font-size:12px">花费 ${money(num(s.amount))}</div>` : "")
      : `<div class="price-in">
          <input type="number" min="0" step="0.01" inputmode="decimal" data-price-for="${s.id}" placeholder="花费 ${esc(Units.money(0).replace(/[\d.,\s]/g, ""))}（可不填）" aria-label="${esc(s.name)} 实际花费">
          <input type="text" maxlength="40" list="storeList" data-store-for="${s.id}" value="${esc(lastStore())}" placeholder="在哪买（可不填）" aria-label="${esc(s.name)} 购买商店">
        </div>`;
    return `<li class="shop-item ${s.status === "bought" ? "done" : ""}">
      <div class="row"><span class="nm"><b>${esc(s.name)}</b> ${showQty(num(s.quantity, 1), s.unit || "")}</span>
        <button type="button" class="btn btn-sm btn-ghost" data-action="shop-del" data-id="${s.id}" aria-label="删除 ${esc(s.name)}">删除</button></div>
      ${s.status === "claimed" ? `<div class="who">🛍 ${esc(s.claimed_by_name || "家人")} 正在买</div>` : ""}
      ${s.item_id ? "" : `<div class="muted" style="font-size:12px">未关联库存，买到后需手动入库</div>`}
      ${priceBox}
      ${acts ? `<div class="acts">${acts}</div>` : ""}
    </li>`;
  };
  const col = (title, rows, empty, extra = "") => `<div class="shop-col"><h3>${title}<span class="muted">（${rows.length}）</span>${extra}</h3>
    ${rows.length ? `<ul>${rows.map(row).join("")}</ul>` : `<p class="muted">${empty}</p>`}</div>`;
  const bought = by("bought");
  return `
    <section class="section">
      <div class="section-head"><h2>采购清单</h2>
        <button type="button" class="btn btn-sm" data-action="shop-add-alerts">把补货提醒加进来</button></div>
      <form class="panel add-row" id="shopForm" aria-label="手动添加采购项">
        <input name="name" required maxlength="60" placeholder="要买什么" list="itemNames" aria-label="名称">
        <input name="quantity" type="number" min="0.1" step="0.1" value="1" aria-label="数量">
        <input name="unit" list="unitList" placeholder="单位" maxlength="10" aria-label="单位">
        <select name="category" aria-label="分类"><option value="">自动分类</option>${categoryOptions()}</select>
        <button class="btn btn-primary" type="submit">加入清单</button>
      </form>
      ${storeDatalist()}
      <datalist id="itemNames">${state.items.map((i) => `<option value="${esc(i.name)}">`).join("")}</datalist>
      <div class="shop-cols">
        ${col("待购买", by("todo"), "没有待买的东西。")}
        ${col("家人认领中", by("claimed"), "点“我来买”认领，家人就不会重复买。")}
        ${col("已买到", bought, "买到后自动加回库存。", bought.length ? ` <button type="button" class="btn btn-sm btn-ghost" style="margin-left:auto" data-action="shop-clear">清空</button>` : "")}
      </div>
    </section>`;
}


/* ── 菜单推荐 ── */
export function scoreRecipes() {
  const expiringNames = state.enriched.filter((x) => x.exp === "expiring" && x.qty > 0);
  return RECIPES.filter((r) => r.diets.includes(state.diet)).map((r) => {
    const parts = r.ings.map((kw) => ({ kw, item: hasStock(kw) }));
    const have = parts.filter((p) => p.item).length;
    const usesExpiring = parts.some((p) => p.item && expiringNames.some((e) => e.id === p.item.id));
    return { ...r, parts, have, score: have / r.ings.length + (usesExpiring ? 0.3 : 0), usesExpiring, full: have === r.ings.length };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "zh"));
}

export function viewMeals() {
  const d = DIETS[state.diet];
  const scored = scoreRecipes();
  const used = new Set();
  const pick = (meal, count) => {
    const pool = scored.filter((r) => r.meal === meal && r.have > 0 && !used.has(r.name));
    if (!pool.length) return [];
    const out = [];
    for (let i = 0; i < Math.min(count, pool.length); i++) {
      const r = pool[(state.mealShift + i) % pool.length];
      if (!out.includes(r)) { out.push(r); used.add(r.name); }
    }
    return out;
  };
  const plan = MEAL_SLOTS.map((s) => {
    const dishes = pick(s.meal, s.count);
    return `<div class="slot"><h3>${s.name}</h3>${dishes.length ? dishes.map((r) => `<div class="dish">${esc(r.name)}${r.usesExpiring ? ` <span class="badge b-exp">用临期</span>` : ""}
      <small>${r.full ? "食材齐全" : `还缺：${r.parts.filter((p) => !p.item).map((p) => esc(p.kw[0])).join("、")}`}</small></div>`).join("")
      : `<p class="muted">库存里暂时凑不出，看看下面的菜谱缺什么。</p>`}</div>`;
  }).join("");

  const cards = scored.map((r) => {
    const missing = r.parts.filter((p) => !p.item);
    return `<article class="recipe">
      <h3><span>${esc(r.name)}</span><span class="badge ${r.full ? "b-ok" : "b-soon"}">${r.have}/${r.ings.length}</span></h3>
      <div class="ing">${r.parts.map((p) => `<span class="${p.item ? "have" : "miss"}">${esc(p.item ? p.item.name : p.kw[0])}</span>`).join("")}</div>
      <p class="muted" style="margin:0;font-size:13px">${esc(r.note)}</p>
      <div class="acts">
        ${missing.length ? `<button type="button" class="btn btn-sm" data-action="recipe-missing" data-name="${esc(r.name)}">缺的加入采购</button>` : ""}
        <a class="btn btn-sm btn-ghost" href="https://www.xiachufang.com/search/?keyword=${encodeURIComponent(r.name)}" target="_blank" rel="noopener noreferrer">在下厨房看做法</a>
      </div>
    </article>`;
  }).join("");

  return `
    <section class="section">
      <div class="section-head"><h2>按库存推荐菜单</h2>
        <button type="button" class="btn btn-sm" data-action="shuffle">换一组</button></div>
      <div class="seg" role="group" aria-label="饮食模式">
        ${Object.entries(DIETS).map(([k, v]) => `<button type="button" class="chip" data-action="diet" data-diet="${k}" aria-pressed="${state.diet === k}">${v.icon} ${v.name}</button>`).join("")}
      </div>
      <div class="panel"><ul class="tips">${d.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <p class="disclaimer">以上为一般性膳食建议，不能代替医生或注册营养师的个体化方案；孕期、妊娠糖尿病和产后请以医嘱为准。</p></div>
    </section>
    <section class="section"><div class="section-head"><h2>今天吃什么</h2><p>优先用掉快到期的食材</p></div><div class="plan">${plan}</div></section>
    <section class="section"><div class="section-head"><h2>可选菜谱</h2><p>绿色是家里有的</p></div><div class="recipes">${cards}</div></section>`;
}

/** 分类下拉选项：储藏、房屋、装备分组显示 */
export function categoryOptions(selected, { withOther = true } = {}) {
  const opt = (c) => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${c.icon} ${c.name}</option>`;
  return `<optgroup label="厨房储藏">${catsOf("pantry").map(opt).join("")}</optgroup>
    <optgroup label="房屋耗材">${catsOf("house").map(opt).join("")}</optgroup>
    <optgroup label="装备（只记数量和位置）">${catsOf("gear").map(opt).join("")}</optgroup>
    ${withOther ? opt(OTHER_CAT) : ""}`;
}
