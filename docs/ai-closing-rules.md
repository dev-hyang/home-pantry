# Closing Disclosure 的两套 AI 录制规则（别混）

同一份 Closing Disclosure（CD）在 home-pantry 里有**两个互不相干的 AI 读取入口**，读的东西、写到的地方、规则都不同。

| | ① 房屋交易录制 | ② 税务成本基础录制 |
|---|---|---|
| 入口 | 房屋 → 交易 →「用文件补录」 | 财务 → 税务 → 买卖与成本基础 → 房子卡片 →「用 Closing Disclosure 自动填」 |
| 代码 | `js/core/closing-ai.js`、`closing-ai-lib.js`、`js/house/deal-ai.js` | `js/tax/tax-closing-ai.js` |
| 读什么 | 交易**基本信息**：合同日、交割日、成交价、定金、贷款额 / 利率 / 期限、月供、月 escrow、贷款行 / 产权公司 / 经纪人 / 律师（只要公司名） | 买家付的**每一行费用**和各种 credit，按「能不能计入成本基础」分类 |
| 写到哪 | 这笔交易的字段（逐项和现有值比：新 = 默认勾，不同 = 默认不勾） | 税务页的清单 ② 买入时付的费用 / ③ 退款·credit（存预算表 `_tax_cfg.props`） |
| 不碰 | 不读费用明细 A–H | 不改交易字段；成交价只用来提醒和买入价是否一致 |
| 共同点 | 图片发给用户选的 AI 服务商、不保存；先给用户核对再写；不存姓名 / 地址 / 证件号 / 账号 | 同左；已有清单不会被改；金额相同的默认不勾（防重复） |

## ① 房屋交易录制（不分类费用）
只填交易卡片上的字段（`DEAL_AI_FIELDS`）。**不会**把 CD 的费用行录进任何清单。贷款总额、首付只作为交易信息保存，**不进成本基础**。

## ② 税务成本基础录制：A–H 逐段规则

成本基础 = ① 买入价 + ② 费用 − ③ credit + ④ 装修。买入价已含首付 + 贷款，所以**首付、贷款总额、Cash to Close、wire 总额一律不填**。

| CD 段 | 内容 | AI 分类（bucket） | 去向 |
|---|---|---|---|
| **A** Origination Charges | 贷款手续费、discount points | `points`（points）/ `loan_cost` | 不进 ②。points 自住房可能按利息扣除，出租房摊销；只列出，待 CPA 确认 |
| **B** Services You Cannot Shop For | 评估、credit report、flood cert（贷款方要求的） | `loan_cost` | 不进 ② |
| **C** Services You Can Shop For | 产权 / settlement / closing / escrow agent 费、律师费、survey、**Owner's** title insurance、**Lender's** title insurance | 前几项 `basis`；Lender's title insurance 是 `loan_cost` | basis 进 ②；Lender's title 不进 |
| **E** Taxes and Other Government Fees | recording fee、transfer / stamp tax | `basis` | 进 ② |
| **F** Prepaids | 预付保险、预付利息、预付地税 | `prepaid_escrow` | 不进 ② |
| **G** Initial Escrow Payment | 保险 / 地税预存、**Aggregate Adjustment** | `prepaid_escrow` | 不进 ②，也不进 ③（预存款以后用来缴保险 / 地税；aggregate adjustment 只是 G 段的会计调整） |
| **H** Other | HOA 转让 / capital contribution、home warranty、inspection 等 | `other` | 不自动进；需用户判断（HOA 买入时一次性费用多数不算基础；inspection / warranty 通常不算） |
| **J** Lender Credits | 贷款方 credit（用高利率换的） | credit，`kind: lender` | 对应贷款费用没进 ②，所以 credit 也**不进 ③**（同进同出） |
| **K / L / Adjustments** | 卖家 credit（降价性质） | credit，`kind: seller` | 进 ③ |
| | **地税分摊 credit**（卖家为他那段税期给你的）、Aggregate Adjustment、其他调整 | 应归 `prepaid_escrow`，不是 credit | **不进 ②、不进 ③** |
| 不录 | 成交价合计、贷款额、定金 / earnest money、Cash to Close、卖家付的费用 | — | 不录 |

注意：美国国税局的买房成本（Pub 551）里，贷款方要求的评估费、credit report、预付利息、保险、转让前租金 / 水电、贷款相关费用都**不**算成本基础；算的是产权 / 律师 / 记录 / 转让税 / survey / owner's title insurance 等。以上只是参考，具体以 CPA 为准。

## 提示词里的对应处理（2026-11-24.54 已改）
1. credits 只收卖家 credit（`seller`）和贷款方 credit（`lender`）；地税分摊、Aggregate Adjustment 归 `prepaid_escrow`（提示词里要求，`tidy()` 里还按名字兜底改回）。
2. lender credit 在核对面板里默认不勾，并标注原因；要加要自己勾。
