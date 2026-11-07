/* 今日页日期旁的天气（2026-11-07）：一个图标 + 当前温度。
 * 天气来自 Open-Meteo（免费、不要 key）。只有用户点了「显示天气」并允许定位之后才请求；
 * 位置只存在这台设备的 localStorage（取到小数点后两位，约 1 公里），请求里只带这两个坐标。30 分钟内不重取。
 * 没开定位、没网、取不到时不显示温度，不报错。和家庭学堂睡眠卡的天气是同一个服务、同样的做法。 */
import { t } from "./i18n.js";

const LOC_KEY = "hmh-wxloc", WX_KEY = "hmh-wx", UNIT_KEY = "hmh-temp-unit", FRESH = 30 * 60e3;
/** 温度单位设置（我的 → 设置）："auto" 跟随地区 / "c" / "f" */
export const tempUnitPref = () => { try { const v = localStorage.getItem(UNIT_KEY); return v === "c" || v === "f" ? v : "auto"; } catch { return "auto"; } };
export const setTempUnit = (v) => { try { localStorage.setItem(UNIT_KEY, v === "c" || v === "f" ? v : "auto"); } catch { /* 忽略 */ } };
const useF = () => { const p = tempUnitPref(); return p === "f" || (p === "auto" && typeof Units !== "undefined" && Units.region?.system === "us"); };
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 记不住就算了 */ } };
let inflight = false, failedAt = 0;

export const wxLoc = () => { const l = read(LOC_KEY); return l && Number.isFinite(l.lat) && Number.isFinite(l.lon) ? l : null; };
/** WMO 天气代码 → 图标和说明（白天 / 夜里的晴天不一样） */
function iconOf(code, isDay) {
  if (code === 0) return [isDay ? "☀️" : "🌙", "晴"];
  if (code <= 2) return [isDay ? "🌤️" : "☁️", "少云"];
  if (code === 3) return ["☁️", "阴"];
  if (code === 45 || code === 48) return ["🌫️", "雾"];
  if (code >= 51 && code <= 57) return ["🌦️", "毛毛雨"];
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return ["🌧️", "雨"];
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ["🌨️", "雪"];
  if (code >= 95) return ["⛈️", "雷雨"];
  return ["🌡️", ""];
}
/** 现在能显示的天气：{ icon, label, temp }；没有返回 null。过期了在后台重取，取回来调用 onUpdate */
export function currentWeather(onUpdate) {
  const l = wxLoc(); if (!l) return null;
  const unit = useF() ? "°F" : "°C", c = read(WX_KEY), same = c && c.lat === l.lat && c.lon === l.lon && c.unit === unit, fresh = same && Date.now() - c.at < FRESH;
  if (!fresh && !inflight && Date.now() - failedAt > 5 * 60e3) fetchWx(l, onUpdate);
  if (!same) return null;
  const [icon, label] = iconOf(c.code, c.isDay);
  return { icon, label: t(label), temp: c.temp, unit: c.unit };
}
async function fetchWx(l, onUpdate) {
  inflight = true;
  try {
    const fahrenheit = useF();   // 设置里选的单位；跟随地区时美制显示华氏
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${l.lat}&longitude=${l.lon}&current=temperature_2m,weather_code,is_day${fahrenheit ? "&temperature_unit=fahrenheit" : ""}`;
    const r = await fetch(url); if (!r.ok) throw new Error(String(r.status));
    const j = await r.json(), cur = j.current || {};
    write(WX_KEY, { lat: l.lat, lon: l.lon, at: Date.now(), code: cur.weather_code, isDay: !!cur.is_day, temp: Math.round(cur.temperature_2m), unit: fahrenheit ? "°F" : "°C" });
    onUpdate?.();
  } catch { failedAt = Date.now(); }
  finally { inflight = false; }
}
/** 用户点「显示天气」：问一次定位，存两位小数的坐标，然后取天气 */
export function enableWeather(onUpdate) {
  if (!navigator.geolocation) return Promise.resolve(false);
  return new Promise((res) => navigator.geolocation.getCurrentPosition((p) => {
    const l = { lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100 };
    write(LOC_KEY, l); failedAt = 0; fetchWx(l, onUpdate); res(true);
  }, () => res(false), { maximumAge: 6 * 3600e3, timeout: 10000 }));
}
