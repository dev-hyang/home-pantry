-- 100：物品的「采购方式」和「订阅周期」（home-pantry）
--   采购方式 buy_mode：线上订阅 / 批量 / 生鲜 / 其他；null = 按分类自动推（购物车按它分组，见 js/pantry/buy-mode.js）。手动改过的一件物品，以后每次都按它分组。
--   订阅周期 subscribe_every_days：线上订阅 / 定期配送大约每几天一次（1–365，可不填）。
--   只给 items 加两列，不动已有数据；可重复执行。备份 / 恢复按整行读写，不用另接（不是新表）。
alter table public.items add column if not exists buy_mode text check (buy_mode is null or buy_mode in ('online', 'bulk', 'fresh', 'other'));
alter table public.items add column if not exists subscribe_every_days integer check (subscribe_every_days is null or subscribe_every_days between 1 and 365);
