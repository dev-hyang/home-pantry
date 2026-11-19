/* 谁静态 import 了这个文件：node scripts/dev/importers.cjs js/house/deal-page.js [更多文件…]（只看 import/export … from，不含 import()） */
const fs = require("fs"), path = require("path");
const all = []; (function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.posix.join(d, e.name); e.isDirectory() ? w(p) : p.endsWith(".js") && all.push(p); } })("js");
const re = /(?:^|\n)\s*(?:import|export)\s[^;"']*?from\s*"(\.[^"]+)"|(?:^|\n)\s*import\s*"(\.[^"]+)"/g;
for (const target of process.argv.slice(2)) {
  const who = all.filter((f) => [...fs.readFileSync(f, "utf8").matchAll(re)].some((m) => path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1] || m[2])) === target));
  console.log(target + " ←\n  " + (who.join("\n  ") || "(无)"));
}
