# 同步、备份与恢复：设置手册

适用于四个站点：爱家小助手（home-pantry）、小月亮（baby-log）、家庭学堂（homeschool）、牧羊人（shepherd）。四个站点都在 `https://dev-hyang.github.io/` 下，所以云盘连接和备份设置**共用**：在任一应用连一次，其余三个都连上。
（设计背景见 `docs/design-backup.md`。本文只讲怎么配、怎么用、出问题怎么办。）

## 0. 先搞清楚：备份什么、谁来做

| | 内容 | 谁做 |
|---|---|---|
| 小月亮「我的 → 同步、备份与恢复」 | 小月亮全部记录和设置；**勾上「连同家庭学堂、牧羊人」后一并打包** | **家主**：整个家庭（含家人私有的记录、每位家人的牧羊人数据）。**成员**：只含自己的和全家可见的 |
| 爱家小助手「我的 → 设置 → 备份与恢复」 | 库存、采购、房屋、账单、花费…整个家庭 | 同上，各自在自己的应用里做 |
| 家庭学堂 / 牧羊人「我的 → 备份与恢复」 | 只手动备份 / 恢复本应用；**定时备份由小月亮统一做** | 云盘连接与小月亮共用 |

- **恢复永远只补缺**：已有同 id / 主键的行不动，也不删任何行；不会影响手机现在的数据。
- 备份只留 **60 天**（云端、云盘文件夹、Drive/Dropbox 里按文件名日期自动清；「下载」的清不了）。
- **定时**：网页关着时跑不了，到期后**下次打开应用**时在后台做一次；写本机文件夹或 Google 令牌过期时会提示点「继续备份」。

## 1. Google Drive

### 1.1 你要拿到的两样东西
| 名字（config 里） | 是什么 | 必须吗 |
|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 客户端 ID（以 `.apps.googleusercontent.com` 结尾），让网页能请求「写 Drive」的授权 | **必须**（已在 home-pantry、baby-log 填好；家庭学堂、牧羊人同一个 ID 也可以直接用，见 1.4） |
| `GOOGLE_API_KEY` | 浏览器 API 密钥，只给「在 Drive 里选一个文件夹」（Google Picker）用 | **可选**。不填：卡片上只能「填路径」，照样能备份 |

**这两个都不是 Gemini 的 key，也不是密钥（secret）。**
- Gemini key（设置 → AI 助手里填的）来自 Google AI Studio，调用的是 Generative Language API，和 Drive 无关，不能混用。
- `GOOGLE_API_KEY` 是 Google Cloud Console 里「凭据 → API 密钥」创建的、**限制为 Google Picker API** 的密钥。技术上你也可以在同一个 Cloud 项目里同时放 Gemini 的 key，但建议**分开建、各自加限制**，泄露一个不影响另一个。
- Client ID 和 API key 都是「公开标识」，本来就会出现在网页里，靠**授权来源限制**保护，不需要保密；但 `client secret`、Gemini key、Supabase `service_role` 不要放进任何 config。

### 1.2 创建 Client ID（一次，四个站点共用一个）
1. 打开 <https://console.cloud.google.com/>，顶部项目选择器 → **新建项目**（如 `home-apps`）。
2. 左侧 **APIs & Services → Library**，搜索并启用 **Google Drive API**。（要用选择器的话，再启用 **Google Picker API**。）
3. **APIs & Services → OAuth consent screen**（新版叫 *Google Auth platform → 品牌 / 目标对象*）：
   - 用户类型选 **External**（外部），填应用名、你的邮箱。
   - **Scopes（数据访问）** 加 `https://www.googleapis.com/auth/drive.file`。这是**非敏感范围**：应用只能看到自己建的、或你在选择器里选给它的文件，看不到你 Drive 里别的东西，所以**不需要 Google 审核**。
   - **Test users**：发布状态是「测试中」时，只有列出的邮箱能授权——把你和家人的 Google 邮箱都加进去；想省事就点「发布应用 / Publish app」（drive.file 无需验证）。
