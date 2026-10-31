# 2026-10 路线图：季节电器、召回、财务权限、上门工单（设计稿，只有方案，未实现）

本稿回答四个问题（编号沿用需求清单：2、3、7、8）。每一节都按同一结构写：**需求**（用户说了什么）→ **现状**（代码 / 数据里已有什么，标出文件）→ **假设**（我们替用户做的、需要确认的判断）→ **建议** → **最小第一步** → **成本**。
成本粗分三档：**小**（只改 `data/*.js` 或一个页面，不动表）· **中**（一条可重复执行的迁移 + 一两个页面）· **大**（新表 + 新页面 + RLS + 首页 / 提醒总线联动）。

---

## 2. 立式风扇、取暖器这类「季节性小家电」放哪里

### 需求
新买的 Portal 立式风扇、热风扇（取暖器）要登记。问题：算 房屋设备，还是别的地方？用现有分类还是新加一类（小家电 / 季节性电器）？要不要清洁保养提醒？

### 现状
- `docs/design-fix.md` §1 已经把「东西」按性质分成四层：**设备**（一台一条、有寿命 / 保修 / 周期）、**固定装置**、**装备**（只记数量位置）、**耗材**。
- 装备里已经有子类：`data.js` 第 19 行 `gear_home` 的 subs 含「季节电器」；`gear_kitchen` 有「小家电」。装备**没有**品牌、型号、序列号、保修字段，也**没有**任何提醒（`items` 表，`supabase/schema.sql` 第 143 行）。
- 设备类型表 `data/house.js` `ASSET_TYPES`（第 284 行起）：有吊扇 `ceiling_fan`（固定装置）、全屋加湿器 `humidifier`，**没有**可移动的风扇 / 取暖器 / 除湿机 / 空气净化器；兜底是 `other_equipment`（无周期、无检查卡）。
- 设备表 `assets` 有 `brand / model / serial / warranty_until / service_interval_months / purchase_price`（`schema.sql` 第 350 行），设备页有保养记录、保修到期提醒、「出了问题？」（`js/house/fix.js`）。
- 装备 → 设备已有升级通道：`#/asset/new?from_item=<id>`（`js/house/assets.js` 第 553 行）。

### 假设
- A1. 风扇、取暖器值得记**型号和序列号**——主要为了保修和**召回**（见第 3 节；取暖器是召回高发品类，CPSC 常年有电暖器召回）。
- A2. 家里这类电器数量不多（3–8 台），一台一条不会像窗户插座那样冗杂。
- A3. 「保养」对它们的含义是**换季清洁 + 收纳前检查**，不是固定 N 个月周期。

### 建议
1. **放进 房屋 → 设备保养，按设备记（`kind = 'equipment'`），不放装备。** 理由：要型号 / 序列号 / 保修 / 召回 / 维修记录，这些只有 `assets` 有；装备层故意做成「只记数量位置」，往里加字段会破坏 design-fix.md 的分层。
2. **新加一个显示分组「小家电 / 季节电器」**，做法照搬固定装置：类型上加标记 `portable: true`（`data/house.js`），`kind` 不变、表结构不变；设备列表里单独一组，生成页默认不勾（`optional: true`）。新类型：`portable_fan` 落地扇 / 塔扇、`space_heater` 取暖器、`dehumidifier` 除湿机、`air_purifier` 空气净化器、`portable_ac` 移动空调、`window_ac` 窗机。不要再拆「小家电」和「季节电器」两组——对用户是同一个东西，拆开只增加选择成本。
3. **提醒：要，但挂在季节任务上，不用设备周期。** `interval` 留空（不会出「保养逾期」）；在 `data/house.js` 季节任务模板里加两条按设施出现的任务：
   - 春末「风扇 / 除湿机拿出来：擦叶片、洗滤网、检查电线」；
   - 秋初「取暖器使用前检查：电线插头有无发热变色、倾倒断电开关、周围 3 英尺无可燃物；不接排插」（安全红线写进 `data/care.js` 的 `urgent`）。
   季节任务条件用 `when: ["a:space_heater"]` 这类「有这台设备才出现」的新条件（现在只有 `f:` 设施 / `type:` 房型，需要在 `forRegion` / 任务过滤里加一个判断）。
4. 电热毯、加热垫这类**不需要型号也不会修**的，继续放 装备 → 家居用品 → 季节电器；如果后来想记型号，用现成的「升级为设备」。

