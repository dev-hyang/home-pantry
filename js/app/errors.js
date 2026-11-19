/* 把数据库 / 网络的原始报错翻成家里人看得懂的话。 */
import { t } from "../core/i18n.js";

   // 卡行还能右滑停用 / 启用   // 行记录左滑删除（js/swipe-rows.js）
/* 云端报错翻译：数据库还没升级到某个迁移时，PostgREST 只会说「找不到某列 / 某表」，这里换成告诉你该执行哪个迁移文件 */
const MIGRATION_HINTS = [[/deal_task_done.*status|status.*deal_task_done|deal_custom_tasks.*skipped|skipped.*deal_custom_tasks/i, "047_deal_skip.sql", "交易清单跳过"], [/deal_events|property_deals.*baseline|baseline.*property_deals/i, "046_deal_progress.sql", "交易进展"], [/card_id.*purchases|purchases.*card_id/i, "033_purchase_card.sql", "花费记到哪张卡"], [/import_batch/i, "034_purchase_import_batch.sql", "银行导入批次"], [/pay_card_id|bill_payments.*card_id|medical_payments.*card_id|cards_kind_check/i, "036_pay_accounts.sql", "付款账户（银行账户、账单扣款 / 缴费用的卡）"], [/house_profiles.*ownership|ownership.*house_profiles/i, "038_house_ownership.sql", "房屋资料：产权、税务与车位"], [/assets.*\bunits\b|\bunits\b.*assets/i, "039_asset_units.sql", "固定装置的位置与数量"], [/purchases.*\bmethod\b|\bmethod\b.*purchases|cards.*\bbalance\b|\bgift\b/i, "040_purchase_method.sql", "付款方式（现金 / 支票 / 礼品卡）与礼品卡"], [/inactive_since/i, "041_card_inactive_since.sql", "卡的停用日期"], [/income_records|income_repayments|income_access/i, "042_income_records.sql", "收入（进账）记录和查看权限"], [/relation .*\bcards\b|'cards'/i, "032_cards.sql", "信用卡表"], [/alert_mute_until/i, "030_item_alert_mute.sql", "物品不再提醒"]];
export function friendlyErr(msg) {
  const m = String(msg || "");
  for (const [re, file, what] of MIGRATION_HINTS) if (re.test(m)) return t("还没执行数据库迁移 {file}（{what}）：先在 Supabase → SQL Editor 里执行 supabase/migrations/{file}，再试一次。", { file, what });
  return m;
}
