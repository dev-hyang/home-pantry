/* 网址路由（hash）：#/section/sub/id?query
 * 好处：手机返回手势、浏览器后退天然可用；页面可以直接分享给家人。 */
export const SECTIONS = {
  today:    { name: "今日",   subs: null },
  alerts:   { name: "待办 | 注意事项", subs: null },
  quick:    { name: "快捷操作", subs: null },   // #/quick：编辑今日页的快捷操作（2026-11-06，今日改回卡片）   // #/alerts：今日格子里“注意事项”点开的清单（带排序）
  ai:       { name: "咩咩咩",  subs: null },   // #/ai：AI 助手整页（菜单在储藏 → 菜单，这里问家里任何事）
  pantry:   { name: "储藏",   subs: [["overview", "概览"], ["shopping", "采购"], ["inventory", "库存"], ["gear", "家居耐用品"], ["meals", "菜单"], ["scan", "录入购物"]] },   // 家居耐用品：耐用品和工具，只记数量和位置
  // 房屋：#/house 是房产列表；#/house/pages 是某套房产的页面目录；车辆挂家庭，从房产列表进
  house:    { name: "房屋",   subs: [["overview", "概览"], ["assets", "设备保养"], ["tasks", "季节任务"], ["deal", "交易"], ["profile", "房屋资料"],
                                     ["supplies", "汽车房屋消耗品", true], ["vehicles", "车辆", true], ["pages", "页面", true], ["template", "推荐耗材", true], ["asset-template", "生成设备", true], ["fix", "出了问题", true], ["plan", "买卖计划", true]] },  // 第三项 true = 不在目录显示
  // 财务（2026-11，原「账单」改名）：内部 id 仍是 bills，旧的 #/bills/… 网址、书签、快捷操作、提醒链接全部照旧；#/finance/… 是同一处的别名
  bills:    { name: "财务",   subs: [["overview", "账单概览"], ["all", "账单明细"], ["spend", "花费"], ["income", "收入"], ["statements", "对账单"], ["budget", "预算"], ["cards", "卡与账户"], ["assets", "资产"], ["debts", "借贷"], ["networth", "净资产"], ["template", "常用账单", true], ["assetbills", "资产账单", true]] },
  shopping: { name: "采购",   subs: [["home", "采购"], ["list", "购物车", true], ["add", "加入购物车", true]] },   // #/shopping 看板、#/shopping/list?tab=…、#/shopping/add（2026-11-13）
  scan:     { name: "录入购物", subs: null },
  shops:    { name: "常去的商店", subs: [["list", "常去的商店"], ["find", "找附近的商店", true], ["shop", "商店", true], ["log", "更新记录", true], ["deals", "特价一览", true]] },   // #/shops/list、#/shops/find、#/shops/shop/<id>（迁移 067；底栏高亮「采购」）   // #/scan：拍小票 / 贴线上订单，AI 读成清单后入库（底栏高亮“采购”）
  me:       { name: "我的",   subs: [["stats", "家里的数字"], ["settings", "设置"], ["about", "介绍"], ["releases", "发布日志"]] },
  item:     { name: "物品",   subs: null },   // #/item/new?cat=xx 或 #/item/<id>
  asset:    { name: "设备",   subs: null },   // #/asset/new?type=xx 或 #/asset/<id>（含保养记录）
  bill:     { name: "账单",   subs: null },   // #/bill/new?category=xx 或 #/bill/<id>（含缴费记录）
  otbill:   { name: "账单",   subs: null },   // 一次性账单：#/otbill/new 或 #/otbill/<id>（2026-11 起不再挂在「一次性账单」目录页下面）
};
// 独立整页表单（物品、设备、账单）：进入时记住来源页，离开时恢复滚动位置
const FORM_SECTIONS = new Set(["item", "asset", "bill", "otbill"]);
export const isFormSection = (r) => FORM_SECTIONS.has(r?.section);

