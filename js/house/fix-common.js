/* 「出了问题」各部分共用的小件。从 fix.js 抽出来，各部分依赖这里。 */
import { $ } from "../core/util.js";
import { state } from "../core/state.js";
import { viewFix } from "./fix-page.js";

export const C = () => window.CARE, H = () => window.HOUSE;
export const MAX_IMAGES = 3;
export const SHOP_CAT = "house_repair";
   // 配件进购物车的分类：汽车房屋消耗品 → 维修耗材
// 常用店的搜索入口（不是比价：模型不联网，价格只是估计；点进去按价格排序自己比）
export const STORES = {
  na: [["Home Depot", "https://www.homedepot.com/s/"], ["Lowe's", "https://www.lowes.com/search?searchTerm="], ["Ace Hardware", "https://www.acehardware.com/search?query="], ["Menards", "https://www.menards.com/main/search.html?search="], ["Amazon", "https://www.amazon.com/s?k="], ["Walmart", "https://www.walmart.com/search?q="]],
  cn: [["京东", "https://search.jd.com/Search?keyword="], ["淘宝", "https://s.taobao.com/search?q="], ["拼多多", "https://mobile.yangkeduo.com/search_result.html?search_key="]],
};
/** 车辆页的「问咩咩」：常用问题按钮（点一下就把这句话发给咩咩）。label 是按钮上的短句，q 是真正问的话；ev / ice 限定动力类型（没写 = 都有） */
const VEH_QUICK = [
  { label: "发动机故障灯亮了", q: "仪表盘上的发动机故障灯（Check Engine）亮了，车还能开吗？最可能是什么原因，我该先查什么？", ice: true },
  { label: "胎压灯亮了", q: "胎压警告灯亮了。该怎么处理？要补多少气、怎么判断是不是漏气或需要换胎？" },
  { label: "刹车有异响", q: "刹车时有异响（吱吱声 / 摩擦声 / 咔咔声），或者刹车踏板变软。可能是什么问题，要多久处理？" },
  { label: "方向盘抖动", q: "开到一定速度时方向盘或车身抖动。可能是什么原因（动平衡、四轮定位、刹车盘…），怎么排查？" },
  { label: "打不着火 / 没电", q: "车打不着火或者启动无力，点火时咔哒咔哒响。是 12V 电瓶没电吗？怎么搭电、怎么判断要不要换电瓶？" },
  { label: "空调不制冷", q: "空调不制冷或者出风不够凉。可能是什么原因（缺冷媒、压缩机、空调滤芯、冷凝器…），哪些我能自己查？" },
  { label: "油耗变高了", q: "最近油耗突然变高。可能是什么原因，哪些我能自己先排查？", ice: true },
  { label: "机油灯亮了", q: "机油压力灯或机油更换提示灯亮了。能不能继续开？该怎么检查机油、什么时候必须停车？", ice: true },
  { label: "水温高 / 开锅", q: "水温表偏高或者提示发动机过热。现在该怎么处理？可能是什么原因，什么情况必须停车叫拖车？", ice: true },
  { label: "怠速抖动", q: "怠速时车身抖动或转速不稳。可能是什么原因（火花塞、点火线圈、积碳、进气…），怎么排查？", ice: true },
  { label: "充电变慢 / 充不进", q: "电动车充电变慢，或者充不进电 / 充到一半停了。可能是充电桩、充电线、电池还是车的问题，怎么排查？", ev: true },
  { label: "续航突然变短", q: "电动车续航突然比平时短很多。可能是什么原因（低温、胎压、驾驶习惯、电池健康…），怎么判断电池有没有问题？", ev: true },
];
export const vehQuick = (a) => { const pt = window.VEHICLES?.POWERTRAINS?.[a?.type] || {}; return VEH_QUICK.filter((x) => (!x.ice || pt.ice !== false) && (!x.ev || pt.ev)); };
// 汽配店的搜索入口（车辆页的配件用；同样不是比价）
export const VEH_STORES = {
  na: [["AutoZone", "https://www.autozone.com/searchresult?searchText="], ["O'Reilly", "https://www.oreillyauto.com/search?q="], ["Advance Auto", "https://shop.advanceautoparts.com/web/SearchResults?searchTerm="], ["RockAuto", "https://www.rockauto.com/en/partsearch/?partnum="], ["Amazon", "https://www.amazon.com/s?k="]],
  cn: [["京东", "https://search.jd.com/Search?keyword="], ["淘宝", "https://s.taobao.com/search?q="], ["途虎养车", "https://www.tuhu.cn/search?keyword="]],
};
export const region = () => state.houseProfile?.region || (window.Units?.region?.system === "us" ? "na" : "cn");
export const fx = () => (state.fix ||= { asset: "", text: "", images: [], busy: false, error: "", result: null, raw: "", added: {}, logged: false });
export const PARTS = new Map();
   // 本次渲染登记的配件：key → part（按钮只带 key，不把数据塞进属性）
export const repaint = () => { const m = $("#main"); if (m && state.route.section === "house" && state.route.sub === "fix") m.innerHTML = viewFix(); };
