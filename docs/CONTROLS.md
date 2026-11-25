# 共享控件说明（home-pantry）

每个控件 = 一段生成 HTML 的小函数（或一个固定的 class + `data-*` 属性）+ 一块 CSS + 可选的全局行为。
这张表就是以后迁到 Vue / Svelte 时的**映射表**：

| 这里的写法 | Vue / Svelte 里对应 |
|---|---|
| 函数参数 / `data-*` 属性 | 组件 props |
| `${…}` 拼进来的子内容 | slot / children |
| 挂在 `document` 上的行为（事件委托） | composable / action（`use:`） |
| `:root` 里的语义变量（`--ok`、`--surface-2`…） | 主题变量，原样保留 |

**约定**：变体用 `data-*` 属性（不用拼类名）；状态用 `is-*` 类或 `aria-*`；类名前缀 `ui-` 的是共享控件；
新页面优先用这里的控件，不要再各写各的。改了控件，要在 390px 和 1280px 下各看一遍。

## 位置

| 文件 | 内容 |
|---|---|
| `shared/ui.css`（母版，姊妹站各留副本） | 徽标、铃铛、提示、箭头、行、选项、弹窗变量、数字框 |
| `styles.css`（home-pantry 自己） | 各页面自己的样式（搜索框、日期框的统一样式也在这里） |
| `js/core/*.js` | 生成 HTML 的函数和全局行为 |

## 控件清单

### 数字 / 金额框 · `numAttrs(kind, over)` · `js/core/ui-num.js`
`<input name="x" ${numAttrs("money")} value="…">`

| 参数 | 取值 | 说明 |
|---|---|---|
| `kind` | `money` · `qty` · `int` · `rate` | 金额（两位小数）· 数量（不限小数）· 整数 · 百分比 |
| `over` | `{ min, max, step, inputmode }` | 覆盖预设；值为 `null` = 去掉该属性 |

输出 `type="number" data-num="…" inputmode min step max`。样式：`input[data-num]`（等宽数字）。
**聚焦整段选中**由 `js/core/num-focus.js` 全局处理（`type=number`、`inputmode=decimal|numeric`），不用在控件上配置。
动态 `min` / `max` 的框（出厂年份、搜索半径等）仍写原生属性。

### 箭头 · `ui-chev` · `shared/ui.css`
`<span class="ui-chev" aria-hidden="true">›</span>`

| 属性 | 取值 | 说明 |
|---|---|---|
| `data-dir` | 省略（›，进入 / 展开）· `down`（▾，收起时转 -90°） | |

父级 `[open]` 时转 90° 的规则写在各容器下（`.xxx[open] > summary .ui-chev`）。`rl-badge-go`（发布日志）在共享文件里，暂未并入。

### 行 · `ui-row` · `shared/ui.css`
`<li class="ui-row 自己的类名" data-variant="…">`，列的排法（grid / flex）写在自己的类名下。

| `data-variant` | 说明 | 最小高 |
|---|---|---|
| 省略 / `record` | 记录行、菜单行：实线分隔，最后一行不画线 | 56px |
| `detail` | "名称：内容"行 | 44px |
| `card` | 自带一圈边框的卡片行，最后一个也有边框 | — |

已换：`inv-row`、`bill-row`、`all-row`、`mrow`、`fa-row`、`task-row`、`tpl-row`、`dt-row`、`scan-row`、`as-row`。
未换：`dl-row`（时间线）、`dd-row` / `dr-row`（债务行内部网格）、宽屏表格行 `dv-row` / `deal-row` / `ssr-row` / `ask-item`（需要手机折叠，另做）。
行为钩子：长按菜单 `data-lp`（`lpAttr(items, title)` 生成）、滑动 `.swipe-src` / `.swipe-alt-src`。

### 可选的一行 · `ui-opt` · `shared/ui.css`
`<… class="ui-opt 自己的类名">`，用在下拉选项、目录项、底部弹窗选项。

| 状态 | 写法 |
|---|---|
| 当前项 | `is-cur` 或 `aria-current="page"` |
| 键盘高亮 | `is-hl` |
| 禁用 | `is-off` 或 `disabled` |

点按区不低于 44px。字号、内边距、边框各用处自己定（弹窗选项加 `fam-sheet-row` 带边框）。

### 底部弹窗 · `sheetHtml({…})` · `js/core/ui-sheet.js`

| 参数 | 说明 |
|---|---|
| `title` | 标题 HTML（调用方转义），可空 |
| `label` | 读屏名字（纯文字） |
| `list` | 选项清单 HTML（选项用 `ui-opt fam-sheet-row`） |
| `closeAttr` | 遮罩和取消按钮都带的属性（如 `data-lp-close`），由调用方的点击处理去关 |
| `cancelText` | 取消按钮文字 |

外观变量：`--sheet-r`、`--sheet-shade`、`--sheet-shadow`（`ask-dlg` 手机端共用）。
键盘与焦点（2026-11-24.33 起，`ui-sheet.js` 里自动生效，调用方不用接线）：出现时焦点移进面板、消失后回到原处；Tab 只在面板里转圈；Esc 点「取消」（长按菜单自己处理 Esc）。背后的页面不会被设成 `inert`，和原生 `<dialog>` 比还差这一点。

