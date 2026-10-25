// 部署配置：留空 = 本地演示模式（数据只存在当前浏览器）
// 填入 Supabase 项目信息 = 云端协同模式（家人共享同一份清单）
// 注意：这里只能放 anon public key（本来就是公开的，靠 RLS 保护数据）；
//       绝对不要放 service_role key。
window.APP_CONFIG = {
  SUPABASE_URL: "https://pjpbnjjhfuyrxqidwcbn.supabase.co",       // 例如 "https://YOUR-PROJECT-REF.supabase.co"
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqcGJuampoZnV5cnhxaWR3Y2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMDUzNTEsImV4cCI6MjEwNzU4MTM1MX0.Eh7GbBYGlBZCk2NTApHJfUSZ7ovOxIHSUC9SYsgDuAg",  // 例如 "eyJhbGciOi...（anon public）"
  // 手机号短信验证码登录：需要先在 Supabase → Authentication → Providers → Phone 开启并接入短信服务商（见 README），再改为 true
  // 云盘备份（设置 → 备份与恢复）：填两个公开的客户端标识（不是密钥，和 anon key 一样可以放在网页里），留空时卡片提示「需要先填好」。申请步骤见 README「云盘备份」
  GOOGLE_CLIENT_ID: "84515417841-qgscfp9qnr11os6avv5cjqs9pjtgu3o3.apps.googleusercontent.com",   // Google Cloud Console → OAuth 2.0 客户端（Web 应用）；「已获授权的 JavaScript 来源」填站点地址
  DROPBOX_APP_KEY: "",    // Dropbox App Console → App key；Access type 选 App folder；Redirect URI 填站点地址（带结尾的 /）
  PHONE_LOGIN: false,
  // 邀请码直接进入（不发邮件 / 短信，匿名账号 + 邀请码加入家庭）：需要在 Supabase → Authentication → Sign In / Up 打开 Allow anonymous sign-ins
  QUICK_JOIN: true,
};
