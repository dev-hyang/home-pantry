#!/usr/bin/env node
/* 版本号：YYYY-MM-DD.N —— N 是「当天第几次发布」，新的一天从 1 重新开始。五个应用共用这一份（逐字相同，改了要同步）。
 *
 *   node scripts/bump-version.mjs           算出下一个版本号，写进版本文件，并把 index.html / sw.js 里的旧版本号一起换成新的
 *   node scripts/bump-version.mjs --check   只检查（npm run check:dist 会带上它，推送前必过）：
 *       · 版本号格式对；发布日志最上面一条的版本号 = 当前版本号；
 *       · 和上一条发布日志比：同一天 → N 必须是上一条 + 1；换了一天 → N 必须是 1；日期不能倒退。
 *   旧历史不追溯，只看最上面两条。
 * 版本文件和发布日志文件的位置各应用不同，下面的候选清单里找到哪个用哪个。 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION_FILES = ["js/core/version.js", "js/state.js", "js/core/config.js", "js/config.js"];
const RELEASE_FILES = ["js/releases-data.js", "js/data/releases.js"];
const RE_VER = /^(\d{4})-(\d{2})-(\d{2})\.(\d+)$/;
const read = (p) => readFileSync(p, "utf8");

const versionFile = VERSION_FILES.map((p) => join(ROOT, p)).find((p) => existsSync(p) && /APP_VERSION\s*=\s*"/.test(read(p)));
const releaseFile = RELEASE_FILES.map((p) => join(ROOT, p)).find((p) => existsSync(p) && /export const RELEASES/.test(read(p)));
if (!versionFile || !releaseFile) { console.error("找不到版本文件或发布日志文件（看 scripts/bump-version.mjs 顶部的候选清单）"); process.exit(2); }

const current = read(versionFile).match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1];
const releases = [...read(releaseFile).matchAll(/\{\s*v:\s*"([^"]+)"/g)].map((m) => m[1]);
const parse = (v) => { const m = RE_VER.exec(v || ""); return m ? { day: `${m[1]}-${m[2]}-${m[3]}`, n: +m[4] } : null; };
const today = (() => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();

/** 在 cur 之后的下一个版本号：同一天 N + 1；新的一天从 1 */
export const nextVersion = (cur, day = today) => { const c = parse(cur); return c && c.day === day ? `${day}.${c.n + 1}` : `${day}.1`; };

function check() {
  const errs = [], c = parse(current);
  if (!c) errs.push(`版本号格式不对：${current}（要 YYYY-MM-DD.N）`);
  if (releases[0] !== current) errs.push(`发布日志最上面一条是 ${releases[0]}，和当前版本号 ${current} 不一致（每次升版本号都要加同版本号的发布日志）`);
  const p = parse(releases[1]);
  if (c && p) {
    if (c.day < p.day) errs.push(`日期倒退：${current} 在 ${releases[1]} 之后`);
    else if (c.day === p.day && c.n !== p.n + 1) errs.push(`同一天的序号要连续：${releases[1]} 之后应该是 ${p.day}.${p.n + 1}，现在是 ${current}`);
    else if (c.day > p.day && c.n !== 1) errs.push(`新的一天序号要从 1 开始：${releases[1]} 之后应该是 ${c.day}.1，现在是 ${current}`);
  }
  if (errs.length) { console.error("✖ 版本号检查没过：\n  " + errs.join("\n  ")); process.exit(1); }
  console.log(`版本号 ${current} 没问题`);
}

function bump() {
  const next = nextVersion(current);
  for (const rel of [versionFile, join(ROOT, "index.html"), join(ROOT, "sw.js")]) {
    if (!existsSync(rel)) continue;
    const s = read(rel); if (!s.includes(current)) continue;
    writeFileSync(rel, s.split(current).join(next));   // 只换完整的旧版本号字符串；CRLF / LF 原样保留
  }
  console.log(`${current} → ${next}\n还要做：在发布日志最上面加一条 v: "${next}"（标题 + 1–4 条要点，中英文），然后 npm run build`);
}

if (process.argv.includes("--check")) check(); else if (process.argv[1] === fileURLToPath(import.meta.url)) bump();
