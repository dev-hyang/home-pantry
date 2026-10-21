/* 给 Supabase 的网络请求加上“不会无限转圈”的保护：
 * - 读取（GET / HEAD）15 秒没回应就掐掉重发（最多再试 2 次）：连接卡住、被代理吞掉时，重发一条新连接通常就好了；
 * - 写入（POST / PATCH / DELETE）不掐、不重发：写入不能重复，掐了也分不清服务器有没有收到；
 * - 每个请求的耗时记在 window.__net（最近 60 条），开发者工具里 console.table(__net) 就能看到哪张表慢、重试了几次。 */
const GET_TIMEOUT = 15000, RETRIES = 2;
const log = (window.__net = window.__net || []);
const note = (e) => { log.push(e); if (log.length > 60) log.shift(); if (e.ms > 4000 || e.tries > 1) console.warn("[net] slow request", e); };
const pathOf = (u) => { try { const x = new URL(typeof u === "string" ? u : u.url); return x.pathname.replace(/^\/rest\/v1\//, "") + (x.searchParams.has("select") ? "" : ""); } catch { return String(u).slice(0, 80); } };

export async function resilientFetch(input, init = {}) {
  const method = (init.method || (typeof input !== "string" && input.method) || "GET").toUpperCase();
  const t0 = performance.now(), path = pathOf(input);
  if (method !== "GET" && method !== "HEAD") {
    const res = await fetch(input, init); note({ path, method, ms: Math.round(performance.now() - t0), status: res.status, tries: 1 }); return res;
  }
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES + 1; attempt++) {
    const ctl = new AbortController(), outer = init.signal;
    const onAbort = () => ctl.abort(); outer?.addEventListener("abort", onAbort);
    const timer = setTimeout(() => ctl.abort(), GET_TIMEOUT);
    try {
      const res = await fetch(input, { ...init, signal: ctl.signal });
      note({ path, method, ms: Math.round(performance.now() - t0), status: res.status, tries: attempt });
      return res;
    } catch (e) {
      lastErr = e;
      if (outer?.aborted) throw e;   // 调用方自己取消的，不重试
    } finally { clearTimeout(timer); outer?.removeEventListener("abort", onAbort); }
  }
  note({ path, method, ms: Math.round(performance.now() - t0), status: "failed", tries: RETRIES + 1 });
  throw lastErr;
}