### 按钮 · `ui-btn` · `shared/ui.css`
`<button class="ui-btn" data-size="sm" data-tone="primary">保存</button>`（老页面的 `btn` / `btn-sm` / `btn-primary` 是同一套尺寸，逐页换成 `ui-btn`）

| 属性 | 取值 | 说明 |
|---|---|---|
| `data-size` | 省略（40px，字 15px）· `sm`（34px，字 13px） | 高度算上边框 |
| `data-tone` | 省略 · `primary` · `ghost` · `danger` | 中性 · 主操作 · 描边 · 危险 |

手机 / 触屏上小号的视觉高度不变，点按区域靠 `::after` 向外延伸到 ≥44px。上下内边距只给折行留空，高度由 `--btn-h` / `--btn-h-sm` 决定。

### 按钮条 · `ui-acts` · `shared/ui.css`
一组按钮的容器：一个靠右；两个 = 第一个（取消）靠左、第二个（保存）靠右；三个及以上全靠右（删除放最左）；手机（≤480px）两个并排等宽、一个占满一行。
旧的 `form-actions` / `ask-acts` / `tax-item-actions` / `deal-confirm-actions`（2026-11-24.44 起）用 CSS 套了同样的排法，HTML 不用改；三个以上按钮的表单条仍是等宽平分的 `form-actions-split`。新页面直接用 `ui-acts`。

### 对话框 · `ask-dlg` / `ask-form` / `ask-acts`
原生 `<dialog>.showModal()`；手机上贴底、电脑上居中。浏览器负责 Esc、焦点、背景不可点。

### 可搜索下拉 · `js/select-search.js`
给 `<select>` 加属性即可，不用换标签：

| 属性 | 说明 |
|---|---|
| `data-search` | 不管几个选项都要搜索 |
| `data-nosearch` | 不要搜索 |
| `data-search-min="N"` | 这一个 select 改成 N 个及以上才搜索（默认 9） |

电脑：原位打字筛选的 combobox；手机：只有带 `data-search` 的长下拉才变成弹窗里的搜索 + 清单，其余用原生下拉（刻意的，防止手指落下时选项被换）。

### 筛选 / 目录面板 · `filterPop` / `navPop` / `treePop` · `js/core/filter-pop.js`、`tree-pop.js`

| 函数 | 参数 |
|---|---|
| `filterPop(inner, { id, count, clear, cls, eye })` | 筛选按钮 + 面板；`count` = 已改动的筛选数 |
| `navPop(items, { id, label })` | `items = [{ href, icon, label, current }]` |
| `treePop(nodes, { id, label, actions })` | `nodes = [{ label, icon, href, badge, current, open, children }]` |

### 徽标 / 铃铛 / 提示 · `shared/ui.css`

| 控件 | 类名 | 属性 |
|---|---|---|
| 徽标 | `ui-badge` | `data-tone`（ok · warn · caution · danger · accent）、`data-size`（sm · lg）、`data-shape`（dot · count）、`data-soft`、`data-outline` |
| 铃铛 | `ui-bell` | `data-size`、`data-anchor="top-left"` |
| 提示 | `ui-hint` | `data-tip`（文字）、`data-mode`（sup · inline）、`data-size`（sm · md · lg） |

### 其他全局行为

| 行为 | 怎么用 |
|---|---|
| 文字框自动长高 | `<textarea data-autosize>`（`js/core/autosize.js`） |
| 日期 / 月份框 | 直接写原生 `type="date"` / `"month"`；全站统一样式（宽度 100%、和文字框一样高、`appearance: none`），不需要控件函数 |
| 搜索框 | 直接写原生 `type="search"`；`appearance: none`，高度跟旁边的下拉对齐 |

## 还没做的

- 宽屏表格行（`dv-row` 等）的手机折叠。
- `rl-badge-go` 并入 `ui-chev`（要和姊妹站一起改共享文件）。
- 选人面板、长按菜单换成原生 `<dialog>`（现在只补了焦点和 Esc，背后页面不是 `inert`）：选人面板跟着页面重画，换成 `<dialog>` 要在每次重画后补一次 `showModal()`，暂不做。
- 姊妹站还没用上这些控件：样式已随 2026-11-24.41 同步进各自的 `shared/ui.css`，要用时直接写 `ui-chev` / `ui-row` / `ui-opt`（姊妹站没有 `--r-md` / `--r-sm`，用了兜底值）。
- 清理疑似死代码类名：已在 2026-11-24.32 删除 `purchase-row`（含 `pr-*`）、`tl-item`、`tatt-row` / `tatt-list`、`med-li`、`ks-row`（含 `kpi-split`）、`hb-row` 的样式。
  还留着没确认的：`.tl` 时间线的 `tl-mark`、`tl-dot`、`tl-today`，`hb-list`（JS 里已没有使用，下次顺手清）。
