/* 看启动包里哪些源文件最重：node scripts/dev/startup-weight.mjs  （只分析，不写 dist/） */
import { build } from "esbuild";
import { rmSync } from "node:fs";
const out = ".dist-weight";
const r = await build({ entryPoints: { main: "js/main.js" }, outdir: out, bundle: true, splitting: true, format: "esm", target: "es2022", chunkNames: "chunks/[name]-[hash]", minify: true, metafile: true, write: false, logLevel: "error", logOverride: { "duplicate-object-key": "silent" } });
const outs = r.metafile.outputs, key = (k) => k.replace(/^\.dist-weight\//, "");
const entry = Object.keys(outs).find((k) => outs[k].entryPoint);
const seen = new Set(), todo = [entry];
while (todo.length) { const k = todo.pop(); if (seen.has(k)) continue; seen.add(k); for (const i of outs[k].imports) if (i.kind === "import-statement") todo.push(i.path); }
const per = {};
for (const k of seen) for (const [src, v] of Object.entries(outs[k].inputs)) per[src] = (per[src] || 0) + v.bytesInOutput;
const rows = Object.entries(per).sort((a, b) => b[1] - a[1]);
console.log("启动包合计", Math.round(rows.reduce((s, x) => s + x[1], 0) / 1024) + "KB，", rows.length, "个源文件");
const byDir = {}; for (const [s, b] of rows) { const d = s.split("/").slice(0, 2).join("/"); byDir[d] = (byDir[d] || 0) + b; }
console.log(Object.entries(byDir).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([d, b]) => `${String(Math.round(b / 1024)).padStart(5)}KB ${d}`).join("\n"));
console.log("--- 最重的文件");
console.log(rows.slice(0, +(process.argv[2] || 30)).map(([s, b]) => `${String(Math.round(b / 1024)).padStart(5)}KB ${s}`).join("\n"));
rmSync(out, { recursive: true, force: true });
