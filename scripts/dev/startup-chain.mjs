/* 启动时为什么会带上某个源文件：node scripts/dev/startup-chain.mjs js/house/deal-page.js … ，打印从 js/main.js 静态引用到它的最短路径 */
import { build } from "esbuild";
const r = await build({ entryPoints: ["js/main.js"], bundle: true, splitting: true, format: "esm", outdir: ".dist-chain", write: false, metafile: true, logLevel: "error", logOverride: { "duplicate-object-key": "silent" } });
const ins = r.metafile.inputs, q = [["js/main.js"]], seen = new Set(["js/main.js"]), path = {};
while (q.length) { const p = q.shift(), f = p.at(-1); path[f] = p; for (const i of ins[f]?.imports || []) if (i.kind === "import-statement" && !seen.has(i.path) && ins[i.path]) { seen.add(i.path); q.push([...p, i.path]); } }
for (const t of process.argv.slice(2)) console.log(t, "\n  " + (path[t] ? path[t].join("\n  → ") : "(启动时不会加载)"));
if (!process.argv[2]) { const by = {}; for (const f of Object.keys(path)) { const d = f.split("/").slice(0, 2).join("/"); by[d] = (by[d] || 0) + (ins[f].bytes || 0); } console.log("静态可达源码字节（未压缩）：\n" + Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([d, b]) => `${String(Math.round(b / 1024)).padStart(5)}KB ${d}`).join("\n")); console.log(Object.keys(path).filter((f) => f.startsWith("js/house/")).join("\n")); }
if (process.env.TOP) console.log(Object.keys(path).sort((a, b) => ins[b].bytes - ins[a].bytes).slice(0, +process.env.TOP).map((f) => `${String(Math.round(ins[f].bytes / 1024)).padStart(5)}KB ${f}  ← ${path[f].at(-2) || ""}`).join("\n"));
