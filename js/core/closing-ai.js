/* 用文件（购房合同 / Closing Disclosure / 结算单 / 购车协议）补录交易信息：发给你在设置里选的 AI 服务商读（不保存），读出日期、价格、定金、付款方式、机构名，
 * 先给你核对再写入（核对页在 house/deal-ai.js）。只要公司 / 机构名，不要人名、地址、电话、证件号、账号。
 * 读过的结果按交易记在内存里（刷新页面就没了），回到核对页不用再发一遍图。纯逻辑（整理 / 比对 / 生成补丁）在 closing-ai-lib.js。
 * 税务页的 Closing Disclosure 读取（tax/tax-closing-ai.js，读费用）提示词不同，保持不变。 */
import { aiReady, askText, visionCapable } from "./ai.js";
import { aiSettings, providerOf } from "./ai-common.js";
import { SYSTEM, compressImage, parseJson } from "./autofill-common.js";
import { tidyDeal } from "./closing-ai-lib.js";

let askFn = askText;
export const _setDealAsk = (fn) => { askFn = fn || askText; };   // 测试时可替换

/** 现在能不能用：AI 服务商有没有设好、能不能读图片 */
export function aiStatus() { const pr = providerOf(aiSettings().provider); return { ready: aiReady(), canImg: visionCapable(pr), provider: pr.name }; }

const CACHE = new Map();
export const lastRead = (dealId) => CACHE.get(dealId) || null;
export const rememberRead = (dealId, data) => CACHE.set(dealId, { data, at: Date.now() });

const SHAPE_PROP = { doc_type: "closing_disclosure|settlement_statement|purchase_contract|other", contract_date: "YYYY-MM-DD or null", closing_date: "YYYY-MM-DD or null", review_deadline: "YYYY-MM-DD or null", financing_deadline: "YYYY-MM-DD or null",
  price: "number or null", earnest_money: "number or null", loan_amount: "number or null", financing: "loan|cash|null", lender: "company or null", title_company: "company or null", agent: "company or null", attorney: "firm or null" };
const SHAPE_VEH = { doc_type: "bill_of_sale|other", contract_date: "YYYY-MM-DD or null", closing_date: "YYYY-MM-DD or null", price: "number or null", earnest_money: "number or null", loan_amount: "number or null", financing: "loan|cash|null", lender: "company or null", agent: "dealer company or null" };

/** 提示词：房产买卖 / 车辆各一份。dealKind = buy / sell / veh_buy / veh_sell */
export function dealPrompt(veh, dealKind) {
  const side = ["sell", "veh_sell"].includes(dealKind) ? "seller" : "buyer";
  if (veh) return [
    "Photos / screenshots of a US VEHICLE purchase or sale document (purchase agreement, buyer's order, bill of sale, or loan / finance paperwork).",
    "contract_date = the date the agreement was signed. closing_date = the delivery / pickup / hand-over date if printed. price = the vehicle sale price (before tax and fees if shown separately). earnest_money = deposit / down payment paid up front.",
    "loan_amount = the amount financed if there is a loan, else null. financing = loan if the document shows a loan or a lender, cash only if it clearly says paid in cash, otherwise null.",
    "lender = bank / credit union / finance company; agent = the dealership or seller company. Company names ONLY, never a person's name, address, phone, email or any id / account number. null if not visible.",
    "Fill only what is clearly visible; otherwise null. Return exactly: " + JSON.stringify(SHAPE_VEH),
  ].join("\n");
  return [
    "Photos / screenshots of a US residential real-estate document: a Closing Disclosure (CFPB TRID form), an ALTA / HUD settlement statement, or a purchase contract (e.g. Illinois Multi-Board Residential Real Estate Contract).",
    "doc_type: closing_disclosure, settlement_statement, purchase_contract or other.",
    "contract_date = the date the contract was signed / accepted (contracts only; a Closing Disclosure has none). closing_date = the closing / settlement date. review_deadline = the attorney-review or inspection deadline ONLY if a date is printed. financing_deadline = the mortgage-commitment / financing-contingency date ONLY if printed.",
    "price = sale price / purchase price. earnest_money = earnest money / deposit (on a Closing Disclosure: the Deposit line). loan_amount = the loan amount if there is a mortgage, else null.",
    "financing = loan if there is a mortgage (loan amount above 0) or a financing contingency; cash only if the document clearly says all-cash / no financing; otherwise null.",
    `lender = the lender; title_company = the settlement agent / title company; agent = the real-estate brokerage on the ${side}'s side; attorney = a law firm if one is named. Company or firm names ONLY, never a person's name, address, phone, email or any id / account number. null if not visible.`,
    "Fill only what is clearly visible; otherwise null. Return exactly: " + JSON.stringify(SHAPE_PROP),
  ].join("\n");
}

/** 读文件（图片，最多 6 张）→ 整理后的字段；结果记在内存里。出错抛异常（带可读的信息） */
export async function readDealDocs(files, deal, veh) {
  const images = []; for (const f of [...files].slice(0, 6)) images.push(await compressImage(f));
  const text = await askFn(SYSTEM, dealPrompt(veh, deal.kind), { json: true, images, temperature: 0.1, maxTokens: 1500 });
  const data = tidyDeal(parseJson(text));
  rememberRead(deal.id, data); return data;
}
