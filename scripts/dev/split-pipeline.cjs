/* 拆一个大文件的完整流程（把 split-module / split-closure / repoint / reexport 串起来）：
 *   node scripts/dev/split-pipeline.cjs <spec.json> <公共小件文件名，如 debt-common.js> "<公共小件说明>"
 * spec.json 就是 split-module.cjs 的 spec（按行范围把段落分到新文件）。步骤：
 *   1 按 spec 拆   2 新文件反向引用主文件的符号 → 做一次本地 WIP 提交，把这些符号抽到公共小件文件，再把新文件的引用指过去
 *   3 主文件补上原来对外导出的符号的转出口（和 origin/main 上的版本比）   4 语法 + 未定义标识符检查
 * 注意：第 2 步会留下一个本地 WIP 提交（不推送），发版前用 git reset --soft origin/main 合并成一个正式提交。 */
const fs = require("fs"), cp = require("child_process"), path = require("path");
const [specPath, sharedName, sharedDoc] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(specPath, "utf8")), entry = spec.source, dir = path.posix.dirname(entry);
const run = (cmd) => cp.execSync(cmd, { encoding: "utf8", maxBuffer: 1e8 });
const node = (script, args) => run(`node --expose-internals scripts/dev/${script} ${args}`);
console.log(node("split-module.cjs", specPath).split("\n").filter((l) => /行|问题/.test(l)).join("\n"));
const parts = spec.files.map((f) => f.path);
const entryRel = "./" + path.posix.basename(entry);
const backNames = () => [...new Set(parts.flatMap((p) => [...fs.readFileSync(p, "utf8").matchAll(/import \{([^}]*)\} from "([^"]+)";/g)].filter((m) => m[2] === entryRel).flatMap((m) => m[1].split(",").map((x) => x.trim()).filter(Boolean))))];
let back = backNames();
if (back.length) {
  console.log("反向引用主文件的符号:", back.join(", "));
  run("git add -A . && git commit -q -m \"WIP split pipeline (local only)\"");
  const shared = `${dir}/${sharedName}`;
  const sharedSpec = specPath.replace(/\.json$/, "-shared.json");
  fs.writeFileSync(sharedSpec, JSON.stringify({ source: entry, files: [{ path: shared, doc: sharedDoc, names: back }] }, null, 2) + "\n");
  console.log(node("split-closure.cjs", `${sharedSpec} ${shared}`).trim().split("\n").slice(-2).join("\n"));
  const finalNames = JSON.parse(fs.readFileSync(sharedSpec, "utf8")).files[0].names;
  console.log(node("repoint.cjs", `${entry.replace(/^js\//, "")} ${shared.replace(/^js\//, "")} "${finalNames.join(",")}"`).trim().split("\n").slice(-1)[0]);
  parts.push(shared);
}
console.log(cp.execSync(`node --expose-internals scripts/dev/reexport.cjs ${entry} ${parts.join(" ")}`, { encoding: "utf8", env: { ...process.env, BASE: "origin/main" } }).trim());
let bad = 0; for (const f of [entry, ...parts]) { try { run(`node --input-type=module --check < ${f}`); } catch (e) { console.log("语法错误:", f); bad++; } }
const chk = cp.spawnSync("node", ["--expose-internals", "scripts/dev/split-module.cjs", "--check", entry, ...parts], { encoding: "utf8" });
console.log("静态检查（「未解析」里如果只是 export { … } from 转出口的名字，是误报）：\n" + (chk.stdout.split("\n").filter((l) => !l.startsWith("ok") && l).join("\n") || "全部 ok"));
console.log([entry, ...parts].map((f) => `${String(fs.readFileSync(f, "utf8").split("\n").length).padStart(5)} ${f}`).join("\n"));
process.exitCode = bad ? 1 : 0;
