export const state = {
  route: { section: "today", sub: null, id: null, q: new URLSearchParams() },
  prevRoute: null,                     // 进入物品编辑页之前所在的页面，用于“返回”
  houseProfile: null,                  // 房屋资料（第一期：房型、材料、设施）
  houseEnabled: (() => { try { return localStorage.getItem("hmh-house-off") !== "1"; } catch { return true; } })(),
  gearEnabled: (() => { try { return localStorage.getItem("hmh-gear-off") !== "1"; } catch { return true; } })(),
  items: [], logs: [], shopping: [], purchases: [], members: [],
  stats: { months: 6, month: null, cat: null, itemId: null },
  filter: { space: "pantry", cat: "all", q: "", status: "all" },
  diet: localStorage.getItem("hmh-diet") || "general",
  mealShift: 0,
  user: null, household: null, households: [], displayName: "我",
  lastAlertCount: null,
};

export const STATUS = {
  out:  { label: "缺货",     cls: "b-out",  rank: 0 },
  low:  { label: "少货",     cls: "b-low",  rank: 1 },
  soon: { label: "即将告罄", cls: "b-soon", rank: 2 },
  ok:   { label: "充足",     cls: "b-ok",   rank: 3 },
};