### 最小第一步
只改 `data/house.js`：加 `space_heater`、`portable_fan` 两个类型（`optional: true, portable: true, interval: null`）+ 一张取暖器检查卡（`data/care.js`）。分组显示和 `a:` 任务条件放第二步。
**成本：小**（无迁移；新文案要补 `js/i18n/en.js`）。

---

## 3. 产品召回（Recall）：删掉，还是走「召回 → 更换」流程

### 需求
某个东西被召回了：直接删除这条记录，还是开一个 召回 → 更换（Replacement）的流程？要不要提醒？要轻量。

### 现状
- 设备已有「待处理」机制：保养记录 `kind = 'inspect'` 且 `result` 为 需保养 / 需维修 / 需更换，之后没有对应记录 → `followUp`，首页「尽快 · 必须」（`js/house/assets.js` 第 82–85、126、131 行；`docs/design-care.md` §3）。
- 车辆已有「召回查询」保养项（`data/vehicles.js` 第 27 行，每 12 个月提醒去 NHTSA 按 VIN 查）。
- 装备有「损坏了，换新」：数量 −1 + 加采购（`js/i18n/en.js` 第 145 行对应的流程）。
- 设备删除会级联删保养记录（`maintenance_logs.asset_id on delete cascade`），保养记录关联的花费只 `set null`。

### 假设
- B1. 召回的处理结果通常是三种之一：**厂家修**（上门 / 寄修件）、**换新**（寄一台新的）、**退款**。期间可能要求**立即停用**（取暖器、婴儿用品常见）。
- B2. 用户关心的是「别忘了处理」和「处理完有据可查」（退款金额、新机序列号、保修重新起算），不需要对接 CPSC / NHTSA API（无稳定公开接口，且要联网）。

### 建议
**不要删除。** 删除会丢掉购买价、保修、维修历史，也丢掉「这台曾被召回」这个对以后买同品牌有用的事实；更换来的新机应该是一条新设备，旧的标成已处理。

轻量设计，**不建新表**：
1. `assets` 加一列 `recall jsonb`（与 `vehicle`、`units` 同一做法）：
   `{ status: 'open' | 'stop_use' | 'resolved', found_on, ref (召回编号 / 网址), remedy: 'repair' | 'replace' | 'refund' | null, resolved_on, refund_amount, replaced_by (新设备 id), notes }`。
2. 设备页加「标记为召回」按钮 → 一个小表单（编号或网址、是否要求停用、厂家给的方案）。
3. 提醒：`recall.status` 为 `stop_use` → 首页 **紧急 · 必须**（「停止使用：××取暖器」）；`open` → **尽快 · 必须**，到 `resolved` 为止。直接接进 `assetAlertItems()`，排序在 `followUp` 之前。
4. 处理完成的三个出口：
   - 修好了：记一条保养记录 `kind = 'repair'`，备注「召回维修」，`recall.status = 'resolved'`；
   - 换新：按钮「登记换来的新机」→ 打开 `#/asset/new?replaces=<旧id>`，带入名称、类型、位置，保存后旧机 `recall.replaced_by = 新id`、`resolved`，旧机列表里折叠到「已更换」；
   - 退款：填退款金额 → 写一笔负数花费（迁移 028 已允许负数，分类沿用原购买的分类），`resolved`。
5. 装备、储藏食品**不做召回状态**：装备没有型号（要用就先「升级为设备」）；食品召回 = 直接出库，用现有的减库存即可。

### 最小第一步
只做第 1–3 条（列 + 标记表单 + 首页提醒），三个出口先只做「修好了 / 已处理」一个按钮。
**成本：中**（一条迁移加 `assets.recall`，`assets.js` 表单和提醒；换新 / 退款出口第二步再做）。

---

## 7. 财务权限：老人只要采购、录入、保养维修，不看账单

### 需求
- 非家主成员**默认看不到财务**（账单 tab、花费、预算、用卡、收入），包括今日页的财务快捷入口，而且**自己不能加回来**。
- 家主在「家庭成员」里逐人决定是否授予「财务」权限；授予即获得**全部财务查看**权限。
- 被限制的成员仍要能：采购清单、录入购物、记保养 / 维修。

