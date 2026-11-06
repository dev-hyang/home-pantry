/* 2026-11 分类重整：物品按小类换分类 / 换小类名（docs/design-categories.md 「分类重整：储藏三个空间」）。
 * 云端是迁移 063（supabase/migrations/063_category_regroup.sql，同一张对照表）；这里给演示模式的本机数据做一次。
 * 每行：[旧分类, 旧小类, 名称匹配（可空）, 新分类, 新小类]；有名称条件的行排在同一小类的兜底行前面。 */
export const CAT_MOVES = [
  ["dry", "零食坚果", null, "drink", "零食坚果"],
  ["dry", "冲饮", null, "drink", "茶咖啡冲饮"],
  ["drink", "茶咖啡", null, "drink", "茶咖啡冲饮"],
  ["daily", "洗护用品", null, "personal_care", "洗发沐浴"],
  ["daily", "清洁用品", null, "daily", "清洁洗涤"],
  ["baby", "哺乳用品", /吸奶器|奶瓶|消毒|温奶|暖奶|背带|腰凳|餐椅|pump|bottle|sterili|warmer|carrier/i, "gear_baby", "喂养用品"],
  ["baby", "哺乳用品", null, "baby", "哺乳耗材"],
  ["health", "护理用品", null, "health", "急救护理"],
  ["study", "学生用品", null, "gear_study", "学习用品"],
  ["gear_home", "季节电器", null, "gear_home", "家用电器"],
  ["gear_kitchen", "保鲜收纳", null, "gear_kitchen", "保鲜盒"],
  ["gear_travel", "旅行婴儿用品", null, "gear_baby", "出行用品"],
  ["gear_travel", "推车拖车", null, "gear_baby", "推车座椅"],
  ["gear_tools", "五金配件", null, "house_repair", "螺丝五金"],
  ["gear_garden", "花盆土壤", /土|肥|种子|草籽|营养|soil|mulch|fertili|seed|compost/i, "house_season", "土壤肥料"],
  ["gear_garden", "花盆土壤", null, "gear_garden", "花盆"],
  ["gear_study", "学习机电子", null, "gear_digital", "学习机"],
  ["gear_study", "运动器材", null, "gear_travel", "运动器材"],
  ["house_season", "草坪花园", null, "house_season", "土壤肥料"],
  ["house_repair", "胶带五金", null, "house_repair", "螺丝五金"],
  ["house_care", "外墙清洁", null, "house_care", "外墙清洗"],
];

/** 演示库：物品换分类，连着的花费、采购清单跟着换；自建分类挂在旧二级 food / shopping 下的换成新的。可以重复跑 */
export function migrateLocalCategories(db) {
  const moved = new Map();   // item id → [旧分类, 新分类]
  for (const [oc, os, re, nc, ns] of CAT_MOVES) {
    for (const it of db.items || []) {
      if (it.category !== oc || it.subcategory !== os || (re && !re.test(it.name || ""))) continue;
      it.category = nc; it.subcategory = ns;
      if (nc !== oc) moved.set(it.id, [oc, nc]);
    }
  }
  for (const list of [db.purchases, db.shopping]) for (const r of list || []) {
    const m = r.item_id && moved.get(r.item_id); if (m && r.category === m[0]) r.category = m[1];
  }
  for (const c of db.categories || []) {
    if (c.parent === "food") c.parent = "grocery";
    else if (c.parent === "shopping") c.parent = c.space === "pantry" ? "essentials" : "home_goods";
  }
}

/** 「请确认分类」（迁移 064）：063 猜着搬过来的落点 → 另一个候选。键 = "分类/小类"，值 = [候选分类, 候选小类]。
 *  标记了 cat_check 的物品在首页列出来：「没错」清标记；「改成 …」换到候选（连着的花费、采购清单跟着换） */
export const CAT_CHECK = {
  "gear_baby/喂养用品": ["baby", "哺乳耗材"],         // 吸奶器、奶瓶 ↔ 储奶袋、防溢乳垫
  "baby/哺乳耗材": ["gear_baby", "喂养用品"],
  "house_season/土壤肥料": ["gear_garden", "花盆"],    // 土、肥料 ↔ 花盆
  "gear_garden/花盆": ["house_season", "土壤肥料"],
  "personal_care/洗发沐浴": ["daily", "清洁洗涤"],     // 旧「洗护用品」里也可能有洗衣液
  "gear_baby/出行用品": ["gear_travel", "行李箱包"],   // 旧「旅行婴儿用品」里也可能是大人的旅行用品
  "gear_study/学习用品": ["study", "文具"],            // 旧「学生用品」：书包、计算器 ↔ 笔、本子这类耗材
  "house_repair/螺丝五金": ["gear_tools", "手动工具"], // 旧「五金配件」：螺丝钉子 ↔ 钻头、批头这类工具配件
};
export const catCheckAlt = (it) => CAT_CHECK[`${it.category}/${it.subcategory}`] || null;

/** 演示库：落在 CAT_CHECK 里的旧物品打上标记（只做一次，和迁移 064 一样） */
export function flagLocalCatChecks(db) {
  for (const it of db.items || []) if (catCheckAlt(it)) it.cat_check = true;
}
