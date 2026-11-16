// 把 index.html 里启动自检用的文件清单（var FILES = [...]）重新生成成「现在实际有的所有文件」。
// 新加了 .js 文件就跑一次：node scripts/sync-index-files.mjs（在 home-pantry 目录）。
// 注：发新版时的缓存刷新已经改成「刷新浏览器实际加载过的全部脚本」，这张清单缺了也不会再出错，只是自检报告少列几个文件。
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const rel = (p) => relative(root, p).split("\\").join("/");
const top = ["styles.css", "config.js", "units.js", "charts.js", "data.js"];
const files = [...top, ...walk(join(root, "data")).map(rel).filter((f) => f.endsWith(".js")).sort(), ...walk(join(root, "js")).map(rel).filter((f) => f.endsWith(".js")).sort()];

const path = join(root, "index.html");
const html = readFileSync(path, "utf8");
const start = html.indexOf("var FILES = ["), end = html.indexOf("];", start);
if (start < 0 || end < 0) throw new Error("index.html 里找不到 var FILES = [...]");
const lines = [];
for (let i = 0; i < files.length; i += 6) lines.push("        " + files.slice(i, i + 6).map((f) => JSON.stringify(f)).join(", "));
const out = html.slice(0, start) + "var FILES = [\n" + lines.join(",\n") + "]" + html.slice(end + 1);
writeFileSync(path, out);
console.log(`index.html FILES: ${files.length} files`);