4. **APIs & Services → Credentials → 创建凭据 → OAuth 客户端 ID**：
   - 应用类型 **Web 应用**。
   - **已获授权的 JavaScript 来源**：填 `https://dev-hyang.github.io`（只要域名，不带路径、不带末尾斜杠）。四个站点同域名，**填一次就够**。本地调试再加 `http://localhost:8000` 之类。
   - 「已获授权的重定向 URI」**不用填**（我们用弹窗的令牌流程，不跳转）。
5. 复制 **客户端 ID**，填进配置（见 1.5）。

### 1.3 创建 API Key（可选，用于「在 Drive 里选文件夹」）
1. **先启用 Picker API**：APIs & Services → Library → 搜索 **Google Picker API** → 启用。（**「API 限制」下拉里只会列出本项目已启用的 API**——如果只看到 Gemini / Google Drive API 而没有 Picker，就是这一步漏了；启用后刷新密钥页面再选。）
2. **Credentials → 创建凭据 → API 密钥**，点这个密钥进入编辑。
3. **应用限制**选「网站」，添加 `https://dev-hyang.github.io/*`。
4. **API 限制**选「限制密钥」，勾 **Google Picker API**（启用后才有）。如果下拉里实在找不到，退而求其次勾 **Google Drive API** 也能用，但**不要勾 Gemini**——这个密钥会出现在网页源码里，别让它能调用 Gemini。
5. 复制密钥，填进配置的 `GOOGLE_API_KEY`。
6. 效果：连接 Google Drive 后，卡片上多出「或在 Drive 里选一个文件夹…」，可以选你自己建好的任意目录（如 `备份/家庭/2026`），备份就写进那里。
7. **路径输入框只认应用自己建的文件夹**（权限只有 `drive.file`）：你在 Drive 网页上手工建好的文件夹，填路径应用看不见，会在根目录另外新建一个同名文件夹。想用已有的文件夹，必须用这里的选择器。

### 1.4 配置到四个应用
| 应用 | 文件 | 写法 |
|---|---|---|
| 爱家小助手 | `config.js` | `window.APP_CONFIG` 里的 `GOOGLE_CLIENT_ID: "…"`、`GOOGLE_API_KEY: "…"` |
| 小月亮 | `js/config.js` | `const GOOGLE_CLIENT_ID = "…"; const GOOGLE_API_KEY = "…";` |
| 家庭学堂 | `js/core/config.js` | 同上 |
| 牧羊人 | `js/core/config.js` | 同上 |

**四个都要填同一个 Client ID**（也可以只填需要的几个；没填的应用，那张 Google Drive 卡片会显示「需要先在 config 里填好」）。改完 push，等 GitHub Pages 部署（约 1 分钟），强制刷新。

### 1.5 使用
1. 「备份与恢复」页 → Google Drive 卡片 → **连接 Google Drive** → 弹窗里选账号、点**允许**（弹窗被拦截就在地址栏右侧允许弹窗）。
2. 选存放位置：**填路径**（默认 `爱家小助手备份` / `小月亮备份`，可多级如 `备份/小月亮`，不存在自动逐级建），或**在 Drive 里选一个文件夹**。改了位置，列表和写入都换过去。
3. 勾上 Google Drive，点「现在备份」。「已有的备份」里切到 ▲ Google Drive 就能看到、下载、恢复、删除。
4. 令牌一小时失效：定时备份到期时若令牌过期，会提示「继续备份」，点一下重新授权即可。「断开」会吊销并清掉令牌（四个应用同时断开）。

## 2. Dropbox

1. 打开 <https://www.dropbox.com/developers/apps> → **Create app**。
2. 选 **Scoped access** → **App folder**（只给它一个专属文件夹 `Apps/<应用名>/`，最安全）→ 起个名字（全局唯一，如 `home-apps-backup-yourname`）。
3. **Permissions** 标签：勾 `files.content.write`、`files.content.read`、`account_info.read` → 点 **Submit**。
4. **Settings** 标签：
   - **App key** 复制下来，填进配置的 `DROPBOX_APP_KEY`（**不要**用 App secret，我们用 PKCE，不需要 secret）。
   - **Redirect URIs**：把**四个站点的地址都加上，带结尾的 `/`**：
     - `https://dev-hyang.github.io/home-pantry/`
     - `https://dev-hyang.github.io/baby-log/`
     - `https://dev-hyang.github.io/homeschool/`
     - `https://dev-hyang.github.io/shepherd/`
     
     （授权后 Dropbox 会跳回当前站点，必须一字不差匹配；本地调试再加 `http://localhost:8000/`。）