### 现状（关键：现在财务对所有成员是完全开放的）
- 角色只有 `owner / member`（`schema.sql` 第 137 行），改角色走 `set_member_role`（security definer，第 870 行）；成员行只允许本人改 `display_name`（第 1436 行注释）。
- 财务相关表的 RLS 只判断「是不是这个家的人」：`purchases`、`bills`、`bill_payments`、`household_budgets`、`cards`、`properties`（含买卖价）、`property_deals` 都是 `household_id in my_household_ids()`（第 774–806、1144 行）。也就是说**任何成员用浏览器控制台或直接调 REST 都能读到全部花费和账单**，不管界面藏没藏。
- 已有两处「按人收紧」的先例可以照抄：
  - 收入：`income_access`（申请 / 授予）+ `income_can_see(hid)`（第 1273 行），`income_records` 的 `using` = 自己记的 或 `income_can_see`；前端 `canSeeAll()`（`js/income/logic.js` 第 26 行）。
  - 医疗账单：`visibility` 字段（第 1046 行）。
- 「账单模块开 / 关」是**每台设备自己的 localStorage 开关**（`js/core/state.js` 第 8 行 `hmh-bills-off`，设置里 `js/main.js` 第 585 行切换）。今日页的财务快捷入口按这个开关过滤（`js/today.js` 第 100–110 行 `PRESETS`），账单关着时花费明细挪到「我的 → 统计」（`js/main.js` 第 804 行）。所以现在任何人打开开关就能看到。
- 其他会带出财务的通道：云端备份桶 `backups` 对所有成员可读（第 1178 行），备份 JSON 含 purchases / bills / income 等（`js/core/store.js` 第 864 行导出表清单）；保养记录 `maintenance_logs.cost`、设备 `assets.purchase_price`；咩咩（`js/core/ask.js`）会把读到的数据拼进提示词。

### 假设
- C1. 「财务」= 花费明细与统计、账单与缴费、预算、用卡 / 账户、房产买卖价与交易金额、收入。授予后全部可看（需求原话）。
- C2. 收入里**每个人自己的工资**另有更严的规则（`member_incomes` 只本人和家主可见）。建议授予「财务」后**仍不自动看别人的工资**，收入继续走 `income_access`；但「没有财务权限」的人连收入入口都不显示。需要家主确认。
- C3. 被限制的成员**录入**花费是必需的（采购清单「已买到」、录入购物、保养记费用都会写 `purchases`），但只看得到**自己录的**那几笔。
- C4. 维修费用（保养记录里的金额）、设备购买价对老人可见，可以接受——他们往往就是付钱 / 联系师傅的人；如不接受，见「可选加强」。

### 建议
**可行，而且必须在 RLS 做；界面隐藏只是体验，不是安全。** 照收入的现成模式做：

1. **数据**：`household_members` 加 `can_finance boolean not null default false`；新 RPC `set_member_finance(p_household, p_user, p_on)`，security definer，只有家主能调（照 `set_member_role`）。成员自己改不了（本来就只开放了 `display_name` 的列更新）。家主恒为有权限。
2. **判断函数**：`finance_can_see(hid) = is_owner(hid) or exists(… role/can_finance … and status = 'active')`，security definer、`stable`，和 `income_can_see` 同写法（026 的「集合判断」性能写法照用）。
3. **RLS 改动（真正的安全边界）**：
   | 表 | select | insert / update / delete |
   |---|---|---|
   | `purchases` | `finance_can_see` **或** `created_by = auth.uid()` | 插入：任何成员（保证采购、录入、保养记费用不坏）；改删：`finance_can_see` 或自己录的 |
   | `bills`、`bill_payments`、`household_budgets`、`cards`、`medical_*`、`property_deals`、`deal_events` | `finance_can_see` | `finance_can_see` |
   | `properties` | 照旧全员可读（房屋模块要用房产 id / 名称）；**买卖价列**用列级授权收回或拆到一张 `property_finance` 表 | — |
   | `income_*`、`member_incomes` | 在现有条件上再 `and finance_can_see`（自己记的除外） | 照旧 |
   | `storage.objects`（`backups` 桶） | 只给 `finance_can_see` | 同左 |
   注意 `insert … returning`：Supabase 插入后会回读这一行，select 策略必须放行「自己录的」，否则老人点「已买到」会报错——表格里的 `created_by = auth.uid()` 就是为这个。
