/* 网址路由（hash）：#/section/sub/id?query
 * 好处：手机返回手势、浏览器后退天然可用；页面可以直接分享给家人。 */
export const SECTIONS = {
  today:    { name: "今日",   subs: null },
  pantry:   { name: "储藏",   subs: [["overview", "概览"], ["inventory", "库存"], ["gear", "装备"], ["meals", "菜单"]] },   // 装备：耐用品和工具，只记数量和位置
  // 房屋：#/house 是房产列表；#/house/pages 是某套房产的页面目录；车辆挂家庭，从房产列表进
  house:    { name: "房屋",   subs: [["overview", "概览"], ["supplies", "房屋耗材"], ["assets", "设备"], ["tasks", "季节任务"], ["deal", "交易"], ["profile", "房屋资料"],
                                     ["vehicles", "车辆", true], ["pages", "页面", true], ["template", "推荐耗材", true], ["asset-template", "生成设备", true]] },  // 第三项 true = 不在目录显示
  bills:    { name: "账单",   subs: [["overview", "概览"], ["list", "清单"], ["history", "记录"], ["template", "常用账单", true]] },
  shopping: { name: "采购",   subs: null },
  me:       { name: "我的",   subs: [["stats", "统计"], ["settings", "设置"], ["about", "介绍"]] },
  item:     { name: "物品",   subs: null },   // #/item/new?cat=xx 或 #/item/<id>
  asset:    { name: "设备",   subs: null },   // #/asset/new?type=xx 或 #/asset/<id>（含保养记录）
  bill:     { name: "账单",   subs: null },   // #/bill/new?category=xx 或 #/bill/<id>（含缴费记录）
};
// 独立整页表单（物品、设备、账单）：进入时记住来源页，离开时恢复滚动位置
const FORM_SECTIONS = new Set(["item", "asset", "bill"]);
export const isFormSection = (r) => FORM_SECTIONS.has(r?.section);

export function parseRoute(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, "");
  const [path, qs] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "gear") parts.splice(0, 1, "pantry", "gear");   // 旧链接 #/gear → 储藏 / 装备
  let section = SECTIONS[parts[0]] ? parts[0] : "today";
  const def = SECTIONS[section].subs;
  let sub = parts[1] || null, id = null;
  if (FORM_SECTIONS.has(section)) { id = parts[1] || "new"; sub = null; }
  else if (def) { if (!sub) sub = "menu"; else if (!def.some(([k]) => k === sub)) sub = def[0][0]; id = parts[2] || null; }   // #/house 不带二级 → 目录页
  else sub = null;
  return { section, sub, id, q: new URLSearchParams(qs || "") };
}

export const href = (section, sub, extra = "") => `#/${section}${sub ? `/${sub}` : ""}${extra}`;
export const routeKey = (r) => `${r.section}/${r.sub || ""}/${r.id || ""}`;

/** 跳转；replace=true 时不新增历史记录 */
export function go(hash, { replace = false } = {}) {
  if (location.hash === hash) { window.dispatchEvent(new HashChangeEvent("hashchange")); return; }
  if (replace) history.replaceState(null, "", hash), window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = hash;
}
