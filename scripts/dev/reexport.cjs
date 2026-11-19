/* 拆文件之后：原来对外导出、现在搬进新文件的符号，在主文件里补上转出口（别的文件、懒加载包装照旧从主文件引用）。
 *   node --expose-internals scripts/dev/reexport.cjs <主文件> <新文件> [<新文件> …]
 * 对比 git HEAD 里主文件的导出名单和现在的导出名单，缺的名字去新文件里找，找到的加 export { … } from "./新文件.js"（放在主文件最后一条 import 后面）。
 * 找不到的报告出来。 */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const acorn = require("internal/deps/acorn/acorn/dist/acorn");
const { collect } = require("./split-analyze.cjs");
const [entry, ...parts] = process.argv.slice(2);
const exportsOf = (src) => {
  const out = new Set();
  for (const n of acorn.parse(src, { ecmaVersion: "latest", sourceType: "module" }).body) {
    if (n.type === "ExportNamedDeclaration") {
      if (n.declaration) { const d = n.declaration; if (d.id) out.add(d.id.name); else d.declarations.forEach((x) => collect.patternNames(x.id).forEach((y) => out.add(y))); }
      for (const s of n.specifiers || []) out.add(s.exported.name);
    }
  }
  return out;
};
const norm = (s) => s.replace(/\r\n/g, "\n");
const before = exportsOf(norm(cp.execSync(`git show ${process.env.BASE || "HEAD"}:${entry}`, { encoding: "utf8", maxBuffer: 1e8 })));
const raw = fs.readFileSync(entry, "utf8"), crlf = raw.includes("\r\n"); let s = norm(raw);
const now = exportsOf(s);
const missing = [...before].filter((n) => !now.has(n));
const byFile = {}, lost = [];
const partExports = Object.fromEntries(parts.map((p) => [p, exportsOf(norm(fs.readFileSync(p, "utf8")))]));
for (const nm of missing) { const p = parts.find((x) => partExports[x].has(nm)); if (p) (byFile[p] ||= []).push(nm); else lost.push(nm); }
const lines = Object.entries(byFile).map(([p, names]) => { const r = path.posix.relative(path.posix.dirname(entry), p); return `export { ${names.sort().join(", ")} } from "${r.startsWith(".") ? r : "./" + r}";\n`; }).join("");
if (lines) {
  const imps = [...s.matchAll(/^(?:import|export) [^\n]*;\n/gm)]; const last = imps.length ? imps[imps.length - 1] : null; const at = last ? last.index + last[0].length : 0;
  s = s.slice(0, at) + lines + s.slice(at);
  fs.writeFileSync(entry, crlf ? s.replace(/\n/g, "\r\n") : s);
}
console.log(`原来导出 ${before.size} 个，缺 ${missing.length} 个，补了 ${missing.length - lost.length} 个转出口${lost.length ? "；找不到：" + lost.join(", ") : ""}`);
