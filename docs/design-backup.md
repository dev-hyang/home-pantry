# 备份与恢复设计（四个应用，2026-10-25）

## 问题
数据都在 Supabase 免费层。换手机不是问题（云端还在），但：数据库被误删、Supabase 项目没了 / 不再免费、或者想离开平台时，没有一份自己手里的完整数据，也没有一键重建的办法。

## 做法
1. **备份 = 一个 JSON 文件**，内容是这个家庭（牧羊人是这个人）在各表里的全部行，带应用名、格式版本、导出时间、家庭 / 账号 id。
   - home-pantry：云端按表分页读（25 张表，按外键顺序列在 `js/core/backup.js` 的 `TABLES`）；演示模式直接整库。
   - homeschool：hs_* 十张表 + children（只备份不恢复，孩子来自小月亮的家庭设置）。
   - shepherd：wb_* 六张表（本人的）。
   - baby-log：本机优先，备份 = settings + entries（不含演示数据），和老版「导出备份」同格式，老文件也能恢复。
2. **目标**（可多选）：
   - 云端：Supabase Storage 私有桶 `backups`（home-pantry 迁移 037；共用项目迁移 017）。路径 `<家庭id>/…`（home-pantry）、`family/<家庭id>/…`、`user/<用户id>/…`（牧羊人），RLS 用 `is_member` / `auth.uid()`。
   - 这台电脑的文件夹：File System Access API（桌面 Chrome / Edge），目录句柄存 IndexedDB，选一次以后静默写入；换会话需要用户点一下授权，界面会提示「继续备份」。
   - 下载：总是可用；手机 / Safari 只有这条和云端。
   - 云端和文件夹只留 60 天（按文件名里的日期清理）；下载的没法清。
3. **定时**：每周 / 每月 / 自定义天数，设置存本机。网页没法在关着时跑，所以只在打开应用、数据读完后检查一次「上次备份 + 间隔 ≤ 现在」，到期就后台做一次。
4. **恢复**：选文件（或云端列表里点「恢复」）→ 预览（来源、时间、各表行数）→ 确认 → 按表 upsert 回当前家庭 / 账号：`household_id` / `family_id` / `user_id` 一律换成当前的；导出者的 user id 换成现在登录的人；同主键覆盖，文件里没有的行不删。
   - home-pantry 特殊处理：`cards.bill_id` ↔ `bills.pay_card_id` 互相引用，cards 先不带 bill_id 写入，bills 写完再补；`stock_logs.id` 是自增，去掉 id 按 (item_id, created_at) 去重插入；`member_incomes.user_id` 有外键到 auth.users，不在当前家庭的人跳过。
   - baby-log 恢复 = 合并（已有同 id 不动，缺的补上），走原来的 importJSON。
5. **重建数据库**：`supabase/schema.sql` 是完整建库脚本（home-pantry 合并到建表语句里；baby-log 项目 = 基线 + 迁移 002–017 原样并入）。以后每加一个迁移都要并入 schema.sql。新项目：执行 schema.sql → 填 config.js → 家人重新注册、建家庭 → 家主导入备份。

## 没做 / 注意
- SQL 文件在四个仓库都不进 git，只在这台电脑上：schema.sql 要和备份放在一起，否则电脑没了连表都建不回来。
- 收入按登录账号存，换项目后别人的收入导不回来，要本人再填。
- 没有「清空再恢复」：恢复只覆盖 / 新增，不删除现有行。
- 云端目标没在真实项目上跑过（桶和策略 SQL 没执行过）；文件夹目标只在无头 Chrome 里验证了 API 存在，没真正写过磁盘。
