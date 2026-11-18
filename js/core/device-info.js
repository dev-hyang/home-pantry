/* 从浏览器的 User-Agent 认出「什么设备 / 什么系统 / 什么浏览器」，写进登录记录。纯函数（Node 测试也引用）。
 * 存的是英文标准词（iPhone / Android phone / Windows computer…），界面显示时再翻译；浏览器和系统带大版本号（升级不算新设备：服务端比较时去掉版本号）。 */
export function deviceInfo(ua = "", { touchPoints = 0 } = {}) {
  const u = String(ua || "");
  let device = "Computer", os = "Unknown";
  if (/iPhone/.test(u)) { device = "iPhone"; os = `iOS ${(u.match(/OS (\d+)[_.]/) || [])[1] || ""}`.trim(); }
  else if (/iPad/.test(u) || (/Macintosh/.test(u) && touchPoints > 1)) { device = "iPad"; os = "iPadOS"; }
  else if (/Android/.test(u)) { device = /Mobile/.test(u) ? "Android phone" : "Android tablet"; os = `Android ${(u.match(/Android (\d+)/) || [])[1] || ""}`.trim(); }
  else if (/CrOS/.test(u)) { device = "Chromebook"; os = "ChromeOS"; }
  else if (/Windows/.test(u)) { device = "Windows computer"; os = "Windows"; }
  else if (/Macintosh|Mac OS X/.test(u)) { device = "Mac computer"; os = "macOS"; }
  else if (/Linux|X11/.test(u)) { device = "Linux computer"; os = "Linux"; }
  const v = (re) => (u.match(re) || [])[1] || "";
  let browser = "Browser";
  if (/Edg(e|A|iOS)?\//.test(u)) browser = `Edge ${v(/Edg(?:e|A|iOS)?\/(\d+)/)}`;
  else if (/OPR\/|Opera/.test(u)) browser = `Opera ${v(/OPR\/(\d+)/)}`;
  else if (/Firefox|FxiOS/.test(u)) browser = `Firefox ${v(/(?:Firefox|FxiOS)\/(\d+)/)}`;
  else if (/Chrome|CriOS/.test(u)) browser = `Chrome ${v(/(?:Chrome|CriOS)\/(\d+)/)}`;
  else if (/Safari/.test(u)) browser = `Safari ${v(/Version\/(\d+)/)}`;
  return { device, os, browser: browser.trim() };
}
export const DEVICE_ICON = { iPhone: "📱", "Android phone": "📱", iPad: "📲", "Android tablet": "📲", Chromebook: "💻", "Windows computer": "💻", "Mac computer": "💻", "Linux computer": "💻" };
