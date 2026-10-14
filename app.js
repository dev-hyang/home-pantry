/* 家庭妈妈小助手 · 纯前端（无构建）
 * 数据层两种实现：DemoStore（localStorage，本地演示）/ CloudStore（Supabase，家人协同）
 * 提醒规则：缺货 qty<=0 ｜ 少货 qty<=少货线 ｜ 即将告罄 预计剩余天数<=提前提醒天数 ｜ 临期 保质期<=3天
 */
(() => {
  "use strict";

  const DAY = 86400000;
  const RATE_WINDOW_DAYS = 60;   // 用最近 60 天的消耗记录估算日均用量
  const MIN_RATE_SPAN_DAYS = 7;  // 记录太少时至少按 7 天平摊，避免高估
  const STOCK_TARGET_DAYS = 14;  // 建议补货量：补到够用 14 天

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
  const fmt = (n) => (Math.round(n * 100) / 100).toString();
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  const stepOf = (unit) => ({ kg: 0.5, L: 0.5, g: 100 }[unit] || 1);
  const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

  const state = {
    tab: "dashboard",
    items: [], logs: [], shopping: [], members: [],
    filter: { cat: "all", q: "", status: "all" },
    diet: localStorage.getItem("hmh-diet") || "general",
    mealShift: 0,
    user: null, household: null, households: [], displayName: "我",
    lastAlertCount: null,
  };

  const STATUS = {
    out:  { label: "缺货",     cls: "b-out",  rank: 0 },
    low:  { label: "少货",     cls: "b-low",  rank: 1 },
    soon: { label: "即将告罄", cls: "b-soon", rank: 2 },
    ok:   { label: "充足",     cls: "b-ok",   rank: 3 },
  };

  /* ───────────── 数据层：本地演示 ───────────── */
  const DemoStore = {
    mode: "demo", key: "hmh-demo-v1", db: null,
    load() {
      try { this.db = JSON.parse(localStorage.getItem(this.key)); } catch { this.db = null; }
      if (!this.db || !Array.isArray(this.db.items)) this.db = seedDemo();
      this.persist();
    },
    persist() { try { localStorage.setItem(this.key, JSON.stringify(this.db)); } catch { /* 隐私模式下可能不可写，忽略 */ } },
    reset() { this.db = seedDemo(); this.persist(); },
    async listItems() { return this.db.items.map((x) => ({ ...x })); },
    async listLogs() {
      const since = Date.now() - RATE_WINDOW_DAYS * DAY;
      return this.db.logs.filter((l) => new Date(l.created_at).getTime() >= since);
    },
    async saveItem(it) {
      const now = new Date().toISOString();
      if (it.id) {
        const i = this.db.items.findIndex((x) => x.id === it.id);
        if (i < 0) throw new Error("物品不存在");
        this.db.items[i] = { ...this.db.items[i], ...it, updated_at: now };
      } else {
        this.db.items.push({ ...it, id: uid(), created_at: now, updated_at: now });
      }
      this.persist();
    },
    async deleteItem(id) {
      this.db.items = this.db.items.filter((x) => x.id !== id);
      this.db.logs = this.db.logs.filter((l) => l.item_id !== id);
      this.db.shopping.forEach((s) => { if (s.item_id === id) s.item_id = null; });
      this.persist();
    },
    async adjust(id, delta, reason) {
      const it = this.db.items.find((x) => x.id === id);
      if (!it) throw new Error("物品不存在");
      const oldq = num(it.quantity), newq = Math.max(0, Math.round((oldq + delta) * 100) / 100);
      it.quantity = newq; it.updated_at = new Date().toISOString();
      if (newq !== oldq) this.db.logs.push({ id: uid(), item_id: id, delta: newq - oldq, reason, created_at: it.updated_at });
      this.persist();
    },
    async listShopping() { return this.db.shopping.map((x) => ({ ...x })); },
    async saveShopping(row) {
      if (row.id) {
        const i = this.db.shopping.findIndex((x) => x.id === row.id);
        if (i >= 0) this.db.shopping[i] = { ...this.db.shopping[i], ...row };
      } else {
        if (row.item_id && this.db.shopping.some((s) => s.item_id === row.item_id && s.status !== "bought")) return; // 与云端唯一索引行为一致
        this.db.shopping.push({ status: "todo", ...row, id: uid(), created_at: new Date().toISOString() });
      }
      this.persist();
    },
    async deleteShopping(id) { this.db.shopping = this.db.shopping.filter((x) => x.id !== id); this.persist(); },
    async clearBought() { this.db.shopping = this.db.shopping.filter((x) => x.status !== "bought"); this.persist(); },
  };

  function seedDemo() {
    const now = Date.now();
    const items = [], logs = [];
    const add = (name, category, subcategory, unit, quantity, min_quantity, location, daily, expiryInDays) => {
      const id = uid();
      items.push({
        id, name, category, subcategory, unit, quantity, min_quantity, location, lead_days: 3,
        expiry_date: expiryInDays == null ? null : new Date(now + expiryInDays * DAY).toISOString().slice(0, 10),
        avg_daily_use: null, notes: "", created_at: new Date(now - 40 * DAY).toISOString(), updated_at: new Date().toISOString(),
      });
      if (daily > 0) for (let d = 30; d >= 3; d -= 3) {
        logs.push({ id: uid(), item_id: id, delta: -Math.round(daily * 3 * 100) / 100, reason: "consume", created_at: new Date(now - d * DAY).toISOString() });
      }
    };
    add("鸡蛋", "fresh", "蛋奶", "个", 4, 6, "冷藏", 2, 12);
    add("纯牛奶", "fresh", "蛋奶", "盒", 2, 1, "冷藏", 1, 5);
    add("番茄", "fresh", "蔬菜", "个", 5, 2, "冷藏", 0.5, 4);
    add("菠菜", "fresh", "蔬菜", "把", 1, 1, "冷藏", 0.3, 2);
    add("西兰花", "fresh", "蔬菜", "个", 2, 1, "冷藏", 0.2, 5);
    add("鲫鱼", "fresh", "水产", "条", 0, 1, "冷藏", 0.15, null);
    add("北豆腐", "fresh", "豆制品", "盒", 1, 1, "冷藏", 0.2, 2);
    add("无糖酸奶", "fresh", "蛋奶", "杯", 6, 2, "冷藏", 1, 9);
    add("苹果", "fresh", "水果", "个", 6, 2, "冷藏", 1, 14);
    add("冷冻虾仁", "frozen", "冷冻水产", "袋", 2, 1, "冷冻", 0.1, 90);
    add("牛腩", "frozen", "冷冻肉禽", "kg", 1, 0.5, "冷冻", 0.05, 60);
    add("速冻水饺", "frozen", "速冻面点", "袋", 2, 1, "冷冻", 0.1, 120);
    add("大米", "dry", "米面杂粮", "kg", 6, 2, "厨房柜", 0.3, null);
    add("杂粮（糙米）", "dry", "米面杂粮", "kg", 1.5, 0.5, "厨房柜", 0.1, null);
    add("燕麦片", "dry", "米面杂粮", "袋", 2, 1, "厨房柜", 0.06, 180);
    add("食用油", "dry", "食用油", "瓶", 1, 0, "厨房柜", 0.06, null);
    add("生抽", "dry", "调味品", "瓶", 1, 0, "厨房柜", 0.03, null);
    add("原味坚果", "dry", "零食坚果", "袋", 3, 1, "常温", 0.15, 60);
    add("饮用水", "drink", "饮用水", "提", 2, 1, "储物间", 0.25, null);
    add("抽纸", "daily", "纸品", "包", 5, 4, "储物间", 0.4, null);
    add("卷纸", "daily", "纸品", "卷", 12, 6, "卫生间", 0.6, null);
    add("洗洁精", "daily", "清洁用品", "瓶", 1, 0, "厨房柜", 0.03, null);
    add("垃圾袋", "daily", "厨房耗材", "卷", 2, 1, "厨房柜", 0.07, null);
    add("纸尿裤 NB码", "baby", "纸尿裤", "片", 18, 30, "储物间", 9, null);
    add("婴儿湿巾", "baby", "湿巾", "包", 3, 2, "储物间", 0.3, null);
    add("防溢乳垫", "baby", "哺乳用品", "片", 40, 20, "储物间", 6, null);
    add("复合维生素", "health", "维生素营养", "片", 3, 0, "常温", 1, 200);
    const shopping = [];
    return { items, logs, shopping };
  }

  /* ───────────── 数据层：Supabase 云端 ───────────── */
  const ITEM_FIELDS = ["name", "category", "subcategory", "unit", "quantity", "min_quantity", "location", "expiry_date", "lead_days", "avg_daily_use", "notes"];
  const CloudStore = {
    mode: "cloud", sb: null, hid: null, channel: null,
    must({ data, error }) { if (error) throw new Error(error.message); return data; },
    async listItems() { return this.must(await this.sb.from("items").select("*").eq("household_id", this.hid).order("name")); },
    async listLogs() {
      const since = new Date(Date.now() - RATE_WINDOW_DAYS * DAY).toISOString();
      return this.must(await this.sb.from("stock_logs").select("item_id,delta,reason,created_at")
        .eq("household_id", this.hid).eq("reason", "consume").gte("created_at", since).limit(5000));
    },
    async saveItem(it) {
      const row = { household_id: this.hid, updated_by: state.user.id };
      ITEM_FIELDS.forEach((k) => { row[k] = it[k]; });
      if (it.id) this.must(await this.sb.from("items").update(row).eq("id", it.id));
      else this.must(await this.sb.from("items").insert(row));
    },
    async deleteItem(id) { this.must(await this.sb.from("items").delete().eq("id", id)); },
    async adjust(id, delta, reason) { this.must(await this.sb.rpc("adjust_stock", { p_item_id: id, p_delta: delta, p_reason: reason })); },
    async listShopping() { return this.must(await this.sb.from("shopping_list").select("*").eq("household_id", this.hid).order("created_at")); },
    async saveShopping(row) {
      if (row.id) {
        const { id, ...patch } = row;
        this.must(await this.sb.from("shopping_list").update(patch).eq("id", id));
      } else {
        const { error } = await this.sb.from("shopping_list").insert({ ...row, household_id: this.hid });
        if (error && error.code !== "23505") throw new Error(error.message); // 23505 = 家人已加过，忽略
      }
    },
    async deleteShopping(id) { this.must(await this.sb.from("shopping_list").delete().eq("id", id)); },
    async clearBought() { this.must(await this.sb.from("shopping_list").delete().eq("household_id", this.hid).eq("status", "bought")); },
    async listMembers() {
      return this.must(await this.sb.from("household_members").select("user_id,display_name,role").eq("household_id", this.hid));
    },
    subscribe(onChange) {
      if (this.channel) this.sb.removeChannel(this.channel);
      const f = { schema: "public", filter: `household_id=eq.${this.hid}` };
      this.channel = this.sb.channel(`hh-${this.hid}`)
        .on("postgres_changes", { event: "*", table: "items", ...f }, onChange)
        .on("postgres_changes", { event: "*", table: "shopping_list", ...f }, onChange)
        .subscribe();
    },
  };

  let Store = DemoStore;

  /* ───────────── 提醒与消耗速度计算 ───────────── */
  function enrich(items, logs) {
    const now = Date.now();
    const usage = {};
    for (const l of logs) {
      if (l.reason !== "consume" || num(l.delta) >= 0) continue;
      const t = new Date(l.created_at).getTime();
      const u = (usage[l.item_id] ||= { sum: 0, first: t });
      u.sum += -num(l.delta);
      u.first = Math.min(u.first, t);
    }
    return items.map((it) => {
      const qty = num(it.quantity), min = num(it.min_quantity), lead = it.lead_days == null ? 3 : num(it.lead_days, 3);
      let rate = null, rateSrc = null;
      if (num(it.avg_daily_use) > 0) { rate = num(it.avg_daily_use); rateSrc = "manual"; }
      else if (usage[it.id]) {
        const span = Math.max(MIN_RATE_SPAN_DAYS, (now - usage[it.id].first) / DAY);
        rate = usage[it.id].sum / span; rateSrc = "auto";
      }
      const daysLeft = rate > 0 ? qty / rate : null;
      let status = "ok";
      if (qty <= 0) status = "out";
      else if (min > 0 && qty <= min) status = "low";
      else if (daysLeft != null && daysLeft <= lead) status = "soon";

      let exp = null, expDays = null;
      if (it.expiry_date) {
        expDays = Math.ceil((new Date(it.expiry_date + "T23:59:59").getTime() - now) / DAY);
        if (expDays < 0) exp = "expired"; else if (expDays <= 3) exp = "expiring";
      }
      const target = Math.max(min * 2, rate ? rate * STOCK_TARGET_DAYS : 0, 1);
      const suggest = Math.max(1, Math.ceil(target - qty));
      const cap = Math.max(min * 3, rate ? rate * 21 : 0, 1);
      const level = Math.min(1, qty / cap);
      const minMark = min > 0 ? Math.min(1, min / cap) : null;
      return { ...it, qty, min, rate, rateSrc, daysLeft, status, exp, expDays, suggest, level, minMark };
    });
  }

  const alertsOf = (list) => list.filter((x) => x.status !== "ok").sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  const memberName = (userId) => state.members.find((m) => m.user_id === userId)?.display_name;
  const openShopFor = (itemId) => state.shopping.find((s) => s.item_id === itemId && s.status !== "bought");
  const hasStock = (kw) => state.enriched.find((it) => it.qty > 0 && kw.some((k) => it.name.includes(k)));

  /* ───────────── 刷新与渲染 ───────────── */
  let refreshing = null;
  async function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const [items, logs, shopping] = await Promise.all([Store.listItems(), Store.listLogs(), Store.listShopping()]);
        Object.assign(state, { items, logs, shopping });
        state.enriched = enrich(items, logs);
        setSync(Store.mode === "demo" ? "本地演示数据" : `已同步 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`);
        notifyIfNeeded();
        render();
      } catch (e) {
        setSync("同步失败，点设置页重试", true);
        toast(`读取数据失败：${e.message}`);
      } finally { refreshing = null; }
    })();
    return refreshing;
  }

  let debounceT;
  const refreshSoon = () => { clearTimeout(debounceT); debounceT = setTimeout(refresh, 400); };

  function setSync(text, err = false) {
    const b = $("#syncBadge"); b.textContent = text; b.classList.toggle("err", err);
  }

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
  }

  function render() {
    document.body.classList.remove("gate");
    $("#hhName").textContent = state.household?.name || "";
    document.querySelectorAll("#tabs button").forEach((b) => {
      if (b.dataset.tab === state.tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    const openShop = state.shopping.filter((s) => s.status !== "bought").length;
    const sc = $("#shopCount"); sc.hidden = !openShop; sc.textContent = openShop;
    const alertN = alertsOf(state.enriched).length;
    document.title = alertN ? `(${alertN}) 家庭妈妈小助手` : "家庭妈妈小助手";

    const view = { dashboard: viewDashboard, inventory: viewInventory, shopping: viewShopping, meals: viewMeals, settings: viewSettings }[state.tab];
    $("#main").innerHTML = view();
    if (state.tab === "inventory") renderInvList();
  }

  /* ── 总览 ── */
  function viewDashboard() {
    const list = state.enriched;
    const n = (s) => list.filter((x) => x.status === s).length;
    const expN = list.filter((x) => x.exp).length;
    const alerts = alertsOf(list);
    const expiring = list.filter((x) => x.exp).sort((a, b) => a.expDays - b.expDays);

    const tile = (cls, count, label, status) =>
      `<button type="button" class="alert-tile ${cls}" data-action="goto-status" data-status="${status}"><b>${count}</b><span>${label}</span></button>`;

    const restockRows = alerts.slice(0, 8).map((it) => {
      const inList = openShopFor(it.id);
      return `<li>
        <span class="badge ${STATUS[it.status].cls}">${STATUS[it.status].label}</span>
        <div class="grow"><span class="name">${esc(it.name)}</span>
          <small>剩 ${fmt(it.qty)} ${esc(it.unit)}${it.daysLeft != null && it.qty > 0 ? `，约够 ${Math.max(0, Math.floor(it.daysLeft))} 天` : ""}，建议买 ${it.suggest} ${esc(it.unit)}</small></div>
        ${inList ? `<span class="badge b-ok">已在清单</span>` : `<button type="button" class="btn btn-sm" data-action="shop-add-item" data-id="${it.id}">加入采购</button>`}
      </li>`;
    }).join("");

    const shelf = CATEGORIES.map((c) => {
      const inCat = list.filter((x) => x.category === c.id);
      if (!inCat.length) return "";
      const cnt = (s) => inCat.filter((x) => x.status === s).length;
      const seg = (s, color) => cnt(s) ? `<i style="width:${(cnt(s) / inCat.length) * 100}%;background:${color}"></i>` : "";
      const bad = inCat.length - cnt("ok");
      return `<button type="button" class="shelf-cell" style="--cat:${c.color}" data-action="goto-cat" data-cat="${c.id}">
        <span class="ico" aria-hidden="true">${c.icon}</span><h3>${c.name}</h3>
        <p>${inCat.length} 种${bad ? `，${bad} 种需补` : "，都充足"}</p>
        <div class="mix" aria-hidden="true">${seg("out", "var(--out)")}${seg("low", "var(--low)")}${seg("soon", "var(--mustard)")}${seg("ok", "var(--pine)")}</div>
      </button>`;
    }).join("");

    return `
      <section class="section" aria-labelledby="h-alert">
        <div class="section-head"><h2 id="h-alert">今天需要留意</h2><p>按家人的使用记录估算</p></div>
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
        <div class="panel">${alerts.length ? `<ul class="restock-list">${restockRows}</ul>` : `<div class="empty"><strong>库存都很充足</strong>用掉东西时在“库存”里点一下 −，提醒会更准。</div>`}</div>
      </section>

      ${expiring.length ? `<section class="section" aria-labelledby="h-exp">
        <div class="section-head"><h2 id="h-exp">先吃这些</h2><p>菜单推荐会优先用到它们</p></div>
        <div class="panel"><ul class="restock-list">${expiring.slice(0, 6).map((it) => `<li>
          <span class="badge b-exp">${it.exp === "expired" ? "已过期" : it.expDays === 0 ? "今天到期" : `${it.expDays} 天后到期`}</span>
          <div class="grow"><span class="name">${esc(it.name)}</span><small>${esc(it.location || "")} 剩 ${fmt(it.qty)} ${esc(it.unit)}</small></div></li>`).join("")}</ul></div>
      </section>` : ""}

      <section class="section" aria-labelledby="h-shelf">
        <div class="section-head"><h2 id="h-shelf">家里的货架</h2><p>点分类查看明细</p></div>
        ${shelf ? `<div class="shelf">${shelf}</div>` : `<div class="panel empty"><strong>还没有物品</strong><button type="button" class="btn btn-primary" data-action="add-item">添加第一件物品</button></div>`}
      </section>`;
  }

  /* ── 库存 ── */
  function viewInventory() {
    const f = state.filter;
    const chip = (id, label) => `<button type="button" class="chip" data-action="cat" data-cat="${id}" aria-pressed="${f.cat === id}">${label}</button>`;
    return `
      <section class="section">
        <div class="section-head"><h2>库存清单</h2>
          <button type="button" class="btn btn-primary" data-action="add-item">添加物品</button></div>
        <div class="toolbar">
          <input type="search" id="invSearch" placeholder="搜索物品，例如：纸、蛋" value="${esc(f.q)}" aria-label="搜索物品">
          <select id="invStatus" aria-label="按提醒筛选">
            ${[["all", "全部状态"], ["alert", "需要补货"], ["out", "缺货"], ["low", "少货"], ["soon", "即将告罄"], ["exp", "临期或过期"], ["ok", "充足"]]
              .map(([v, l]) => `<option value="${v}" ${f.status === v ? "selected" : ""}>${l}</option>`).join("")}
          </select>
        </div>
        <div class="chips" role="group" aria-label="按分类筛选">
          ${chip("all", "全部")}${CATEGORIES.map((c) => chip(c.id, `${c.icon} ${c.name}`)).join("")}
        </div>
        <div id="invList"></div>
      </section>`;
  }

  function renderInvList() {
    const f = state.filter, q = f.q.trim();
    const list = state.enriched.filter((it) => {
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
      host.innerHTML = state.enriched.length
        ? `<div class="panel empty"><strong>没有符合条件的物品</strong>换个关键词或分类试试。</div>`
        : `<div class="panel empty"><strong>库存还是空的</strong>从最常用的几样开始，例如鸡蛋、大米、抽纸。</div>`;
      return;
    }
    host.innerHTML = CATEGORIES.map((c) => {
      const inCat = list.filter((x) => x.category === c.id)
        .sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || a.name.localeCompare(b.name, "zh"));
      if (!inCat.length) return "";
      return `<div class="cat-group" style="--cat:${c.color}"><h3><span class="dot" aria-hidden="true"></span>${c.icon} ${c.name}<span class="muted">（${inCat.length}）</span></h3>
        <div class="items">${inCat.map(itemCard).join("")}</div></div>`;
    }).join("");
  }

  function itemCard(it) {
    const st = STATUS[it.status];
    const by = Store.mode === "cloud" ? memberName(it.updated_by) : null;
    const meta = [
      it.subcategory && `<span>${esc(it.subcategory)}</span>`,
      it.location && `<span>📍${esc(it.location)}</span>`,
      it.daysLeft != null && `<span>约够 ${Math.max(0, Math.floor(it.daysLeft))} 天</span>`,
      it.rate && `<span title="${it.rateSrc === "manual" ? "手动设置" : "根据最近使用记录估算"}">日均 ${fmt(it.rate)} ${esc(it.unit)}</span>`,
      by && `<span>${esc(by)} 更新</span>`,
    ].filter(Boolean).join("");
    const expBadge = it.exp ? `<span class="badge b-exp">${it.exp === "expired" ? "已过期" : `${it.expDays} 天内到期`}</span>` : "";
    const label = `${it.name}，剩余 ${fmt(it.qty)} ${it.unit}，${st.label}`;
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
        <button type="button" data-action="consume" data-id="${it.id}" aria-label="${esc(it.name)} 用掉 ${stepOf(it.unit)}">−</button>
        <output>${fmt(it.qty)}<small>${esc(it.unit)}</small></output>
        <button type="button" data-action="restock" data-id="${it.id}" aria-label="${esc(it.name)} 补充 ${stepOf(it.unit)}">+</button>
      </div>
    </article>`;
  }

  /* ── 采购清单 ── */
  function viewShopping() {
    const by = (s) => state.shopping.filter((x) => x.status === s);
    const row = (s) => {
      const mine = Store.mode === "demo" || s.claimed_by === state.user?.id;
      let acts = "";
      if (s.status === "todo") acts = `<button type="button" class="btn btn-sm btn-dark" data-action="shop-claim" data-id="${s.id}">我来买</button>
        <button type="button" class="btn btn-sm btn-primary" data-action="shop-bought" data-id="${s.id}">已买到</button>`;
      if (s.status === "claimed") acts = `${mine ? `<button type="button" class="btn btn-sm btn-ghost" data-action="shop-unclaim" data-id="${s.id}">不买了</button>` : ""}
        <button type="button" class="btn btn-sm btn-primary" data-action="shop-bought" data-id="${s.id}">已买到</button>`;
      return `<li class="shop-item ${s.status === "bought" ? "done" : ""}">
        <div class="row"><span class="nm"><b>${esc(s.name)}</b> ${fmt(num(s.quantity, 1))} ${esc(s.unit || "")}</span>
          <button type="button" class="btn btn-sm btn-ghost" data-action="shop-del" data-id="${s.id}" aria-label="删除 ${esc(s.name)}">删除</button></div>
        ${s.status === "claimed" ? `<div class="who">🛍 ${esc(s.claimed_by_name || "家人")} 正在买</div>` : ""}
        ${s.item_id ? "" : `<div class="muted" style="font-size:12px">未关联库存，买到后需手动入库</div>`}
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
          <button class="btn btn-primary" type="submit">加入清单</button>
        </form>
        <datalist id="itemNames">${state.items.map((i) => `<option value="${esc(i.name)}">`).join("")}</datalist>
        <div class="shop-cols">
          ${col("待购买", by("todo"), "没有待买的东西。")}
          ${col("家人认领中", by("claimed"), "点“我来买”认领，家人就不会重复买。")}
          ${col("已买到", bought, "买到后自动加回库存。", bought.length ? ` <button type="button" class="btn btn-sm btn-ghost" style="margin-left:auto" data-action="shop-clear">清空</button>` : "")}
        </div>
      </section>`;
  }

  /* ── 菜单推荐 ── */
  function scoreRecipes() {
    const expiringNames = state.enriched.filter((x) => x.exp === "expiring" && x.qty > 0);
    return RECIPES.filter((r) => r.diets.includes(state.diet)).map((r) => {
      const parts = r.ings.map((kw) => ({ kw, item: hasStock(kw) }));
      const have = parts.filter((p) => p.item).length;
      const usesExpiring = parts.some((p) => p.item && expiringNames.some((e) => e.id === p.item.id));
      return { ...r, parts, have, score: have / r.ings.length + (usesExpiring ? 0.3 : 0), usesExpiring, full: have === r.ings.length };
    }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "zh"));
  }

  function viewMeals() {
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

  /* ── 设置 ── */
  function viewSettings() {
    const cloud = Store.mode === "cloud";
    const notif = "Notification" in window ? Notification.permission : "unsupported";
    return `<section class="section"><div class="section-head"><h2>设置</h2></div><div class="settings">
      <div class="panel">
        <div class="kv"><div><b>${esc(state.household?.name || "")}</b><div class="muted">${cloud ? "云端协同：家人修改会实时同步" : "本地演示：数据只保存在这个浏览器里"}</div></div>
          ${cloud ? `<button type="button" class="btn btn-sm" data-action="reload">立即同步</button>` : ""}</div>
      </div>
      ${cloud ? `
      <div class="panel">
        <div class="kv"><div><div class="muted">邀请家人：把这个邀请码发给他们</div><div class="code">${esc(state.household.invite_code)}</div></div>
          <button type="button" class="btn btn-sm" data-action="copy-invite">复制邀请码</button></div>
        <h3 style="font-size:15px;margin:16px 0 6px">家庭成员</h3>
        <ul class="tips">${state.members.map((m) => `<li>${esc(m.display_name)}${m.role === "owner" ? "（创建者）" : ""}${m.user_id === state.user.id ? "（我）" : ""}</li>`).join("")}</ul>
        <form id="nameForm" class="add-row" style="grid-template-columns:1fr auto;margin-top:12px">
          <input name="display_name" maxlength="20" value="${esc(state.displayName)}" aria-label="我在家里的称呼">
          <button class="btn btn-sm" type="submit">保存称呼</button></form>
        ${state.households.length > 1 ? `<label style="display:grid;gap:4px;margin-top:12px">切换家庭<select id="hhSwitch">${state.households.map((h) => `<option value="${h.id}" ${h.id === state.household.id ? "selected" : ""}>${esc(h.name)}</option>`).join("")}</select></label>` : ""}
      </div>` : `
      <div class="panel"><b>想和家人共享？</b><p class="muted" style="margin:4px 0 0">按 README 创建免费的 Supabase 项目，把地址和 anon key 填进 config.js，重新部署即可。</p></div>`}
      <div class="panel"><div class="kv"><div><b>浏览器通知</b><div class="muted">打开网页时，若有新的缺货或少货会弹出提醒</div></div>
        ${notif === "granted" ? `<span class="badge b-ok">已开启</span>` : notif === "unsupported" ? `<span class="muted">此浏览器不支持</span>` : `<button type="button" class="btn btn-sm" data-action="notif">开启通知</button>`}</div></div>
      <div class="panel"><div class="kv"><div><b>导出数据</b><div class="muted">下载库存和采购清单的 JSON 备份</div></div>
        <button type="button" class="btn btn-sm" data-action="export">导出 JSON</button></div></div>
      ${cloud ? `<button type="button" class="btn btn-danger-ghost" data-action="logout">退出登录</button>`
              : `<button type="button" class="btn btn-danger-ghost" data-action="reset-demo">恢复演示数据</button>`}
    </div></section>`;
  }

  /* ───────────── 物品弹窗 ───────────── */
  const dlg = $("#itemDialog"), form = $("#itemForm"), fe = form.elements;

  function fillSubs(catId, selected) {
    const c = catOf(catId);
    fe.subcategory.innerHTML = c.subs.map((s) => `<option ${s === selected ? "selected" : ""}>${esc(s)}</option>`).join("");
  }

  function openItem(id) {
    const it = id ? state.items.find((x) => x.id === id) : null;
    const defCat = state.filter.cat !== "all" ? state.filter.cat : "fresh";
    $("#itemDialogTitle").textContent = it ? `编辑：${it.name}` : "添加物品";
    form.reset();
    $("#itemFormError").textContent = "";
    fe.category.innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join("");
    fe.location.innerHTML = `<option value="">未指定</option>` + LOCATIONS.map((l) => `<option>${l}</option>`).join("");
    const v = it || { category: defCat, unit: "个", quantity: 1, min_quantity: 1, lead_days: 3, location: catOf(defCat).loc };
    fe.id.value = it?.id || "";
    fe.name.value = v.name || "";
    fe.category.value = v.category;
    fillSubs(v.category, v.subcategory);
    fe.unit.value = v.unit || "个";
    fe.quantity.value = v.quantity ?? 0;
    fe.min_quantity.value = v.min_quantity ?? 0;
    fe.lead_days.value = v.lead_days ?? 3;
    fe.location.value = v.location || "";
    fe.expiry_date.value = v.expiry_date || "";
    fe.avg_daily_use.value = v.avg_daily_use ?? "";
    fe.notes.value = v.notes || "";
    form.querySelector('[data-dialog="delete"]').hidden = !it;
    dlg.showModal();
    fe.name.focus();
  }

  fe.category.addEventListener("change", () => {
    fillSubs(fe.category.value);
    if (!fe.id.value) fe.location.value = catOf(fe.category.value).loc;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = fe.name.value.trim();
    const quantity = num(fe.quantity.value, NaN);
    if (!name) return ($("#itemFormError").textContent = "请填写物品名称。");
    if (!Number.isFinite(quantity) || quantity < 0) return ($("#itemFormError").textContent = "数量需要是 0 或正数。");
    const it = {
      id: fe.id.value || undefined, name,
      category: fe.category.value, subcategory: fe.subcategory.value || null,
      unit: fe.unit.value.trim() || "个", quantity,
      min_quantity: Math.max(0, num(fe.min_quantity.value)),
      lead_days: Math.min(60, Math.max(0, Math.round(num(fe.lead_days.value, 3)))),
      location: fe.location.value || null, expiry_date: fe.expiry_date.value || null,
      avg_daily_use: fe.avg_daily_use.value === "" ? null : Math.max(0, num(fe.avg_daily_use.value)),
      notes: fe.notes.value.trim() || null,
    };
    try {
      await Store.saveItem(it);
      dlg.close(); toast(it.id ? "已保存" : `已添加 ${name}`); refresh();
    } catch (err) { $("#itemFormError").textContent = `保存失败：${err.message}`; }
  });

  form.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-dialog]");
    if (!b) return;
    if (b.dataset.dialog === "cancel") dlg.close();
    if (b.dataset.dialog === "delete") {
      if (!confirm(`确定删除“${fe.name.value}”吗？它的使用记录也会一起删除。`)) return;
      try { await Store.deleteItem(fe.id.value); dlg.close(); toast("已删除"); refresh(); }
      catch (err) { $("#itemFormError").textContent = `删除失败：${err.message}`; }
    }
  });

  /* ───────────── 交互（事件委托） ───────────── */
  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (!b) return;
    state.tab = b.dataset.tab; render(); $("#main").focus({ preventScroll: true }); window.scrollTo(0, 0);
  });

  const main = $("#main");
  main.addEventListener("input", (e) => {
    if (e.target.id === "invSearch") { state.filter.q = e.target.value; renderInvList(); }
  });
  main.addEventListener("change", async (e) => {
    if (e.target.id === "invStatus") { state.filter.status = e.target.value; renderInvList(); }
    if (e.target.id === "hhSwitch") { localStorage.setItem("hmh-hid", e.target.value); location.reload(); }
  });

  main.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      if (f.id === "shopForm") {
        const name = f.elements.name.value.trim();
        if (!name) return;
        const linked = state.items.find((i) => i.name === name);
        if (linked && openShopFor(linked.id)) return toast(`${name} 已经在清单里了`);
        await Store.saveShopping({ name, quantity: Math.max(0.1, num(f.elements.quantity.value, 1)), unit: f.elements.unit.value.trim() || linked?.unit || "", item_id: linked?.id || null });
        toast(`已加入：${name}`); refresh();
      }
      if (f.id === "nameForm") {
        const v = f.elements.display_name.value.trim();
        if (!v) return;
        const { error } = await CloudStore.sb.from("household_members").update({ display_name: v }).eq("household_id", CloudStore.hid).eq("user_id", state.user.id);
        if (error) throw new Error(error.message);
        state.displayName = v; state.members = await CloudStore.listMembers(); toast("称呼已保存"); render();
      }
      if (f.id === "loginForm") return doLogin(f);
      if (f.id === "createHhForm") return doCreateHousehold(f);
      if (f.id === "joinHhForm") return doJoinHousehold(f);
    } catch (err) { toast(`操作失败：${err.message}`); }
  });

  main.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const { action, id } = el.dataset;
    try {
      switch (action) {
        case "add-item": return openItem();
        case "edit": return openItem(id);
        case "consume": el.disabled = true; await Store.adjust(id, -stepOf(state.items.find((x) => x.id === id)?.unit), "consume"); return refresh();
        case "restock": el.disabled = true; await Store.adjust(id, stepOf(state.items.find((x) => x.id === id)?.unit), "restock"); return refresh();
        case "cat": state.filter.cat = el.dataset.cat; return render();
        case "goto-cat": Object.assign(state.filter, { cat: el.dataset.cat, status: "all", q: "" }); state.tab = "inventory"; return render();
        case "goto-status": Object.assign(state.filter, { cat: "all", status: el.dataset.status, q: "" }); state.tab = "inventory"; return render();
        case "shop-add-item": return addAlertsToShopping([state.enriched.find((x) => x.id === id)]);
        case "shop-add-alerts": return addAlertsToShopping(alertsOf(state.enriched));
        case "shop-claim": await Store.saveShopping({ id, status: "claimed", claimed_by: state.user?.id || null, claimed_by_name: state.displayName }); toast("已认领，家人会看到你在买"); return refresh();
        case "shop-unclaim": await Store.saveShopping({ id, status: "todo", claimed_by: null, claimed_by_name: null }); return refresh();
        case "shop-bought": return markBought(id);
        case "shop-del": await Store.deleteShopping(id); return refresh();
        case "shop-clear": await Store.clearBought(); return refresh();
        case "diet": state.diet = el.dataset.diet; state.mealShift = 0; localStorage.setItem("hmh-diet", state.diet); return render();
        case "shuffle": state.mealShift++; return render();
        case "recipe-missing": return addRecipeMissing(el.dataset.name);
        case "copy-invite": await navigator.clipboard.writeText(state.household.invite_code); return toast("邀请码已复制");
        case "notif": await Notification.requestPermission(); return render();
        case "export": return exportJson();
        case "reload": return refresh();
        case "reset-demo": if (confirm("清除本地数据并恢复演示数据？")) { DemoStore.reset(); toast("已恢复演示数据"); refresh(); } return;
        case "logout": await CloudStore.sb.auth.signOut(); localStorage.removeItem("hmh-hid"); return location.reload();
      }
    } catch (err) { toast(`操作失败：${err.message}`); refresh(); }
  });

  async function addAlertsToShopping(list) {
    let added = 0;
    for (const it of list) {
      if (!it || openShopFor(it.id)) continue;
      await Store.saveShopping({ item_id: it.id, name: it.name, quantity: it.suggest, unit: it.unit });
      added++;
    }
    toast(added ? `已加入采购清单 ${added} 项` : "这些都已经在清单里了");
    refresh();
  }

  async function addRecipeMissing(recipeName) {
    const r = scoreRecipes().find((x) => x.name === recipeName);
    if (!r) return;
    const openNames = new Set(state.shopping.filter((s) => s.status !== "bought").map((s) => s.name));
    let added = 0;
    for (const p of r.parts.filter((x) => !x.item)) {
      const existing = state.items.find((i) => p.kw.some((k) => i.name.includes(k)));
      const name = existing?.name || p.kw[0];
      if (openNames.has(name) || (existing && openShopFor(existing.id))) continue;
      await Store.saveShopping({ name, quantity: 1, unit: existing?.unit || "", item_id: existing?.id || null });
      added++;
    }
    toast(added ? `“${recipeName}”缺的 ${added} 样已加入清单` : "缺的食材已经在清单里了");
    refresh();
  }

  async function markBought(id) {
    const s = state.shopping.find((x) => x.id === id);
    if (!s) return;
    await Store.saveShopping({ id, status: "bought", bought_at: new Date().toISOString(), claimed_by_name: s.claimed_by_name || state.displayName });
    if (s.item_id && state.items.some((i) => i.id === s.item_id)) {
      await Store.adjust(s.item_id, num(s.quantity, 1), "restock");
      toast(`${s.name} 已入库 +${fmt(num(s.quantity, 1))}，记得更新保质期`);
    } else toast(`${s.name} 已买到`);
    refresh();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), household: state.household?.name, items: state.items, shopping: state.shopping }, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `pantry-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function notifyIfNeeded() {
    const urgent = state.enriched.filter((x) => x.status === "out" || x.status === "low");
    const prev = state.lastAlertCount;
    state.lastAlertCount = urgent.length;
    if (prev === null ? urgent.length === 0 : urgent.length <= prev) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try { new Notification("家庭妈妈小助手", { body: `${urgent.length} 样东西缺货或少货：${urgent.slice(0, 4).map((x) => x.name).join("、")}` }); } catch { /* 部分移动浏览器只允许 Service Worker 通知 */ }
  }

  /* ───────────── 云端：登录与家庭 ───────────── */
  function gate(html) { document.body.classList.add("gate"); $("#hhName").textContent = ""; $("#main").innerHTML = html; }

  function renderLogin(msg = "") {
    gate(`<div class="panel gate-card"><h2>登录</h2>
      <p class="muted">输入邮箱，我们会发一封登录链接，点开即可登录，无需密码。</p>
      <form id="loginForm"><input type="email" name="email" required autocomplete="email" placeholder="you@example.com" aria-label="邮箱">
        <button class="btn btn-primary" type="submit">发送登录链接</button></form>
      <p class="muted" role="status">${esc(msg)}</p></div>`);
    setSync("未登录");
  }

  async function doLogin(f) {
    const email = f.elements.email.value.trim();
    if (!email) return;
    f.querySelector("button").disabled = true;
    const { error } = await CloudStore.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split("#")[0] } });
    if (error) { f.querySelector("button").disabled = false; return toast(`发送失败：${error.message}`); }
    renderLogin(`登录链接已发送到 ${email}，请在本设备打开邮件。`);
  }

  function renderOnboarding() {
    gate(`<div class="panel gate-card"><h2>加入你的家庭</h2>
      <p class="muted">第一次使用请创建家庭；家人已经创建过的话，用邀请码加入。</p>
      <form id="joinHhForm"><input name="code" required maxlength="12" placeholder="邀请码" autocapitalize="characters" aria-label="邀请码">
        <input name="display_name" required maxlength="20" placeholder="我的称呼，例如：爸爸" aria-label="我的称呼">
        <button class="btn btn-dark" type="submit">用邀请码加入</button></form>
      <hr>
      <form id="createHhForm"><input name="name" required maxlength="50" placeholder="家庭名称，例如：小月亮的家" aria-label="家庭名称">
        <input name="display_name" required maxlength="20" placeholder="我的称呼，例如：妈妈" aria-label="我的称呼">
        <button class="btn btn-primary" type="submit">创建家庭</button></form></div>`);
    setSync("已登录");
  }

  async function doCreateHousehold(f) {
    const { data, error } = await CloudStore.sb.rpc("create_household", { p_name: f.elements.name.value.trim(), p_display_name: f.elements.display_name.value.trim() });
    if (error) return toast(`创建失败：${error.message}`);
    localStorage.setItem("hmh-hid", data); afterLogin();
  }

  async function doJoinHousehold(f) {
    const { data, error } = await CloudStore.sb.rpc("join_household", { p_code: f.elements.code.value.trim(), p_display_name: f.elements.display_name.value.trim() });
    if (error) return toast(error.message.includes("invalid") ? "邀请码不正确，请向家人确认" : `加入失败：${error.message}`);
    localStorage.setItem("hmh-hid", data); afterLogin();
  }

  async function afterLogin() {
    const sb = CloudStore.sb;
    const { data, error } = await sb.from("household_members")
      .select("household_id, display_name, households(id, name, invite_code, created_by)").eq("user_id", state.user.id);
    if (error) return toast(`读取家庭失败：${error.message}`);
    if (!data.length) return renderOnboarding();
    state.households = data.map((d) => d.households).filter(Boolean);
    const saved = localStorage.getItem("hmh-hid");
    const mine = data.find((d) => d.household_id === saved) || data[0];
    state.household = mine.households;
    state.displayName = mine.display_name;
    CloudStore.hid = mine.household_id;
    localStorage.setItem("hmh-hid", CloudStore.hid);
    state.members = await CloudStore.listMembers();
    CloudStore.subscribe(refreshSoon);
    await refresh();
  }

  /* ───────────── 启动 ───────────── */
  async function boot() {
    $("#unitList").innerHTML = UNITS.map((u) => `<option value="${u}">`).join("");
    document.addEventListener("visibilitychange", () => { if (!document.hidden && state.enriched) refreshSoon(); });

    const cfg = window.APP_CONFIG || {};
    if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
      if (!window.supabase) { setSync("云端库加载失败", true); return toast("无法加载 Supabase SDK，请检查网络后刷新"); }
      Store = CloudStore;
      CloudStore.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      let started = false;
      const start = (session) => {
        if (started || !session) return;
        started = true; state.user = session.user; afterLogin();
      };
      CloudStore.sb.auth.onAuthStateChange((evt, session) => {
        if (evt === "SIGNED_IN") start(session);
        if (evt === "SIGNED_OUT") { started = false; renderLogin(); }
      });
      const { data: { session } } = await CloudStore.sb.auth.getSession();
      if (session) start(session); else renderLogin();
    } else {
      Store = DemoStore;
      DemoStore.load();
      state.household = { name: "演示家庭（数据仅存于本浏览器）" };
      await refresh();
    }
  }

  boot();
})();
