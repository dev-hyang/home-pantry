/* 让每次打开都核对一下脚本和样式有没有新版本（home-pantry）。
 * 问题：GitHub Pages 给文件的缓存时间是 10 分钟，推送新版本后，浏览器可能还在用旧的 .js / .css，
 *       不同文件新旧混在一起，出现「改动没生效」甚至页面报错。
 * 做法：脚本和样式的请求一律带 cache: "no-cache" 重发——文件没变时服务器回 304（几乎不花流量），变了就拿新的；
 *       断网时退回浏览器缓存。不存任何东西、不接管页面本身，所以不会出现「离线版本卡住」。 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || (r.destination !== "script" && r.destination !== "style")) return;
  if (new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r, { cache: "no-cache" }).catch(() => fetch(r)));
});
