// 生成 supabase/migrations/070_category_refine.sql：规则表只有一份（js/core/sub-guess.js），迁移从它生成。
// 用法（在 home-pantry 目录）：node scripts/gen-070.mjs
import { writeFileSync } from "node:fs";
import { RULES, DURABLE_FROM } from "../js/core/sub-guess.js";

const q = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const arr = (a) => (a ? `array[${a.map(q).join(", ")}]` : "null");
const values = RULES.map(([from, re, cat, sub], i) => `    (${i + 1}, ${arr(from)}, ${q(re)}, ${q(cat)}, ${q(sub)})`).join(",\n");

const sql = `-- 070 分类细化（2026-11-14，docs/design-categories.md「储藏三类改名 + 分类细化」）
-- 新分类：meat_dairy 肉蛋奶、snacks 零食、gear_furniture 家具、gear_appliance 家用电器、gear_toys 玩具游戏、gear_decor 装饰收纳（分类 id 只是文字，不用改表约束）。
-- 这里把已有物品按名称搬到新分类 / 新小类。规则表和 js/core/sub-guess.js 是同一份（本文件由 scripts/gen-070.mjs 生成，别手改）。
--   · 换了分类的：打上 cat_check（首页「请确认分类」一件件确认），原来的「分类/小类」记在 cat_prev，「改成 …」可以改回去；
--     连着的花费、采购清单（还是旧分类的）跟着换。
--   · 只换小类的（葡萄从 蔬菜 → 水果）：直接换，不打标记。
--   · 蔬果没有小类的：默认 蔬菜。
-- 只跑一次（表注释记着），重复跑不会把确认过的再改回去。先跑 064。
alter table public.items add column if not exists cat_prev text;   -- 迁移 070 搬之前的「分类/小类」，「请确认分类」里可以改回去

do $$
begin
  if exists (select 1 from pg_catalog.pg_description d join pg_catalog.pg_class c on c.oid = d.objoid
              where c.relname = 'items' and d.objsubid = 0 and d.description like '%refine 070 done%') then return; end if;

  create temporary table _r (ord int, from_cats text[], re text, cat text, sub text) on commit drop;
  insert into _r values
${values};

  create temporary table _m on commit drop as
  select distinct on (i.id) i.id, i.category as old_cat, i.subcategory as old_sub, r.cat, r.sub
    from public.items i
    join _r r on (case when r.from_cats is null then i.category = any(${arr(DURABLE_FROM)}) else i.category = any(r.from_cats) end)
             and i.name ~* r.re
   order by i.id, r.ord;
  delete from _m where cat is null or (cat = old_cat and sub is not distinct from old_sub);

  -- 连着的花费、采购清单：还是旧分类的跟着换
  update public.purchases p set category = m.cat from _m m where p.item_id = m.id and m.cat <> m.old_cat and p.category = m.old_cat;
  update public.shopping_list s set category = m.cat from _m m where s.item_id = m.id and m.cat <> m.old_cat and s.category = m.old_cat;

  update public.items i set
      cat_prev = case when m.cat <> m.old_cat then m.old_cat || '/' || coalesce(m.old_sub, '') else i.cat_prev end,
      cat_check = case when m.cat <> m.old_cat then true else i.cat_check end,
      category = m.cat, subcategory = m.sub
    from _m m where i.id = m.id;

  update public.items set subcategory = '蔬菜' where category = 'fresh' and subcategory is null;

  comment on table public.items is 'cat_check 064 done; refine 070 done';
end $$;
`;
writeFileSync(new URL("../supabase/migrations/070_category_refine.sql", import.meta.url), sql);
console.log(`070_category_refine.sql: ${RULES.length} rules`);
