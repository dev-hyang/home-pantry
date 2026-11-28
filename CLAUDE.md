# 爱家小助手 home-pantry · 项目规则

这份文件提交在仓库里：换电脑、换 Claude 账号、记忆被清空，规则都还在。更细的跨应用规则在上一级 `homeworks/CLAUDE.md`（本机文件，不在 git 里）。

## 版本号与发布日志
- 版本号格式 `YYYY-MM-DD.N`：**N 是当天第几次发布，新的一天从 1 重新开始**；同一天再发就 +1。
- 不要手改版本号：运行 `node scripts/bump-version.mjs`，它算出下一个版本号，并把 `js/core/version.js`、`index.html`、`sw.js` 里的旧版本号一起换掉。
- 每次升版本号，都要在 `js/releases-data.js` 最上面加一条**同版本号**的发布日志（标题 + 1–4 条要点，中英文，写给家里人看，不写技术词；k = new 新功能 / better 改进 / fix 修复）。
- `npm run check:dist` 会同时检查 `dist/` 是不是最新、版本号规则（同一天序号连续、换天从 1 开始、发布日志最上面一条 = 当前版本号），推送前必须通过。

## 每次推送前
1. `node scripts/bump-version.mjs` → 写发布日志 → `npm run build` → `npm run check:dist` → `node --test tests/*.test.mjs`，并对改过的 JS 文件 `node --check`。
2. 改了或新加了页面：在约 390px（手机）和约 1280px（电脑）下都看一遍——间距、大小、对齐一致，不溢出、不重叠、点按区域 ≥ 44px；表单要量整张（控件一样高、不超出所在列）。
3. 在 homeworks 根目录运行 `node check-shared.mjs`（共享文件的各份副本必须一致；这个脚本在本机根目录，不在仓库里）。
4. 源码、`dist/`、`index.html` 一起提交推送；推送前确认远端没有新提交，不提交别的会话的半成品。

## 其他约定
- 保持模块化：单个文件控制在 300 行以内，超出时拆成独立的组件 / Hook / 工具函数；函数 30–50 行以内。
- 数据库：迁移 SQL 放 `supabase/migrations/`（沿用本文件夹自己的编号），总脚本是 `supabase/schema.sql`；连的是**自己的库**，配置在 `config.js`。迁移文件夹被 `.gitignore` 忽略（只在本机），**SQL 由用户自己在 Supabase 里执行**，不要自己在线上库跑；新增表还要接入备份 / 还原（`js/core/backup.js` 的 `TABLES`）。
- 后台刷新（同步、定时器）不能冲掉表单里还没保存的输入。
- 页面加载的是打包后的 `dist/`，忘了 `npm run build` 线上跑的就是旧代码。