4. **前端（体验层）**：
   - `state.canFinance` 由 `listMembers()`（`store.js` 第 845 行）带回的 `can_finance` 算出；`billsEnabled` 改成「`canFinance` 且本机没关」——没权限时设置里的开关直接不显示。
   - 路由守卫：`#/bills/*`、`#/me/stats` 没权限时跳回今日并提示「家主未开放财务」。
   - `PRESETS()`（`js/today.js` 第 100 行）里财务类条目统一改成看 `canFinance`；已经存在账号 `user_metadata.quick` 里的旧财务快捷方式在渲染时过滤掉（不用改账号数据，用户自己也加不回来，因为选择列表里没有）。
   - 提醒总线 `SOURCE_LABEL` 里 `bill / budget / card / medical / income` 来源对没权限的人不注册；咩咩不拼财务摘要（RLS 读不到时本来就是空的，但要避免「预算」这类按空数据生成误导性文字）。
   - 录入购物 / 采购「已买到」照常可以填价格；保存后的确认只说「已记下」，不跳花费页。
5. **设置 → 家庭成员**：每个非家主成员一行「财务：开 / 关」开关（家主可见），旁边一句「关闭后看不到账单、花费、预算、用卡和收入，只能看到自己录入的花费」。

**迁移的默认值（重要）**：列默认 `false`，但对**已经存在的成员**建议迁移时回填 `true`，并在家主的今日页给一条一次性提示「现在可以按人关闭财务权限」——否则配偶升级后突然什么都看不到，会以为数据丢了。新加入的成员默认 `false`，符合需求。

**可选加强（看 C4 是否成立）**：`maintenance_logs.cost` 与 `assets.purchase_price / replacement_cost_estimate` 对无财务权限的人隐藏，需要把这些列移到单独的表或用视图；成本中偏大，建议先不做。

### 最小第一步
一条迁移：`can_finance` 列 + `set_member_finance` RPC + `finance_can_see` + 上表里 `purchases / bills / bill_payments / budgets / cards / backups` 的策略；前端只做 `canFinance` 状态、隐藏账单底部导航 / 快捷入口 / 路由守卫、成员页开关。房产价格、医疗、交易金额放第二步。
**成本：中偏大**（一条迁移但改动策略多，必须按 `supabase/verify_026_029.sql` 的方式写一份验证脚本：用一个无权限成员的身份逐表 `select count(*)`，确认为 0 或只有自己的行；`schema.sql` 同步合并）。

---

## 8.（可选）上门维修「工单」与家庭日程

### 需求
师傅上门的完整过程：预约 / 改期 / 取消 → 到场（到达时间、是否准时）→ 开始服务 → 完成（做了什么、怎么做的）→ 评价师傅和公司（沟通、讲解、有没有推销压力）→ 付款。加一个日程（时间、公司、联系人、电话、备注），全家在今日页能看到；开始后能关联到现有的设备维修记录（`js/house/fix.js`、`tasks.js`、检查卡）和花费记录。问：值不值得做、对以后分析（继续用这家还是换、谁报价低）有什么帮助、还能覆盖哪些任务类型、怎么分期。

### 现状
- 维修 / 保养事实已记在 `maintenance_logs`：`done_on / kind / cost / vendor（自由文本，40 字）/ diy / notes / purchase_id`（`schema.sql` 第 384 行），费用同时写一笔 `purchases`（`js/house/assets.js` 第 905–922 行）。**缺**：预约时间、到场准时与否、报价 vs 实付、评价；`vendor` 是自由文本，同一家写法不同就统计不到一起。
- 「检查发现问题 → 待处理 → 记一条维修」闭环已有（design-care.md §3），「出了问题？」能生成诊断结论（`js/house/fix.js`），但从「要叫人」到「人来了修完」中间是空白。
- 时间线先例：交易进展 `deal_events`（`schema.sql` 第 1347 行：`happened_on / title / note / contact`），是挂在交易下的事件流。
- 首页提醒总线 `js/core/alerts.js` 支持 `due / daysLeft / assigned_to / actions`，加一个 `source: 'visit'` 不需要改总线本身。
- 家庭名册 `household_people`（迁移 029）只记家人 / 孩子 / 宠物，没有「商家 / 师傅」通讯录。

### 假设
- D1. 一个家庭一年上门服务 5–20 次（暖通年检、管道、家电维修、除虫、清洁、草坪），值得有结构，但不值得做成派单系统。
- D2. 真正的长期价值在**商家维度**：同一家公司来过几次、准时率、平均报价 / 实付、评分、有没有推销——这要求商家是一条**实体**，不是自由文本。
- D3. 全家都要看见「明天上午水管工来」，但评价、付款金额受第 7 节财务权限约束（无财务权限的老人可以记「到了 / 做完了」，看不到金额统计）。

