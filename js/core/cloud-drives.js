/* ============ 云盘直连：Google Drive、Dropbox ============
   四个应用共用同一份代码（各仓库各放一份拷贝），由各自的 backup.js 用 createDrives(cfg) 实例化。
   - 令牌按 cfg.tokPrefix 存 localStorage：四个站点在同一个域名下，前缀相同就共用——在任一应用连接一次，其余都连上了。
   - Google：Identity Services 令牌流程（弹窗；令牌一小时，续期也要用户点一下，所以定时备份到期时会出现「继续备份」），
     权限只有 drive.file（只看得到这个应用自己建的、或用户在选择器里选给它的文件 / 文件夹）。
     备份放哪：① 在 Drive 里「选文件夹」（Google Picker，需要 cfg.googleApiKey）——选用户自己建好的任意目录，如 备份/家庭/2026；
              ② 或填一个路径（如「备份/小月亮」），不存在就逐级建。不再往 Drive 根目录随便放。
   - Dropbox：OAuth 2 PKCE，拿到 refresh token，定时备份可以静默续期。Access type 选 App folder 时根就是 Apps/<应用名>/，路径相对它（可留空）。
   - 都只在 config 里填了公开的客户端标识后才可用；「断开」会吊销并清掉令牌。
   cfg = { googleClientId, googleApiKey, dropboxAppKey, tokPrefix, defaultFolder, fileRe, keepDays, t, load, save,
           getPaths: () => ({ gd, gdId, gdName, dbx }) }   // gdId / gdName = 选择器选中的文件夹；有 gdId 就用它，否则按 gd 路径 */
