/* 测试用：给会读 window / document 的模块（core/i18n.js 等）一个空壳；放在 _dom-stub.mjs 后面 import */
globalThis.window = globalThis;
globalThis.document ??= { addEventListener() {}, documentElement: { classList: { contains: () => false } }, querySelector: () => null };
