/* 拆大文件的小工具（开发用，不随网页发布）：按行范围把一个 ES 模块的顶层代码搬进新模块，
 * 自动补 import / export，并做「未定义标识符」静态检查。解析器用 Node 自带的 acorn，所以要加 --expose-internals：
 *   node --expose-internals scripts/dev/split-module.cjs <spec.json> [--dry]
 *   node --expose-internals scripts/dev/split-module.cjs --check <file.js> ...      只做静态检查
 * spec.json：{ "source": "js/main.js", "files": [ { "path": "js/app/x.js", "doc": "一句话说明", "lines": [[97, 220]], "names": ["fnName"] } ] }（lines 和 names 都可以只给一种）
 * 顶层节点按「第一行」落在哪个范围分给哪个文件，没分到的留在原文件；节点前面的注释跟着节点走。 */
const fs = require("fs"), path = require("path");
const acorn = require("internal/deps/acorn/acorn/dist/acorn");
const { collect } = require("./split-analyze.cjs");

const norm = (s) => s.replace(/\r\n/g, "\n");
const parse = (src) => acorn.parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });
const rel = (fromFile, toFile) => { let r = path.posix.relative(path.posix.dirname(fromFile), toFile); if (!r.startsWith(".")) r = "./" + r; return r; };

function topLevel(src) {
  const ast = parse(src), nodes = [], imports = [];
  let prevEnd = 0;
  for (const n of ast.body) {
    if (n.type === "ImportDeclaration") { imports.push(n); prevEnd = n.end; continue; }
    const decl = n.type === "ExportNamedDeclaration" && n.declaration ? n.declaration : n;
    const names = decl.type === "FunctionDeclaration" || decl.type === "ClassDeclaration" ? [decl.id.name]
      : decl.type === "VariableDeclaration" ? decl.declarations.flatMap((d) => collect.patternNames(d.id)) : [];
    nodes.push({ n, decl, names, exported: decl !== n, start: prevEnd, line: n.loc.start.line, text: null });
    prevEnd = n.end;
  }
  for (const x of nodes) x.text = src.slice(x.start, x.n.end).replace(/^\s*\n/, "");
  return { ast, nodes, imports };
}