5. 配置位置同 1.4（`DROPBOX_APP_KEY`）。
6. 使用：卡片 → **连接 Dropbox**，会整页跳到 Dropbox 授权，允许后自动跳回备份页并勾上 Dropbox。备份放在应用文件夹里；「应用文件夹里的子路径」可留空，或填 `家庭/备份` 之类。
7. Dropbox 用 refresh token，**定时备份能静默续期**，不需要每次点。
8. 限制：App folder 类型的应用，开发状态下最多 500 个用户，自己家用够了。

## 3. 本地备份（电脑文件夹 / 其他云盘）

### 3.1 云盘同步文件夹（iCloud Drive / OneDrive / Google Drive 桌面版 / Dropbox 桌面版）
iCloud 和 OneDrive 没有网页 API，Google / Dropbox 也可以走这条（不需要任何 key）：
1. 电脑上装好对应云盘客户端，它会在本机放一个同步文件夹：
   - iCloud Drive：Mac `~/Library/Mobile Documents/com~apple~CloudDocs`（访达侧栏「iCloud 云盘」）；Windows 装 iCloud 后在 `C:\Users\<你>\iCloudDrive`
   - OneDrive：Windows `C:\Users\<你>\OneDrive`，Mac `~/OneDrive`
   - Google Drive 桌面版：Windows 一般是 `G:\我的云端硬盘`，Mac `~/Google Drive`
   - Dropbox 桌面版：`~/Dropbox`
2. 备份页 →「云盘同步文件夹」卡片 → 下拉选云盘（只影响提示文字）→ **选同步文件夹**，选到上面的目录（可以建个子文件夹，如 `备份/家庭`）→ 勾上。
3. 选一次就记住，以后静默写入；浏览器重启后第一次可能要点一下「授权」。只留 60 天，文件名里的日期早于 60 天的自动删。
4. **只支持桌面 Chrome / Edge**（File System Access API）。Safari、Firefox、手机、iPad 都不行——页面会直说，改用下面的「下载」。

### 3.2 下载到设备（任何设备都能用）
- 每次备份弹出 `.json` 下载。手机上：下载后点「存储到文件」，放进 iCloud Drive / Google Drive 里的文件夹。
- 浏览器下载的旧文件不会自动清理；Chrome 的下载位置若指向 Google Drive，文件会落在它自己建的「Created from Chrome」里——不想要那样就改用上面的 Google Drive 直连。

### 3.3 数据库脚本别忘了
`supabase/schema.sql` 和 `migrations/` **不进 git，也不在备份文件里**，只在你的电脑上。电脑没了，备份文件就导不回去（连表都建不出来）。
- 手动：把各仓库的 `supabase/` 文件夹拷到云盘 / U 盘（baby-log 的那份管三个应用，home-pantry 自己一份）。
- 自动（桌面 Chrome / Edge）：备份页底部的「⚠️ 数据库脚本不在备份里」→ **选 supabase 文件夹**，之后每次写云盘同步文件夹时，会把 `*.sql` / `*.md` 一起拷进它下面的 `sql/` 子目录。

## 4. 应用自己的云端（Supabase 存储）

- 勾「应用自己的云端」：备份存进 Supabase Storage 的私有桶 `backups`。home-pantry 用迁移 `037_backups.sql`，小月亮 / 家庭学堂 / 牧羊人共用迁移 `baby-log/supabase/migrations/017_backups.sql`。
- **家主全家备份**还要迁移 `018_family_backup.sql`（`backup_family` / `restore_family`）。没执行时小月亮备份会提示，且只带自己那份小月亮数据。
- 注意：**云端备份跟着数据库一起丢**。数据库被删、项目不再免费时它也没了，所以至少再勾一个 Google Drive / Dropbox / 本地文件夹。

