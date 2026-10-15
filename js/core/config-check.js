/* 检查 config.js：为什么没有进入云端协同模式，在设置页直接说明原因 */
const decodeJwtRole = (key) => {
  try { return JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role || null; } catch { return null; }
};

/** 返回 { mode: "cloud" | "demo" | "blocked", url, key, issue } */
export function checkConfig() {
  const cfg = window.APP_CONFIG;
  if (!cfg || typeof cfg !== "object") {
    return { mode: "demo", issue: "没有读到 config.js：文件可能没上传到网站根目录，或者有语法错误（常见：用了中文引号“”、少了逗号、key 中间断行）。" };
  }
  const url = String(cfg.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(cfg.SUPABASE_ANON_KEY || "").trim();
  if (!url && !key) return { mode: "demo", issue: "网站上的 config.js 里地址和 key 都是空的，说明线上还是空白模板：确认改好的 config.js 已经提交到 GitHub，然后强制刷新。" };
  if (!url) return { mode: "demo", issue: "config.js 里填了 key，但 SUPABASE_URL 是空的。" };
  if (!key) return { mode: "demo", issue: "config.js 里填了地址，但 SUPABASE_ANON_KEY 是空的。" };
  if (!/^https:\/\//i.test(url)) return { mode: "demo", issue: "SUPABASE_URL 需要以 https:// 开头，例如 https://你的项目ID.supabase.co" };
  if (/\/(rest|auth)\/v1/i.test(url)) return { mode: "demo", issue: "SUPABASE_URL 只填项目地址（https://你的项目ID.supabase.co），不要带 /rest/v1 之类的后缀。" };
  // 安全：绝不能在网页里使用有最高权限的密钥（会绕过所有数据权限保护）
  if (key.startsWith("sb_secret_") || decodeJwtRole(key) === "service_role") {
    return { mode: "blocked", issue: "config.js 里填的是 secret / service_role 密钥。这个密钥会绕过所有数据权限保护，放在公开网页里任何人都能读写你的数据库。请立即在 Supabase 控制台重新生成（Rotate）这个密钥，并改填 anon public 或 publishable key。" };
  }
  if (!key.startsWith("sb_publishable_") && !(key.startsWith("eyJ") && decodeJwtRole(key) === "anon")) {
    return { mode: "demo", issue: "SUPABASE_ANON_KEY 看起来不是有效的 key：应以 eyJ 开头（legacy anon key）或 sb_publishable_ 开头（publishable key）。复制时注意不要多出空格或少字符。" };
  }
  return { mode: "cloud", url, key };
}
