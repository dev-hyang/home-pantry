/* 把一批符号的 import 从旧模块改成新模块（符号已经用 split-module.cjs 抽到新模块之后用）。
 *   node --expose-internals scripts/dev/repoint.cjs <旧模块> <新模块> <符号,符号,…>      （路径相对 js/，如 bills/overview-views.js）
 * 对 js/ 下所有文件：凡是 import { … } from "<旧模块>" 里含这些符号的，把这些符号拆出来改成从新模块 import（相对路径自动算），其余符号不动。
 * 新模块自己和旧模块自己不改（旧模块里如果还要用，split-module 已经给它加好了 import）。 */
const fs = require("fs"), path = require("path");
const [oldMod, newMod, namesArg] = process.argv.slice(2);
const names = new Set(namesArg.split(",").map((s) => s.trim()).filter(Boolean));
const OLD = "js/" + oldMod, NEW = "js/" + newMod;
const files = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.posix.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith(".js")) files.push(p); } })("js");
const relTo = (from, to) => { const r = path.posix.relative(path.posix.dirname(from), to); return r.startsWith(".") ? r : "./" + r; };
let changed = 0;
for (const f of files) {
  if (f === OLD || f === NEW) continue;
  const raw = fs.readFileSync(f, "utf8"), crlf = raw.includes("\r\n"); let s = raw.replace(/\r\n/g, "\n");
  const re = /^import \{([^}]*)\} from "([^"]+)";\n/gm; let m, out = "", last = 0, extra = "", hit = false;
  while ((m = re.exec(s))) {
    if (!m[2].startsWith(".") || path.posix.normalize(path.posix.join(path.posix.dirname(f), m[2])) !== OLD) continue;
    const specs = m[1].split(",").map((x) => x.trim()).filter(Boolean);
    const move = specs.filter((x) => names.has(x.split(/\s+as\s+/)[0])), keep = specs.filter((x) => !move.includes(x));
    if (!move.length) continue;
    hit = true;
    out += s.slice(last, m.index) + (keep.length ? `import { ${keep.join(", ")} } from "${m[2]}";\n` : "");
    last = m.index + m[0].length;
    extra += `import { ${move.join(", ")} } from "${relTo(f, NEW)}";\n`;
  }
  if (!hit) continue;
  out += s.slice(last);
  // 新 import 放在原来第一条该 import 所在位置之后的第一条 import 末尾；简单起见放在最后一条 import 后面
  const lastImp = [...out.matchAll(/^import [^\n]*\n/gm)].pop(); const at = lastImp.index + lastImp[0].length;
  out = out.slice(0, at) + extra + out.slice(at);
  fs.writeFileSync(f, crlf ? out.replace(/\n/g, "\r\n") : out); changed++; console.log("改:", f);
}
console.log(changed ? `共改 ${changed} 个文件` : "没有文件需要改（符号可能已经改过，或名字不对）");