function main() {
  const [specPath, flag] = process.argv.slice(2);
  if (specPath === "--check") return require("./split-analyze.cjs").checkFiles(process.argv.slice(3));
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8")), srcPath = spec.source, raw = fs.readFileSync(srcPath, "utf8"), crlf = raw.includes("\r\n");
  const src = norm(raw), { nodes, imports } = topLevel(src);
  // 节点分给哪个文件：先按名字（names: ["onMainClick", …]），再按第一行落在哪个行范围（lines: [[a, b], …]）
  const fileOf = (x) => spec.files.find((f) => (f.names || []).some((nm) => x.names.includes(nm)) || (f.lines || []).some(([a, b]) => x.line >= a && x.line <= b));
  for (const x of nodes) x.file = fileOf(x) || null;
  // 名字表：原文件 import 进来的 / 原文件顶层声明的
  const imported = new Map(); // local -> { src, imported }
  for (const im of imports) for (const s of im.specifiers) imported.set(s.local.name, { src: im.source.value, imp: s.type === "ImportSpecifier" ? s.imported.name : s.type === "ImportDefaultSpecifier" ? "default" : "*" });
  const declaredIn = new Map(); for (const x of nodes) for (const nm of x.names) declaredIn.set(nm, x);
  const groups = new Map([[null, []], ...spec.files.map((f) => [f.path, []])]);
  for (const x of nodes) groups.get(x.file?.path ?? null).push(x);
  const needs = new Map(); // 文件 -> 用到的顶层名字
  const exportNeeded = new Set(), problems = [];
  for (const [fp, list] of groups) {
    const used = new Set(), own = new Set(list.flatMap((x) => x.names));
    for (const x of list) { const { free, assigned } = collect.analyze(x.n); free.forEach((nm) => used.add(nm));
      for (const nm of assigned) { const d = declaredIn.get(nm); if (d && (d.file?.path ?? null) !== fp) problems.push(`${fp || srcPath}: 给别的文件里声明的变量赋值：${nm}（要改成对象属性或 setter）`); } }
    needs.set(fp, new Set([...used].filter((nm) => !own.has(nm) && (imported.has(nm) || declaredIn.has(nm)))));
    for (const nm of needs.get(fp)) { const d = declaredIn.get(nm); if (d && (d.file?.path ?? null) !== fp) exportNeeded.add(nm); }
  }
  const outputs = [];
  // 一组 { imp, local } → import 语句（具名 / 默认 / 命名空间分开写）
  const fmt = (entries, source) => {
    const out = [], named = [];
    for (const e of entries) {
      if (e.imp === "*") out.push(`import * as ${e.local} from "${source}";`);
      else if (e.imp === "default") out.push(`import ${e.local} from "${source}";`);
      else named.push(e.imp === e.local ? e.local : `${e.imp} as ${e.local}`);
    }
    if (named.length) out.push(`import { ${named.join(", ")} } from "${source}";`);
    return out;
  };
  const importLines = (fp, set) => {
    const bySrc = new Map();
    const add = (r, e) => (bySrc.get(r) || bySrc.set(r, []).get(r)).push(e);
    for (const nm of [...set].sort()) {
      const im = imported.get(nm);
      if (im) add(im.src.startsWith(".") ? rel(fp, path.posix.join(path.posix.dirname(srcPath), im.src)) : im.src, { imp: im.imp, local: nm });
      else { const d = declaredIn.get(nm); add(rel(fp, d.file ? d.file.path : srcPath), { imp: nm, local: nm }); }
    }
    return [...bySrc].flatMap(([r, es]) => fmt(es, r)).join(String.fromCharCode(10));
  };
  // 搬到别的目录：节点里动态 import("./x.js") 的相对路径要按新位置重写（静态 import 在 importLines 里已处理）
  const retarget = (x, dest) => {
    const base = x.text.length - (x.n.end - x.n.start);
    let t = x.text;
    for (const d of collect.dynamicImports(x.n).filter((q) => q.value.startsWith(".")).sort((p, q) => q.start - p.start)) {
      const r = rel(dest, path.posix.join(path.posix.dirname(srcPath), d.value));
      t = t.slice(0, base + d.start - x.n.start) + JSON.stringify(r) + t.slice(base + d.end - x.n.start);
    }
    return t;
  };
  // 文本以节点末尾结束，所以节点自己的起点 = 文本长度 - 节点长度（改写路径后节点长度变了，要算进去）；被别的文件用到的名字，在这里补 export
  const body = (list, dest) => list.map((x) => {
    let text = x.text, len = x.n.end - x.n.start;
    if (dest !== srcPath) { text = retarget(x, dest); len += text.length - x.text.length; }
    if (x.exported || !x.names.some((nm) => exportNeeded.has(nm))) return text;
    const at = text.length - len;
    return text.slice(0, at) + "export " + text.slice(at);
  }).join("\n").replace(/\n{3,}/g, "\n\n");
  for (const f of spec.files) outputs.push([f.path, `/* ${f.doc} */\n${importLines(f.path, needs.get(f.path))}\n\n${body(groups.get(f.path), f.path)}\n`]);
  // 原文件：保留没搬的节点 + 还用得到的 import + 对新文件的副作用 import
  const keepNeeds = needs.get(null), keepImports = [];
  for (const im of imports) {
    if (im.specifiers.length === 0) { keepImports.push(src.slice(im.start, im.end)); continue; }
    const es = im.specifiers.filter((x) => keepNeeds.has(x.local.name)).map((x) => ({ imp: x.type === "ImportSpecifier" ? x.imported.name : x.type === "ImportDefaultSpecifier" ? "default" : "*", local: x.local.name }));
    keepImports.push(...fmt(es, im.source.value));
  }
  const fromNew = importLines(srcPath, new Set([...keepNeeds].filter((nm) => !imported.has(nm))));
  const sideFx = spec.files.filter((f) => groups.get(f.path).some((x) => x.names.length === 0)).map((f) => `import "${rel(srcPath, f.path)}";`);
  const remain = `${keepImports.join("\n")}\n${fromNew}\n${[...new Set(sideFx)].join("\n")}\n\n${body(groups.get(null), srcPath)}\n`.replace(/\n{3,}/g, "\n\n");
  outputs.push([srcPath, remain]);
  console.log(problems.length ? "问题：\n  " + problems.join("\n  ") : "没有跨文件赋值问题");
  for (const [p, t] of outputs) console.log(`${p}  ${t.split("\n").length} 行`);
  if (flag === "--dry") return;
  for (const [p, t] of outputs) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, crlf && p === srcPath ? t.replace(/\n/g, "\r\n") : t); }
  console.log("已写入；接着运行 --check 检查未定义标识符");
}
main();
