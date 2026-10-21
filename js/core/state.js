export const state = {
  route: { section: "today", sub: null, id: null, q: new URLSearchParams() },
  prevRoute: null,                     // 进入物品编辑页之前所在的页面，用于“返回”
  prevHash: null,                      // 进入表单页之前的网址：枢纽页“返回”直接跳回去
  houseProfile: null,                  // 房屋资料（第一期：房型、材料、设施）
  houseEnabled: (() => { try { return localStorage.getItem("hmh-house-off") !== "1"; } catch { return true; } })(),
  gearEnabled: (() => { try { return localStorage.getItem("hmh-gear-off") !== "1"; } catch { return true; } })(),
  billsEnabled: (() => { try { return localStorage.getItem("hmh-bills-off") !== "1"; } catch { return true; } })(),
  items: [], logs: [], shopping: [], purchases: [], members: [],
  assets: [], maintLogs: [], seasonalDone: [],  // 第二期：设备档案、保养记录、季节任务完成记录
  assetsEnriched: [],
  properties: [], propertyId: null,            // 多房产：当前查看的房产（房屋资料、设备、季节任务按它过滤）
  houseProfiles: {},                           // 全部房产的房屋资料 { property_id: profile }（提醒总线要看所有房产）
  today: (() => { try { return JSON.parse(localStorage.getItem("hmh-today") || "{}"); } catch { return {}; } })(),   // 首页偏好：{ mode: severity|property, mine, focus }
  bills: [], billPayments: [], billsEnriched: [],   // 账单 B1
  assetFilter: { q: "", type: "all", service: "all", warranty: "all", loc: "all", sort: "alert" },   // 设备保养页的搜索与筛选
  billsFilter: { property: "all", cat: "all", autopay: "all", channel: "all", q: "", sort: "category" },
  payFilter: { bill: "all", year: "all", status: "all", sort: "new", limit: 50 },   // 缴费记录的筛选与排序
  shopFilter: { cat: "all", who: "all", sort: "new" },                             // 采购清单的筛选与排序
  dealFilter: "all",                                                               // 交易清单：全部 / 未完成 / 逾期 / 必须
  tasksOnlyUndone: false,                                                          // 季节任务：只看未完成
  editProperty: null,                          // 设置页：正在编辑的房产 id（"new" = 新建）
  deleteProperty: null,                        // 设置页：正在确认彻底删除的已归档房产 id
  deals: [], dealDone: [],                     // 房产交易（买入 / 卖出 / 退租）与清单完成记录
  dealOverrides: [], dealCustom: [],           // 交易清单：模板任务的应完成日期调整、自定义事项
  dealTaskEdit: null,                          // 交易清单：正在编辑的事项 { deal, key } 或新建 { deal, key: "", stage }
  dealView: (() => { try { return localStorage.getItem("hmh-deal-view") === "timeline" ? "timeline" : "list"; } catch { return "list"; } })(),   // 交易页视图：list 清单 / timeline 时间线
  closeout: null,                           // 交易页：退出向导是否展开
  quickEdit: false,                    // 首页：快捷操作编辑模式
  quickAdd: false,                     // 首页：正在添加自定义快捷操作
  tasksYM: null,                       // 季节任务页当前查看的年月 "YYYY-MM"（null = 本月）
  customSeasonal: [],                  // 自定义季节任务（每年重复 / 一次性，按房产）
  seasonForm: null,                    // 正在编辑的自定义任务 { id } 或新建 { id: null }
  incomes: [],                                 // 成员收入：家主是全家，其他人只有自己的一行
  incomePrompt: false,                         // 刚改了收入：问家主要不要重新生成预算
  budget: null,                                // 预算设置：{ income_amount, income_period, savings_pct, cat_budgets }
  shopAdvice: null,                            // 采购清单：刚加入的带预估金额的项目的预算提示
  spendEdit: null,                             // 花费记录：正在就地编辑的那一笔 id
  spendFilter: { q: "", cat: "all", store: "all", stores: null, grp: null, month: "all", months: null, sort: "new", limit: 20 },   // 花费记录的搜索、筛选、排序
  stats: { months: 6, month: null, cat: null, itemId: null },
  filter: { space: "pantry", cat: "all", sub: "all", q: "", status: "all", loc: "all", sort: "default" },   // 库存清单：空间、分类、关键词、状态、存放位置
  locForm: null,                               // 设置 → 存放位置：正在新建 / 重命名的位置 { id?, name, grp, replaces?, oldName? }
  skipAutosave: false,                         // 点了取消 / 保存 / 删除后离开表单页：不自动保存
  tabReset: null,                              // 刚手动点了哪个底部页签：进入后恢复该页签的默认筛选
  diet: localStorage.getItem("hmh-diet") || "general",
  mealShift: 0,
  user: null, household: null, households: [], displayName: "我",
  loginMode: "email", phonePending: null,   // 登录页：邮箱 / 手机号 / 邀请码；已发送验证码的手机号
  pending: {},                              // 读得慢、先放过去的表（maint / seasonal / payments / logs）：true = 还在后台读
  pendingJoin: null,                        // 邀请码直接进入：匿名登录成功后要加入的 { code, name }
  editMember: null,                         // 设置页：家主正在改称呼的成员 user_id
  lastAlertCount: null,
};

export const STATUS = {
  out:  { label: "缺货",     cls: "b-out",  rank: 0 },
  low:  { label: "少货",     cls: "b-low",  rank: 1 },
  soon: { label: "即将告罄", cls: "b-soon", rank: 2 },
  ok:   { label: "充足",     cls: "b-ok",   rank: 3 },
};
