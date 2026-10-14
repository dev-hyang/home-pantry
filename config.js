// 部署配置：留空 = 本地演示模式（数据只存在当前浏览器）
// 填入 Supabase 项目信息 = 云端协同模式（家人共享同一份清单）
// 注意：这里只能放 anon public key（本来就是公开的，靠 RLS 保护数据）；
//       绝对不要放 service_role key。
window.APP_CONFIG = {
  SUPABASE_URL: "",       // 例如 "https://YOUR-PROJECT-REF.supabase.co"
  SUPABASE_ANON_KEY: "",  // 例如 "eyJhbGciOi...（anon public）"
};
