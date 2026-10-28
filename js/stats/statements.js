/* 账单 → 对账单：花费和收入共用的入口。
 * · 导入：一份银行 / 信用卡对账单同时导入花费和收入（刷卡 / 扣款 → 花费；工资、电汇、Zelle 转入 → 收入；信用卡还款、自己账户之间的转账跳过），逻辑在 bank-import.js。
 * · 导出打印：花费（年度 CSV、打印）和收入 / 收支差额（CSV、打印）放在一起，逻辑还在 stats/views.js 和 income/views.js，这里只是把它们摆到同一页。
 * 原来在 花费 → 银行导入、收入 → 银行导入 的入口都指到这里（旧链接 #/bills/spend?tab=import 自动跳过来）。 */
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { tabBar } from "../core/hub.js";
import { STATEMENT_TABS, activeTab } from "../core/tabs.js";
import { bankImportTab } from "./bank-import.js";
import { spendExportTab } from "./views.js";
import { incomeExportHtml } from "../income/views.js";

const hrefOf = (id) => `${href("bills", "statements")}${id === "import" ? "" : `?tab=${id}`}`;

function exportBody() {
  return `<section class="section"><div class="section-head"><h2>📊 ${t("花费")}</h2><p>${t("年度报表 CSV、打印花费统计")}</p></div></section>${spendExportTab()}
    <section class="section"><div class="section-head"><h2>💵 ${t("收入与收支差额")}</h2><p>${t("收入、花费、差额合并成一张报表，或只导其中一项；只有家主（或被允许的人）能导出全家的收入")}</p></div></section>${incomeExportHtml()}`;
}

export function viewStatements() {
  const tab = activeTab(state.route) || "import";
  return `<section class="section"><div class="section-head"><h2>🏦 ${t("对账单")}</h2></div>
      <p class="muted" style="margin:-6px 0 10px;font-size:13px">${t("导入银行 / 信用卡对账单（花费和收入一次导入），导出花费、收入和收支差额的报表。")}</p>
      ${tabBar(STATEMENT_TABS, tab, hrefOf, t("对账单内容"))}</section>
    ${tab === "export" ? exportBody() : bankImportTab()}`;
}
