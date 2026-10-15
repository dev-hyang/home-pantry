// 部署配置：留空 = 本地演示模式（数据只存在当前浏览器）
// 填入 Supabase 项目信息 = 云端协同模式（家人共享同一份清单）
// 注意：这里只能放 anon public key（本来就是公开的，靠 RLS 保护数据）；
//       绝对不要放 service_role key。
window.APP_CONFIG = {
  SUPABASE_URL: "https://pjpbnjjhfuyrxqidwcbn.supabase.co",       // 例如 "https://YOUR-PROJECT-REF.supabase.co"
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqcGJuampoZnV5cnhxaWR3Y2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMDUzNTEsImV4cCI6MjEwNzU4MTM1MX0.Eh7GbBYGlBZCk2NTApHJfUSZ7ovOxIHSUC9SYsgDuAg",  // 例如 "eyJhbGciOi...（anon public）"
};