export function parseRoute(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, "");
  const [path, qs] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "gear") parts.splice(0, 1, "pantry", "gear");
  if (parts[0] === "scan") parts.splice(0, 1, "pantry", "scan");   // 2026-11-15：录入购物搬到 储藏 / 录入购物；旧链接、已保存的快捷操作照旧能用
  if (parts[0] === "house" && parts[1] === "vehicles") parts.splice(1, 1);   // 「房屋 / 车辆」列表页已取消（车辆在房屋首页的「汽车」区）：旧链接、书签、快捷操作都回房屋首页
  if (parts[0] === "finance") parts[0] = "bills";   // 新名字的网址 #/finance/… = #/bills/…（内部 id 不改，旧链接零迁移）   // 旧链接 #/gear → 储藏 / 家居耐用品
  const query = new URLSearchParams(qs || "");
  if (parts[0] === "bills" && parts[1] === "spend" && query.get("tab") === "import") { parts[1] = "statements"; query.delete("tab"); }   // 银行导入搬到 财务 → 对账单（花费和收入共用）
  if (parts[0] === "bills" && parts[1] === "income" && query.get("tab") === "report") query.set("tab", "compare");   // 收入「报表」改名「收支对比」
  if (parts[0] === "house" && parts[1] === "pages") parts[1] = "overview";   // 2026-11-16：取消「页面目录」这一层，点房产直接进概览；旧链接照样能用（?prop= 照旧）
  if (parts[0] === "me" && parts[1] === "settings" && query.get("sec") === "income") { parts.splice(0, 2, "bills", "income"); query.delete("sec"); query.set("tab", "plan"); }   // 收入与预算已并入 财务 → 收入 → 预算与计划
  // 账单页路径整理（2026-11）：「周期性账单」「一次性账单」目录页取消。旧网址、已保存的快捷操作照样能用，自动跳到新位置：
  //   #/bills/recurring、list、history → 全部账单（只看周期性）/ 概览；#/bills/onetime、medical → 全部账单（只看一次性）；
  //   #/bills/onetime?bill=ID → #/otbill/ID；?people=1 → 设置 / 家庭成员；#/bills/overview?asset=KEY → #/bills/overview/KEY
  if (parts[0] === "bills") {
    const sub = parts[1], toAll = (type) => { parts[1] = "all"; parts.length = 2; query.set("type", type); query.delete("tab"); const pr = query.get("prop"); if (pr) { query.delete("prop"); if (!query.get("asset")) query.set("asset", `property:${pr}`); } };
    if (sub === "recurring" || sub === "list") { if (query.get("tab") === "history") { parts[1] = "overview"; parts.length = 2; query.delete("tab"); } else toAll("recurring"); }
    else if (sub === "history") { parts[1] = "overview"; parts.length = 2; }
    else if (sub === "onetime" || sub === "medical") {
      const bill = query.get("bill");
      if (bill) { query.delete("bill"); parts.splice(0, 2, "otbill", bill); }
      else if (query.get("people")) { query.delete("people"); query.set("sec", "family"); parts.splice(0, 2, "me", "settings"); }
      else toAll("onetime");
    } else if (sub === "overview" && query.get("asset") && !parts[2]) { parts[2] = query.get("asset"); query.delete("asset"); }
    const alias = { loans: ["debts", null], debt: ["debts", null], lending: ["debts", "personal"], "net-worth": ["networth", null], nw: ["networth", null] }[parts[1]];
    if (alias) { parts[1] = alias[0]; if (alias[1] && !query.has("tab")) query.set("tab", alias[1]); }
  }
  let section = SECTIONS[parts[0]] ? parts[0] : "today";
  const def = SECTIONS[section].subs;
  let sub = parts[1] || null, id = null;
  if (FORM_SECTIONS.has(section)) { id = parts[1] || "new"; sub = null; }
  else if (def) { if (!sub) sub = section === "pantry" ? "overview" : section === "shops" ? "list" : section === "shopping" ? "home" : "menu";   // 储藏首页 = 储藏概览（2026-11-06，概览顶上一排入口）
     else if (!def.some(([k]) => k === sub)) sub = def[0][0]; id = parts[2] || null; }   // #/house 不带二级 → 目录页
  else sub = null;
  return { section, sub, id, q: query };
}

export const href = (section, sub, extra = "") => `#/${section}${sub ? `/${sub}` : ""}${extra}`;
export const routeKey = (r) => `${r.section}/${r.sub || ""}/${r.id || ""}`;

/* 「‹ 返回」= 回到刚才来的那一页；直接打开 / 刷新后没有上一页时退到上一层（面包屑里的父级）。
 * 自己记一个「来路」栈（不靠浏览器历史）：每次换页把上一页压进去，返回时弹出一个并用 replace 过去（不再往历史里加条目），
 * 所以返回永远只会越退越少，不会在「明细 ↔ 花费」之间来回转圈。四个姊妹应用同一套规则。 */
const nav = { last: location.hash || "#/", stack: [], silent: false };
window.addEventListener("hashchange", () => {
  const now = location.hash || "#/";
  if (nav.silent) nav.silent = false;
  else if (now !== nav.last) { nav.stack.push(nav.last); if (nav.stack.length > 30) nav.stack.shift(); }
  nav.last = now;
});
export function goBack(fallback = "#/") {
  let to = null;
  while (nav.stack.length) { const p = nav.stack.pop(); if (p !== nav.last) { to = p; break; } }
  go(to || fallback, { replace: true });
}
/** 跳转；replace=true 时不新增历史记录 */
export function go(hash, { replace = false } = {}) {
  if (location.hash === hash) { nav.silent = true; window.dispatchEvent(new HashChangeEvent("hashchange")); return; }
  if (replace) { history.replaceState(null, "", hash); nav.silent = true; window.dispatchEvent(new HashChangeEvent("hashchange")); }
  else location.hash = hash;
}
