/* 把一个领域模块改成「第一次用到才下载」（开发用，不随网页发布）。用法：
 *   node --expose-internals scripts/dev/lazify.cjs <spec.json> [--dry]
 * spec.json：{ "modules": [ { "module": "income/views.js", "key": "incomeViews", "skip": ["符号…"], "deps": ["别的 key"] } ] }
 * 做的事：对「启动时仍会加载的文件」（从 js/main.js 静态引用出发、不经过这些懒加载模块能走到的文件），把 import { a, b } from "<模块>"
 *   换成 import { a, b } from "…/app/lazy-modules.js"（那里登记 LZ.<key> = lazyModule(() => import("…"))，每个符号是 lazyFn 包装）。
 * 只能包函数导出；skip 里列的符号（已经抽成小模块的）不动，如果仍从该模块引用就报告出来。
 * 常量 / 可变变量 / 对象不能包装，也会报告，要先手工抽到小模块里。需要同步结果的调用点（返回值要立刻用的）要自己改成 await。 */
const fs = require("fs"), path = require("path");
const acorn = require("internal/deps/acorn/acorn/dist/acorn");
const { collect } = require("./split-analyze.cjs");

const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), dry = process.argv.includes("--dry");
const mods = Object.fromEntries(spec.modules.map((m) => [("js/" + m.module).replace(/\\/g, "/"), m]));
const readJs = (f) => fs.readFileSync(f, "utf8");
const parse = (s) => acorn.parse(s, { ecmaVersion: "latest", sourceType: "module", locations: true });
const all = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.posix.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith(".js")) all.push(p); } })("js");
const norm = (f) => f.replace(/\\/g, "/");
const resolveImp = (from, src) => path.posix.normalize(path.posix.join(path.posix.dirname(from), src));
const imports = (f) => parse(readJs(f).replace(/\r\n/g, "\n")).body.filter((n) => n.type === "ImportDeclaration" || (n.type === "ExportNamedDeclaration" && n.source) || n.type === "ExportAllDeclaration");
// 启动时仍会加载的文件：从 main.js 静态引用出发，遇到懒加载模块就不再往里走
const eager = new Set(), todo = ["js/main.js"];
while (todo.length) {
  const f = todo.pop(); if (eager.has(f) || mods[f]) continue; eager.add(f);
  for (const n of imports(f)) { if (!n.source.value.startsWith(".")) continue; const t = resolveImp(f, n.source.value); if (all.includes(t)) todo.push(t); }
}
const isFn = (modFile, id) => { const src = readJs(modFile); return new RegExp(String.raw`export\s+(async\s+)?function\s+${id}\b`).test(src) || new RegExp(String.raw`export\s+const\s+${id}\s*=\s*(async\s*)?(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>`).test(src) || new RegExp(String.raw`export\s+const\s+${id}\s*=\s*(async\s+)?function`).test(src); };
const problems = [], wrap = {}, edits = {};   // wrap[key] = Set(符号)
for (const f of eager) {
  const raw = readJs(f), crlf = raw.includes("\r\n"), src = raw.replace(/\r\n/g, "\n"), ast = parse(src);
  const rel = path.posix.relative(path.posix.dirname(f), "js/app/lazy-modules.js"), relPath = rel.startsWith(".") ? rel : "./" + rel;
  const eds = []; const add = {};
  for (const n of ast.body) {
    if (!(n.type === "ImportDeclaration" || (n.type === "ExportNamedDeclaration" && n.source) || n.type === "ExportAllDeclaration") || !n.source.value.startsWith(".")) continue;
    const m = mods[resolveImp(f, n.source.value)]; if (!m) continue;
    if (n.type !== "ImportDeclaration") { problems.push(`${f}: 对 ${m.module} 有 export … from（要手工处理）`); continue; }
    if (n.specifiers.length === 0) { problems.push(`${f}: 对 ${m.module} 有只为副作用的 import（要手工处理）`); continue; }
    const keep = [], move = [];
    for (const s of n.specifiers) {
      if (s.type !== "ImportSpecifier") { problems.push(`${f}: ${m.module} 的默认 / 命名空间导入（要手工处理）`); keep.push(s); continue; }
      const nm = s.imported.name;
      if (s.local.name !== nm) { problems.push(`${f}: ${m.module} 的改名导入 ${nm} as ${s.local.name}`); keep.push(s); continue; }
      if ((m.skip || []).includes(nm)) { problems.push(`${f}: 仍从 ${m.module} 引用 ${nm}（它应该已经抽到别处）`); keep.push(s); continue; }
      if (!isFn(("js/" + m.module), nm)) { problems.push(`${f}: ${m.module} 的 ${nm} 不是函数导出，不能包装`); keep.push(s); continue; }
      move.push(nm); (wrap[m.key] ||= new Set()).add(nm);
    }
    if (!move.length) continue;
    (add[relPath] ||= []).push(...move);
    const keepTxt = keep.length ? `import { ${keep.map((s) => (s.imported.name === s.local.name ? s.local.name : `${s.imported.name} as ${s.local.name}`)).join(", ")} } from ${n.source.raw};\n` : "";
    eds.push({ start: n.start, end: src[n.end] === "\n" ? n.end + 1 : n.end, text: keepTxt });
  }
  if (!eds.length) continue;
  const lastImp = ast.body.filter((n) => n.type === "ImportDeclaration").pop();
  const line = Object.entries(add).map(([p, names]) => `import { ${[...new Set(names)].sort().join(", ")} } from "${p}";\n`).join("");
  eds.push({ start: lastImp.end + 1, end: lastImp.end + 1, text: line, isAdd: true });
  edits[f] = { eds, crlf, src };
}
// 懒加载登记
const lzPath = "js/app/lazy-modules.js", lzRaw = readJs(lzPath), lzCrlf = lzRaw.includes("\r\n"); let lz = lzRaw.replace(/\r\n/g, "\n");
let block = "";
for (const m of spec.modules) {
  if (!wrap[m.key]) { problems.push(`${m.module}: 没有任何启动文件在引用它的函数（是不是已经是懒加载了？）`); continue; }
  if (!lz.includes(`LZ.${m.key} =`)) {
    const rel = path.posix.relative("js/app", "js/" + m.module), p = rel.startsWith(".") ? rel : "./" + rel;
    const deps = (m.deps || []).map((d) => `LZ.${d}.load()`);
    block += `LZ.${m.key} = lazyModule(() => ${deps.length ? `Promise.all([${deps.join(", ")}]).then(() => ` : ""}import("${p}")${deps.length ? ")" : ""});\n`;
  }
  for (const nm of [...wrap[m.key]].sort()) if (!new RegExp(String.raw`export const ${nm} =`).test(lz)) block += `export const ${nm} = lazyFn(LZ.${m.key}, "${nm}");\n`;
}
console.log(problems.length ? "需要处理：\n  " + problems.join("\n  ") : "没有需要手工处理的");
console.log("会改的启动文件:", Object.keys(edits).join(", ") || "无");
console.log("登记到 lazy-modules.js 的符号:", Object.entries(wrap).map(([k, s]) => `${k}(${[...s].join(",")})`).join(" "));
if (dry) process.exit(0);
if (problems.some((p) => !p.startsWith("需要"))) { console.log("有问题，先不写入（用 --dry 看清单，处理后再来）"); process.exit(1); }
for (const [f, { eds, crlf, src }] of Object.entries(edits)) {
  let t = src; for (const e of eds.sort((a, b) => b.start - a.start)) t = t.slice(0, e.start) + e.text + t.slice(e.end);
  fs.writeFileSync(f, crlf ? t.replace(/\n/g, "\r\n") : t);
}
lz = lz.replace(/\n*$/, "\n") + block; fs.writeFileSync(lzPath, lzCrlf ? lz.replace(/\n/g, "\r\n") : lz);
console.log("已写入；接着做静态检查、构建、验证");
