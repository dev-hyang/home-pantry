/* 反复运行 split-module.cjs：新文件如果还反向引用原文件里的符号，就把这些符号也加进 names 再来一遍，直到没有反向引用。
 *   node --expose-internals scripts/dev/split-closure.cjs <spec.json> <新文件路径>
 * 要求原文件在 git 里是干净的（每轮都会 git checkout 还原再重做）。小心：会递归地把一大串依赖都拽进新文件，
 * 超过 12 轮或新文件超过 300 行就停下来，让人判断是不是该换个切法。 */
const fs = require("fs"), cp = require("child_process");
const [specPath, target] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(specPath, "utf8")), file = spec.files.find((f) => f.path === target);
if (!file) throw new Error("spec 里没有 " + target);
const src = spec.source;
for (let round = 1; round <= 12; round++) {
  cp.execSync(`git checkout ${src}`, { stdio: "ignore" });
  if (fs.existsSync(target)) fs.unlinkSync(target);
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + "\n");
  const out = cp.execSync(`node --expose-internals scripts/dev/split-module.cjs ${specPath}`, { encoding: "utf8" });
  const text = fs.readFileSync(target, "utf8");
  const rel = require("path").posix.relative(require("path").posix.dirname(target), src), relSpec = rel.startsWith(".") ? rel : "./" + rel;
  const back = [...text.matchAll(/import {([^}]*)} from "([^"]+)";/g)].filter((m) => m[2] === relSpec).flatMap((m) => m[1].split(",").map((x) => x.trim()).filter(Boolean));
  const lines = text.split("\n").length;
  console.log(`第 ${round} 轮：${target} ${lines} 行，反向引用 ${back.length} 个${back.length ? "：" + back.join(", ") : ""}`);
  if (!back.length) { console.log("完成"); process.exit(0); }
  if (lines > 300) { console.log("新文件超过 300 行，停下来"); process.exit(1); }
  file.names.push(...back.filter((b) => !file.names.includes(b)));
}
console.log("超过 12 轮，停下来"); process.exit(1);
