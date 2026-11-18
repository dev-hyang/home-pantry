/* 页面模块按需加载：没访问过的页面，代码不下载、不解析。
 *   const M = lazyModule(() => import("./x.js"));          // 第一次用到才下载
 *   M.onLoad((ns) => ns.initX({ render }));                // 模块加载完立刻执行一次（原来写在启动时的 init）
 *   const viewX = lazyFn(M, "viewX");                      // 调用点照旧写 viewX(...)
 * 已加载：包装函数直接同步调用原函数，返回值不变。
 * 还没加载：先去加载，再调用，返回 Promise。画页面的函数（viewX）因此会先返回 Promise，
 * 由 renderBody 显示「加载中…」，加载完重画；点按钮的动作（awaited / return）直接等它就行。 */
export function lazyModule(loader) {
  const m = {
    ns: null, p: null, hooks: [],
    load() {
      return (m.p ||= loader().then((ns) => { m.ns = ns; for (const h of m.hooks.splice(0)) h(ns); return ns; })
        .catch((e) => { m.p = null; throw e; }));   // 失败（断网）：下次再试
    },
    onLoad(fn) { if (m.ns) fn(m.ns); else m.hooks.push(fn); },
  };
  return m;
}

/** 导出函数的包装；只用于函数导出（常量、可变变量不能这样包） */
export const lazyFn = (m, name) => (...args) => (m.ns ? m.ns[name](...args) : m.load().then((ns) => ns[name](...args)));