### 评估：值不值得
- **值得做的部分**：日程（谁什么时候来）+ 完成后一键落成维修记录 + 商家实体与评分。这三样直接解决「忘了约 / 忘了谁来过 / 下次该不该再找他」。
- **不值得做（至少现在）**：完整状态机的每一步都要点（到场、开始、完成分三次点），对家庭来说太重；师傅在场时没人会掏手机点「开始服务」。建议把「到场 / 开始」合并成一次「人到了」打点（自动记时间、对比预约算准时），其余在事后一次填完。
- **分析能带来什么**：按商家看「次数 / 准时率 / 平均实付 / 评分 / 推销次数」；按设备类型看「谁报价低」（同一工种多家报价可以记成同一工单的多个报价）；配合设备寿命和维修累计，加强现有「修还是换」判断。

### 建议（数据模型）
- `vendors`（商家）：`name, trade（工种：暖通 / 水管 / 电工 / 家电 / 除虫 / 清洁 / 园林…）, phone, contact, notes`，家庭级。`maintenance_logs` 加可空的 `vendor_id`（旧的 `vendor` 文本保留，表单里优先选商家）。
- `visits`（上门工单 / 预约）：`property_id, asset_id?(可空), vendor_id?, kind（repair / service / inspect / quote / other）, status（scheduled / done / cancelled）, start_at, window_minutes, arrived_at, reschedule_count, cancel_reason, quote_amount, summary（做了什么）, ratings jsonb {overall, communication, explanation, pressure}, log_id（完成后生成的保养记录）, created_by`。改期只更新 `start_at` 并 `reschedule_count + 1`，不另建历史表。
- 金额不在 `visits` 里重复：实付走现有「保养记录 → purchases」那条路；`quote_amount` 属于财务列，第 7 节的 RLS 一并管。

### 流程（压成三步）
1. **约**：设备页「约师傅」/ 「出了问题？」结论页「要叫人 → 约师傅」/ 今日页快捷入口 → 填时间、商家、关联设备、备注。今日页注意事项出现「明天 9–11 点 · ABC Plumbing · 热水器」（`severity` 按天数），全家可见；可导出 .ics（复用 `js/bills/logic.js` 已有的日历导出）。
2. **人到了**：工单上一个大按钮，记 `arrived_at`，自动显示「准时 / 晚了 25 分钟」。
3. **完成**：一页填完——做了什么、换了什么件、实付金额和付款方式、三项评分 + 「有没有推销」。保存时自动生成一条 `maintenance_logs`（kind 按工单类型，`vendor_id`、`purchase_id` 都带上），如果它对应一条「检查：需维修」的待处理，待处理随之消失（现有逻辑天然成立，因为多了一条维修记录）。

### 还能覆盖的任务类型
年度保养（暖通、热水器冲洗、化粪池抽吸）、上门报价 / 比价（只有 `quote` 没有完成）、除虫 / 清洁 / 草坪等定期服务、网络 / 燃气装机、家电送货安装、保险理赔勘察、房屋检查（买卖交易里可以挂到交易清单）、车辆送修（`asset_id` 指向车辆，地点是车行而不是家）。

### 分期
| 期 | 内容 | 成本 |
|---|---|---|
| W0 | **不建表**：保养记录表单加「预约日期」，未来日期的记录作为「已约」在今日页提醒；`vendor` 文本做大小写 / 空格归一后按商家汇总次数和金额（照 `storeKey` 的做法）。验证大家用不用。 | 小 |
| W1 | `visits` + `vendors` 两张表；约 → 人到了 → 完成三步；今日页提醒；完成生成维修记录。 | 大 |
| W2 | 评分、多家报价、商家页（次数 / 准时率 / 平均实付 / 评分），「修还是换」页引用商家数据。 | 中 |
| W3 | 其他任务类型（定期服务的周期性预约、交易清单里的检查 / 估价预约）。 | 中 |

### 推荐
先做 W0 观察 1–2 个月；只有当家里确实每月都有上门、并且想比较商家时再上 W1。W1 必须在第 7 节财务权限之后做，否则报价、实付这些新列又会对所有成员敞开。

---

## 依赖与顺序

1. 第 2 节（小，纯数据）可以随时做；
2. 第 3 节依赖第 2 节的类型（取暖器是主要召回对象），一条迁移；
3. 第 7 节是安全问题，优先级最高，建议先于第 3、8 节合并上线；
4. 第 8 节 W0 不依赖任何东西，W1 依赖第 7 节。