## 5. 恢复与重建

### 5.1 换手机 / 清了浏览器数据
数据在云端，登录同一个家庭即可，不需要恢复。只有**本机模式**（没加入家庭）的小月亮，和**演示模式**的爱家小助手，数据在浏览器里，才需要用备份文件恢复。

### 5.2 数据库被删 / 换 Supabase 项目
1. 新建 Supabase 项目。SQL Editor 里依次执行：爱家小助手的 `home-pantry/supabase/schema.sql`（完整建库）+ `037_backups.sql`；小月亮系的 `baby-log/supabase/schema.sql`（基线 + 迁移 002–018 原样并入，一个文件即可）。
2. 把新项目的 URL 和 anon key 填进各应用的 config，push 部署。（小月亮系要在 Authentication 里打开 **Allow anonymous sign-ins**。）
3. 每位家人重新注册登录；家主创建家庭，其他人用邀请码加入。（旧账号 id 没了，所以备份里家人的数据按**称呼**对到新账号。）
4. 家主依次恢复：**小月亮先**（孩子 id 在它的家庭设置里），选最近的备份文件 → 预览 → 「合并进来」；带「连同家庭学堂、牧羊人」的文件会同时补上两个应用的数据。爱家小助手单独恢复它自己的备份。
5. 注意：**每个人的收入**（爱家小助手）按登录账号存，新账号对不上，要本人再填一次。

### 5.3 恢复的规则（再强调）
- 只补缺：已有的行不动，不删除，不覆盖。想让备份里的版本覆盖现在的，需要先手动删掉现在那几条再恢复。
- 家主恢复全家备份；成员恢复时只导回自己的牧羊人数据和家庭学堂数据。

## 6. 排错

| 现象 | 原因 / 办法 |
|---|---|
| 点「连接 Google Drive」没反应 | 弹窗被 Chrome 拦了：地址栏右侧允许弹窗，再点一次 |
| 弹窗报 `redirect_uri_mismatch` / `origin_mismatch` | 「已获授权的 JavaScript 来源」没填 `https://dev-hyang.github.io`（不带路径、不带 `/`） |
| 弹窗报「访问被阻止 / 此应用未经验证」`access_denied` | OAuth 同意屏幕还在「测试中」：把你的邮箱加到 Test users，或点「发布应用」 |
| 备份提示 `Google 登录已过期` / 「继续备份」 | Google 令牌只有一小时，点「继续备份」重新授权一下 |
| 「Drive 里选的文件夹找不到了」 | 那个文件夹被删或移走：点「改用路径」或重新选一个 |
| 看不到「或在 Drive 里选一个文件夹…」 | 没填 `GOOGLE_API_KEY`，或还没连接 Google Drive；Picker API 没启用 |
| Dropbox 跳回来后没连上 / 报错 | Redirect URI 没把当前站点（带末尾 `/`）加进去；或 App key 填错 |
| 「还没执行迁移 037 / 017 / 018」 | 去 Supabase SQL Editor 执行对应的 `.sql` |
| 「这个浏览器不能直接写文件夹」 | Safari / Firefox / 手机：用下载或云盘直连 |
| 备份太大 | 当前整库打成一个 JSON，家用规模（几 MB）没问题；超过几十 MB 再考虑拆分 |

## 7. 安全小结
- 配置里只放**公开标识**：Supabase anon key、Google Client ID、Google API key（有来源限制）、Dropbox App key。
- 不放：Supabase `service_role`、Google client secret、Dropbox App secret、Gemini / 其他 AI 的 key（那些只存在使用者自己的浏览器里）。
- Google 权限只有 `drive.file`；Dropbox 只有自己的应用文件夹。令牌存本机 localStorage，「断开」会吊销。
- 备份文件是明文 JSON，里面有全家的记录：放在你信任的云盘 / 文件夹里，别随便转发。
