/* 测试用：让依赖 localStorage 的模块（core/state.js）能在 node 里加载。必须放在测试文件的第一行 import */
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window ??= undefined;