export function createDrives(cfg) {
  const { t } = cfg;
  const TOK = { gd: `${cfg.tokPrefix}.gdrive`, dbx: `${cfg.tokPrefix}.dropbox` };
  const tok = (k) => cfg.load(TOK[k], null), setTok = (k, v) => cfg.save(TOK[k], v);
  for (const old of cfg.legacyPrefixes || []) for (const k of ["gd", "dbx"]) { const v = cfg.load(`${old}.${k === "gd" ? "gdrive" : "dropbox"}`, null); if (v && !tok(k)) { setTok(k, v); } if (v) cfg.save(`${old}.${k === "gd" ? "gdrive" : "dropbox"}`, null); }   // 升级前各应用各连各的：把旧前缀的令牌搬到共用前缀
  const gdConfigured = () => /\.apps\.googleusercontent\.com$/.test(cfg.googleClientId || "");
  const gdPickerAvailable = () => gdConfigured() && !!cfg.googleApiKey && !/YOUR/.test(cfg.googleApiKey);
  const dbxConfigured = () => !!cfg.dropboxAppKey && !/YOUR/.test(cfg.dropboxAppKey);
  const gdOn = () => gdConfigured() && !!tok("gd"), dbxOn = () => dbxConfigured() && !!tok("dbx");
  const cutoff = () => new Date(Date.now() - cfg.keepDays * 864e5).toISOString().slice(0, 10);   // 文件名里的日期早于这天的清掉
  const clean = (p) => String(p || "").split("/").map((x) => x.trim()).filter(Boolean);
  const paths = () => cfg.getPaths() || {};
  const gdSegs = () => { const s = clean(paths().gd); return s.length ? s : clean(cfg.defaultFolder); };
  const dbxDir = () => { const s = clean(paths().dbx); return s.length ? `/${s.join("/")}` : ""; };

  /* ---- Google Drive ---- */
  const loadScript = (src) => new Promise((res, rej) => { if ([...document.scripts].some((x) => x.src === src)) return res(); const el = document.createElement("script"); el.src = src; el.onload = () => res(); el.onerror = () => rej(new Error(t("Google 组件加载失败"))); document.head.appendChild(el); });
  let gis = null;
  function loadGis() { if (gis) return gis; gis = window.google?.accounts?.oauth2 ? Promise.resolve() : loadScript("https://accounts.google.com/gsi/client"); return gis; }
  async function gdToken(gesture) {
    const cur = tok("gd");
    if (cur && cur.exp > Date.now() + 60e3) return cur.access_token;
    if (!gesture) throw new Error("NEED_GESTURE");
    await loadGis();
    return new Promise((res, rej) => {
      window.google.accounts.oauth2.initTokenClient({ client_id: cfg.googleClientId, scope: "https://www.googleapis.com/auth/drive.file", prompt: cur ? "" : "consent",
        callback: (r) => { if (r.error) return rej(new Error(r.error_description || r.error)); setTok("gd", { ...(cur || {}), access_token: r.access_token, exp: Date.now() + (+r.expires_in || 3600) * 1000 }); res(r.access_token); },
        error_callback: (e) => rej(new Error(e.message || e.type || "popup")) }).requestAccessToken();
    });
  }
  async function gdFetch(url, init = {}, gesture = false) {
    const at = await gdToken(gesture);
    const r = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${at}` } });
    if (r.status === 401) { setTok("gd", { ...(tok("gd") || {}), exp: 0 }); throw new Error(gesture ? t("Google 登录已过期，请重新连接") : "NEED_GESTURE"); }
    if (r.status === 404) throw new Error(t("Drive 里选的文件夹找不到了（被删或改了名）：重新选一个"));
    if (!r.ok) throw new Error(`Google Drive ${r.status}`);
    return r;
  }
  const GD_API = "https://www.googleapis.com/drive/v3/files", FOLDER = "application/vnd.google-apps.folder";
  const esc1 = (s) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  /** 备份放进哪个文件夹：选择器选过的直接用它的 id；否则按路径逐级找 / 建（只认这个应用自己建的）；路径没变就用缓存 */
  async function gdFolder(gesture) {
    const p = paths(); if (p.gdId) return p.gdId;
    const segs = gdSegs(), key = segs.join("/"), cur = tok("gd");
    if (cur?.folder && cur.folderPath === key) return cur.folder;
    let parent = "root";
    for (const seg of segs) {
      const q = encodeURIComponent(`name='${esc1(seg)}' and mimeType='${FOLDER}' and '${parent}' in parents and trashed=false`);
      const found = await (await gdFetch(`${GD_API}?q=${q}&fields=files(id)`, {}, gesture)).json();
      let id = found.files?.[0]?.id;
      if (!id) id = (await (await gdFetch(`${GD_API}?fields=id`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: seg, mimeType: FOLDER, parents: [parent] }) }, gesture)).json()).id;
      parent = id;
    }
    setTok("gd", { ...tok("gd"), folder: parent, folderPath: key }); return parent;
  }
  // setAppId = Cloud 项目编号（就是 Client ID 开头那串数字）：只有带上它，drive.file 权限才会把「你在选择器里选的文件夹」授权给这个应用，之后才能往里写
  /** Google Picker：让用户在自己的 Drive 里选一个文件夹（选了就授权给这个应用）。必须在点击里调用；返回 { id, name } 或 null（取消） */
  async function gdPickFolder() {
    if (!gdPickerAvailable()) throw new Error(t("还没在 config 里填 GOOGLE_API_KEY（Picker 要用）"));
    const token = await gdToken(true);
    await loadScript("https://apis.google.com/js/api.js");
    await new Promise((res, rej) => window.gapi.load("picker", { callback: res, onerror: () => rej(new Error(t("Google 组件加载失败"))) }));
    return new Promise((res) => {
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes(FOLDER);
      new window.google.picker.PickerBuilder().addView(view).setOAuthToken(token).setDeveloperKey(cfg.googleApiKey).setAppId(String(cfg.googleClientId || "").split("-")[0]).setTitle(t("选一个放备份的文件夹"))
        .setCallback((d) => { if (d.action === "picked" && d.docs?.[0]) res({ id: d.docs[0].id, name: d.docs[0].name }); else if (d.action === "cancel") res(null); }).build().setVisible(true);
    });
  }
  async function gdList(gesture = false) {
    if (!gdOn()) return [];
    const q = encodeURIComponent(`'${await gdFolder(gesture)}' in parents and trashed=false`);
    const d = await (await gdFetch(`${GD_API}?q=${q}&fields=files(id,name,size,createdTime)&orderBy=createdTime desc&pageSize=100`, {}, gesture)).json();
    return (d.files || []).filter((f) => cfg.fileRe.test(f.name)).map((f) => ({ id: f.id, name: f.name, at: f.createdTime, size: +f.size || 0 }));
  }
  async function gdWrite(blob, name, gesture) {
    const folder = await gdFolder(gesture), body = new FormData();
    body.append("metadata", new Blob([JSON.stringify({ name, parents: [folder], mimeType: "application/json" })], { type: "application/json" })); body.append("file", blob);
    await gdFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", body }, gesture);
    const cut = cutoff(); for (const f of await gdList(gesture)) if ((cfg.fileRe.exec(f.name) || [])[1] < cut) await gdDelete(f.id).catch(() => {});
  }
  const gdRead = async (id) => (await gdFetch(`${GD_API}/${id}?alt=media`, {}, true)).json();
  const gdDelete = (id) => gdFetch(`${GD_API}/${id}`, { method: "DELETE" }, true);
  async function gdConnect() {
    setTok("gd", null); await gdToken(true);
    try { const me = await (await gdFetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", {}, true)).json(); setTok("gd", { ...tok("gd"), email: me.user?.emailAddress || "" }); } catch (e) { /* 邮箱只是显示用 */ }
  }
  function gdDisconnect() { const c = tok("gd"); try { if (c?.access_token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(c.access_token, () => {}); } catch (e) { /* 忽略 */ } setTok("gd", null); }

  /* ---- Dropbox ---- */
  const dbxRedirect = () => location.origin + location.pathname;
  const PKCE_KEY = `${cfg.tokPrefix}.dbx.pkce`;
  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  async function dbxConnect() {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    sessionStorage.setItem(PKCE_KEY, verifier);
    const p = new URLSearchParams({ client_id: cfg.dropboxAppKey, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", token_access_type: "offline", redirect_uri: dbxRedirect(), state: "dbx" });
    location.href = `https://www.dropbox.com/oauth2/authorize?${p}`;
  }
  async function dbxTokenCall(body) {
    const r = await fetch("https://api.dropboxapi.com/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: cfg.dropboxAppKey, ...body }) });
    if (!r.ok) throw new Error(`Dropbox ${r.status}`);
    const d = await r.json(), cur = tok("dbx") || {};
    setTok("dbx", { ...cur, access_token: d.access_token, refresh_token: d.refresh_token || cur.refresh_token, exp: Date.now() + (+d.expires_in || 14400) * 1000 });
    return d.access_token;
  }
  async function dbxToken() {
    const c = tok("dbx"); if (!c) throw new Error(t("还没连接 Dropbox"));
    if (c.exp > Date.now() + 60e3) return c.access_token;
    if (!c.refresh_token) throw new Error("NEED_GESTURE");
    return dbxTokenCall({ grant_type: "refresh_token", refresh_token: c.refresh_token });
  }
  async function dbxFetch(url, init = {}) {
    const r = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${await dbxToken()}` } });
    if (r.status === 401) { setTok("dbx", null); throw new Error(t("Dropbox 登录已过期，请重新连接")); }
    if (!r.ok) { const e = new Error(`Dropbox ${r.status}`); e.status = r.status; throw e; }
    return r;
  }
  const dbxJSON = (o) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
  const dbxArg = (o) => ({ "Dropbox-API-Arg": JSON.stringify(o) });
  async function dbxList() {
    if (!dbxOn()) return [];
    let d; try { d = await (await dbxFetch("https://api.dropboxapi.com/2/files/list_folder", dbxJSON({ path: dbxDir() }))).json(); } catch (e) { if (e.status === 409) return []; throw e; }   // 文件夹还没建：当作空
    return (d.entries || []).filter((f) => f[".tag"] === "file" && cfg.fileRe.test(f.name)).map((f) => ({ id: f.path_lower, name: f.name, at: f.server_modified, size: f.size || 0 })).sort((a, b) => (a.name < b.name ? 1 : -1));
  }
  async function dbxWrite(blob, name) {
    if (dbxDir()) await dbxFetch("https://api.dropboxapi.com/2/files/create_folder_v2", dbxJSON({ path: dbxDir(), autorename: false })).catch((e) => { if (e.status !== 409) throw e; });   // 已有就 409，忽略
    await dbxFetch("https://content.dropboxapi.com/2/files/upload", { method: "POST", headers: { "Content-Type": "application/octet-stream", ...dbxArg({ path: `${dbxDir()}/${name}`, mode: "overwrite", mute: true }) }, body: blob });
    const cut = cutoff(); for (const f of await dbxList()) if ((cfg.fileRe.exec(f.name) || [])[1] < cut) await dbxDelete(f.id).catch(() => {});
  }
  const dbxRead = async (path) => (await dbxFetch("https://content.dropboxapi.com/2/files/download", { method: "POST", headers: dbxArg({ path }) })).json();
  const dbxDelete = (path) => dbxFetch("https://api.dropboxapi.com/2/files/delete_v2", dbxJSON({ path }));
  async function dbxDisconnect() { try { await dbxFetch("https://api.dropboxapi.com/2/auth/token/revoke", { method: "POST" }); } catch (e) { /* 忽略 */ } setTok("dbx", null); }
  /** 打开应用时调一次：从 Dropbox 授权页跳回来（?code=…&state=dbx）就换成令牌；成功返回 true（调用方把 dropbox 勾上并打开备份页） */
  async function initProviders() {
    const u = new URL(location.href), code = u.searchParams.get("code"), verifier = sessionStorage.getItem(PKCE_KEY);
    if (!code || u.searchParams.get("state") !== "dbx") return false;
    u.searchParams.delete("code"); u.searchParams.delete("state"); history.replaceState(null, "", u.pathname + u.search + u.hash);
    sessionStorage.removeItem(PKCE_KEY);
    if (!verifier) return false;
    await dbxTokenCall({ code, grant_type: "authorization_code", code_verifier: verifier, redirect_uri: dbxRedirect() });
    try { const me = await (await dbxFetch("https://api.dropboxapi.com/2/users/get_current_account", dbxJSON(null))).json(); setTok("dbx", { ...tok("dbx"), email: me.email || "" }); } catch (e) { /* 邮箱只是显示用 */ }
    return true;
  }
  /** 卡片上显示的位置 */
  const gdPathText = () => { const p = paths(); return p.gdId ? `📁 ${p.gdName || t("已选的文件夹")}` : gdSegs().join("/"); };
  const dbxPathText = () => `Apps/<app>${dbxDir()}`;
  return { tok, gdConfigured, gdPickerAvailable, dbxConfigured, gdOn, dbxOn, gdConnect, gdDisconnect, gdPickFolder, gdList, gdWrite, gdRead, gdDelete, dbxConnect, dbxDisconnect, dbxList, dbxWrite, dbxRead, dbxDelete, initProviders, gdPathText, dbxPathText };
}
