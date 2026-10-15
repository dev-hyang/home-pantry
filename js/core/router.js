/* 网址路由（hash）：#/section/sub/id?query
 * 好处：手机返回手势、浏览器后退天然可用；页面可以直接分享给家人。 */
export const SECTIONS = {
  today:    { name: "今日",   subs: null },
  pantry:   { name: "储藏",   subs: [["overview", "概览"], ["inventory", "库存"], ["meals", "菜单"]] },
  house:    { name: "房屋",   subs: [["overview", "概览"], ["supplies", "房屋耗材"], ["assets", "设备"], ["tasks", "季节任务"], ["profile", "房屋资料"],
                                     ["template", "推荐耗材", true], ["asset-template", "生成设备", true]] },  // 第三项 true = 不在二级导航显示
  gear:     { name: "装备",   subs: null },   // 耐用品和工具：只记数量和位置
  shopping: { name: "采购",   subs: null },
  me:       { name: "我的",   subs: [["stats", "统计"], ["settings", "设置"]] },
  item:     { name: "物品",   subs: null },   // #/item/new?cat=xx 或 #/item/<id>
  asset:    { name: "设备",   subs: null },   // #/asset/new?type=xx 或 #/asset/<id>（含保养记录）
};
// 独立整页表单（物品、设备）：进入时记住来源页，离开时恢复滚动位置
export const isFormSection = (r) => r?.section === "item" || r?.section === "asset";

export function parseRoute(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, "");
  const [path, qs] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  let section = SECTIONS[parts[0]] ? parts[0] : "today";
  const def = SECTIONS[section].subs;
  let sub = parts[1] || null, id = null;
  if (section === "item" || section === "asset") { id = parts[1] || "new"; sub = null; }
  else if (def) { if (!def.some(([k]) => k === sub)) sub = def[0][0]; id = parts[2] || null; }
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
