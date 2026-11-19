/* split-module.cjs 的分析部分：一个顶层节点里「引用了哪些外面的名字」「给哪些名字赋了值」，以及整文件的未定义标识符检查。
 * 作用域是近似的（节点里任何地方声明过的名字都当成局部），只会漏报、不会误报需要的名字。 */
const fs = require("fs");
const acorn = require("internal/deps/acorn/acorn/dist/acorn");

const patternNames = (p, out = []) => {
  if (!p) return out;
  if (p.type === "Identifier") out.push(p.name);
  else if (p.type === "ObjectPattern") p.properties.forEach((x) => patternNames(x.type === "RestElement" ? x.argument : x.value, out));
  else if (p.type === "ArrayPattern") p.elements.forEach((x) => patternNames(x, out));
  else if (p.type === "AssignmentPattern") patternNames(p.left, out);
  else if (p.type === "RestElement") patternNames(p.argument, out);
  return out;
};

function analyze(root) {
  const refs = new Set(), declared = new Set(), assigned = new Set();
  const visit = (n, parent, key) => {
    if (!n || typeof n.type !== "string") return;
    switch (n.type) {
      case "Identifier": {
        const p = parent;
        const skip = (p?.type === "MemberExpression" && key === "property" && !p.computed)
          || ((p?.type === "Property" || p?.type === "MethodDefinition" || p?.type === "PropertyDefinition") && key === "key" && !p.computed)
          || ((p?.type === "LabeledStatement" || p?.type === "BreakStatement" || p?.type === "ContinueStatement") && key === "label");
        if (!skip) refs.add(n.name);
        return;
      }
      case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunctionExpression":
        if (n.id) declared.add(n.id.name);
        n.params.forEach((q) => { patternNames(q).forEach((x) => declared.add(x)); bindingDefaults(q); });
        visit(n.body, n, "body"); return;
      case "ClassDeclaration": case "ClassExpression":
        if (n.id) declared.add(n.id.name); visit(n.superClass, n, "superClass"); visit(n.body, n, "body"); return;
      case "VariableDeclarator":
        patternNames(n.id).forEach((x) => declared.add(x)); bindingDefaults(n.id); visit(n.init, n, "init"); return;
      case "CatchClause":
        if (n.param) { patternNames(n.param).forEach((x) => declared.add(x)); bindingDefaults(n.param); } visit(n.body, n, "body"); return;
      case "AssignmentExpression":
        if (n.left.type === "Identifier") assigned.add(n.left.name);
        break;
      case "UpdateExpression":
        if (n.argument.type === "Identifier") assigned.add(n.argument.name);
        break;
      default: break;
    }
    for (const k of Object.keys(n)) {
      if (k === "type" || k === "loc" || k === "start" || k === "end") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((x) => visit(x, n, k)); else if (v && typeof v.type === "string") visit(v, n, k);
    }
  };
  // 解构 / 参数里的默认值、计算属性名是真正的引用
  const bindingDefaults = (p) => {
    if (!p) return;
    if (p.type === "AssignmentPattern") { bindingDefaults(p.left); visit(p.right, p, "right"); }
    else if (p.type === "ObjectPattern") p.properties.forEach((x) => { if (x.type === "RestElement") bindingDefaults(x.argument); else { if (x.computed) visit(x.key, x, "key"); bindingDefaults(x.value); } });
    else if (p.type === "ArrayPattern") p.elements.forEach(bindingDefaults);
    else if (p.type === "RestElement") bindingDefaults(p.argument);
  };
  visit(root, null, null);
  return { free: new Set([...refs].filter((x) => !declared.has(x))), assigned: new Set([...assigned].filter((x) => !declared.has(x))) };
}

const BROWSER = "window document navigator location history localStorage sessionStorage fetch alert confirm prompt console setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame requestIdleCallback performance Intl URL URLSearchParams Event CustomEvent FormData Notification matchMedia getComputedStyle MutationObserver IntersectionObserver ResizeObserver HTMLElement HTMLInputElement HTMLSelectElement HTMLButtonElement HTMLFormElement HTMLTextAreaElement HTMLDialogElement Element Node File FileReader Blob Image Audio crypto atob btoa structuredClone AbortController TextEncoder TextDecoder queueMicrotask Units HOUSE VEHICLES CARE DEALS BILLS GUIDES CARDS Charts CSS RadioNodeList CATEGORIES TRIP VEHICLE_CAT MAINT_CAT".split(" ");

function checkFiles(files) {
  const globals = new Set([...Object.getOwnPropertyNames(globalThis), ...BROWSER, "undefined", "arguments"]);
  let bad = 0;
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
    let ast; try { ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "module" }); } catch (e) { console.log(`SYNTAX ${f}: ${e.message}`); bad++; continue; }
    const top = new Set();
    for (const n of ast.body) {
      if (n.type === "ImportDeclaration") n.specifiers.forEach((s) => top.add(s.local.name));
      else { const d = n.type === "ExportNamedDeclaration" && n.declaration ? n.declaration : n;
        if (d.type === "FunctionDeclaration" || d.type === "ClassDeclaration") top.add(d.id.name);
        else if (d.type === "VariableDeclaration") d.declarations.forEach((x) => patternNames(x.id).forEach((y) => top.add(y))); }
    }
    const imported = new Set(); for (const n of ast.body) if (n.type === "ImportDeclaration") n.specifiers.forEach((x) => imported.add(x.local.name));
    const unknown = new Set(), assignedImport = new Set();
    for (const n of ast.body) { if (n.type === "ImportDeclaration") continue; const r = analyze(n); for (const nm of r.free) if (!top.has(nm) && !globals.has(nm)) unknown.add(nm); for (const nm of r.assigned) if (imported.has(nm)) assignedImport.add(nm); }
    if (assignedImport.size) { console.log(`!! ${f}  给导入的变量赋值（打包会报错，要改成对象属性或 setter）：${[...assignedImport].join(", ")}`); bad++; }
    console.log(`${unknown.size ? "??" : "ok"} ${f}${unknown.size ? "  未解析：" + [...unknown].join(", ") : ""}`);
    if (unknown.size) bad++;
  }
  process.exitCode = bad ? 1 : 0;
}
/** 节点里的动态 import("…")：返回 [{ start, end, value }]（位置是整个源文件里的偏移） */
function dynamicImports(root) {
  const out = [];
  (function walk(n) {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "ImportExpression" && n.source.type === "Literal" && typeof n.source.value === "string") out.push({ start: n.source.start, end: n.source.end, value: n.source.value });
    for (const k of Object.keys(n)) { if (k === "loc") continue; const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === "string") walk(v); }
  })(root);
  return out;
}
module.exports = { collect: { analyze, patternNames, dynamicImports }, checkFiles };
