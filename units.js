/* 地区与单位
 * - 地区根据设备时区自动检测（时区取的是手机/电脑的系统设置，而不是 GPS 定位），用户可在设置页手动改。
 * - 北美（美国、加拿大）用美制单位 lb / oz / fl oz / qt / gal；中国用公制 kg / g / 斤 / L / mL。
 * - 数据库里每件物品按“录入时的单位”保存，不做批量改写；界面显示时再换算成当前地区单位。
 *   这样不同地区的家人共享同一份清单，各自看到熟悉的单位，消耗日志也始终和存储单位一致。
 */
(() => {
  "use strict";

  const REGIONS = {
    us: { id: "us", name: "美国", system: "us",     currency: "USD", locale: "en-US" },
    ca: { id: "ca", name: "加拿大", system: "us",   currency: "CAD", locale: "en-CA" },
    cn: { id: "cn", name: "中国", system: "metric", currency: "CNY", locale: "zh-CN" },
  };

  const CA_TZ = /^America\/(Toronto|Montreal|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Moncton|Glace_Bay|Goose_Bay|Whitehorse|Yellowknife|Iqaluit|Rankin_Inlet|Resolute|Cambridge_Bay|Swift_Current|Dawson|Dawson_Creek|Fort_Nelson|Creston|Atikokan|Thunder_Bay|Nipigon|Rainy_River|Inuvik|Pangnirtung)$|^Canada\//;
  const US_TZ = /^America\/(New_York|Detroit|Chicago|Denver|Phoenix|Los_Angeles|Anchorage|Juneau|Boise|Sitka|Yakutat|Nome|Metlakatla|Adak|Menominee|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)$|^Pacific\/Honolulu$|^US\//;
  const CN_TZ = /^Asia\/(Shanghai|Chongqing|Chungking|Harbin|Urumqi|Kashgar)$|^PRC$/;

  function timeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
  }

  function detect() {
    const tz = timeZone();
    if (CA_TZ.test(tz)) return "ca";
    if (US_TZ.test(tz)) return "us";
    if (CN_TZ.test(tz)) return "cn";
    const lang = (navigator.language || "").toLowerCase();   // 时区无法判断时退回浏览器语言
    if (lang === "en-us") return "us";
    if (lang.endsWith("-ca")) return "ca";
    return "cn";
  }

  // 可换算的计量单位：[类别, 换算到基准单位（g 或 mL）的系数]
  const MEASURES = {
    g: ["mass", 1], kg: ["mass", 1000], "斤": ["mass", 500],
    oz: ["mass", 28.349523125], lb: ["mass", 453.59237],
    mL: ["vol", 1], ml: ["vol", 1], L: ["vol", 1000],
    "fl oz": ["vol", 29.5735295625], qt: ["vol", 946.352946], gal: ["vol", 3785.411784],
  };

  // 跨制式显示映射（固定一对一，避免数量一大就换单位导致 +/- 步长跳变）
  const DISPLAY_MAP = {
    us:     { g: "oz", kg: "lb", "斤": "lb", mL: "fl oz", ml: "fl oz", L: "fl oz" },
    metric: { oz: "g", lb: "kg", "fl oz": "mL", qt: "L", gal: "L", ml: "mL" },
  };

  const COUNT_UNITS = ["个", "盒", "袋", "包", "瓶", "罐", "杯", "条", "把", "卷", "片", "提", "板", "支"];
  const UNIT_SETS = {
    metric: [...COUNT_UNITS, "斤", "kg", "g", "L", "mL"],
    us:     [...COUNT_UNITS, "lb", "oz", "fl oz", "qt", "gal"],
  };

  // 每次点 −/+ 的步长（按显示单位）
  const STEPS = { kg: 0.5, "斤": 1, g: 100, L: 0.5, mL: 250, lb: 1, oz: 4, "fl oz": 8, qt: 1, gal: 0.5 };

  let current = null;
  let override = null;
  try { override = localStorage.getItem("hmh-region"); } catch { /* 忽略 */ }

  function setRegion(id) {
    override = REGIONS[id] ? id : null;
    try { override ? localStorage.setItem("hmh-region", override) : localStorage.removeItem("hmh-region"); } catch { /* 忽略 */ }
    current = REGIONS[override || detect()];
    return current;
  }
  setRegion(override);

  function convert(q, from, to) {
    if (from === to) return q;
    const a = MEASURES[from], b = MEASURES[to];
    if (!a || !b || a[0] !== b[0]) return null;
    return (q * a[1]) / b[1];
  }

  const displayUnit = (u) => DISPLAY_MAP[current.system][u] || u;
  const factor = (u) => { const d = displayUnit(u); return d === u ? 1 : convert(1, u, d); };

  window.Units = {
    REGIONS, UNIT_SETS, MEASURES,
    get region() { return current; },
    get override() { return override; },
    detected: () => REGIONS[detect()],
    timeZone, setRegion, convert, displayUnit, factor,
    list: () => UNIT_SETS[current.system],
    step: (displayU) => STEPS[displayU] || 1,
    // short=true：坐标轴等空间紧张处，不显示小数
    money(v, currency = current.currency, short = false) {
      const loc = { USD: "en-US", CAD: "en-CA", CNY: "zh-CN" }[currency] || current.locale;
      const digits = short || v >= 1000 ? 0 : 2;
      try { return new Intl.NumberFormat(loc, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v); }
      catch { return `${currency} ${Number(v).toFixed(2)}`; }
    },
  };
})();
