import{e as Be,f as oe}from"./chunk-3CMYMNRW.js";import{b as Ie}from"./chunk-QWDA4BGS.js";import{C as Ue,D as Ce,E as ze,F as ne,G as qe,H as Fe,a as je,f as F,g as B,h as te,j as se,k as Le,n as Oe,q as Te,t as Ae,u as f,v as j,w as ae}from"./chunk-E2WNPZ4X.js";import"./chunk-IO6QH7JO.js";import{g as Re}from"./chunk-6INRYYOZ.js";import{c as Q}from"./chunk-WOPZL7BX.js";import"./chunk-FYYFO3CX.js";import"./chunk-ZGRDI2WO.js";import"./chunk-S3UO2IQO.js";import"./chunk-4TSAI4Y2.js";import"./chunk-6MG2GTJQ.js";import{a as be,b as $e}from"./chunk-YUOZ6G6Q.js";import"./chunk-VWGXAOYW.js";import"./chunk-FE3H6UUW.js";import"./chunk-OVGRHFJE.js";import"./chunk-7IHI3BAI.js";import{D as Me,Q as Pe,a as q,w as De,y as _e}from"./chunk-LUS5SUU7.js";import"./chunk-X7FXGYEZ.js";import"./chunk-2ZS7F4HR.js";import{D as X,E as we,F as Ee,a as ve,b as V,c as W,k as ge,m as fe,n as z,o as he,p as ye,q as ke,s as Z,t as J,u as Se,z as xe}from"./chunk-SX2NEGZ7.js";import{Ia as ee,Ja as D}from"./chunk-PVDUY7E7.js";import{a as r,f as C}from"./chunk-CYBFXKK4.js";import{Q as ce,R as pe,T as H,U as me,V as K,Y as U,_ as ue,b as R,c as Y,e as I,k as e,t as a}from"./chunk-OQQ6NGWX.js";var ct=()=>window.dispatchEvent(new Event("hmh-rerender")),pt=t=>t&&t.message==="NEED_GESTURE"?e("Google 登录过期了（授权只管一小时）"):t&&t.message||e("读取失败");function mt(){let t=r.backupUi;if(t&&!t.stale)return t;r.backupUi={...t||{},stale:!1,loading:!0};let s=ae();return Promise.all([Te().catch(()=>({supported:!1,perm:"none",name:""})),Ae().catch(()=>({name:""})),...s.map(n=>j[n].list().then(l=>({r:l}),l=>({e:l})))]).then(([n,l,...d])=>{let c={...r.backupUi.lists||{}},o={};s.forEach((i,u)=>{d[u].e?o[i]=pt(d[u].e):c[i]=d[u].r}),r.backupUi={...r.backupUi,folder:n,sql:l,lists:c,errs:o,loading:!1,stale:!1},ct()}),r.backupUi}var N=t=>t?new Date(t).toLocaleString(void 0,{dateStyle:"medium",timeStyle:"short"}):"",ut=t=>t>1048576?`${(t/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(t/1024))} KB`,G=(t,s,n,l,d,c="",o=!1)=>`<label class="bk-card ${s&&!o?"on":""} ${o?"off":""}"><input type="checkbox" name="target" value="${t}" ${s?"checked":""} ${o?"disabled":""}><span class="bk-ic" aria-hidden="true">${n}</span><span class="bk-body"><b>${l}</b><small>${d}</small>${c?`<span class="bk-sub">${c}</span>`:""}</span></label>`;function Ne(){let t=te(),s=mt(),n=D.mode==="cloud",l=s.folder||{supported:Oe(),perm:"none",name:""},d=s.sql||{name:""},c=p=>t.targets.includes(p),o=Le(t),i=B.find(p=>p.id===t.provider)||B[0],u=`<select name="provider" aria-label="${a(e("云盘"))}">${B.map(p=>`<option value="${p.id}" ${p.id===i.id?"selected":""}>${a(e(p.name))}</option>`).join("")}</select>`,v=l.supported?`<span class="bk-row">${u}${l.name?`<span class="bk-pill ok">📁 ${a(l.name)}${l.perm!=="granted"?` · ${e("待授权")}`:""}</span>`:""}</span>
       <span class="bk-row">${l.name?`${l.perm!=="granted"?`<button type="button" class="btn btn-sm" data-action="backup-grant">${e("授权这台电脑写入")}</button>`:""}<button type="button" class="btn btn-sm btn-ghost" data-action="backup-pick-folder">${e("换文件夹")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-forget-folder">${e("不再用")}</button>`:`<button type="button" class="btn btn-sm" data-action="backup-pick-folder">${e("选同步文件夹")}</button>`}</span>
       <em>${a(e(i.hint))}</em>`:`<em class="bk-warn">${e("这个浏览器不能直接写文件夹（手机、iPad 和 Safari 都不行）。手机上用「下载到设备」，再在系统的分享 / 文件里存到 iCloud Drive 或 Google Drive。")}</em>`,T=`<span class="bk-row">${d.name?`<span class="bk-pill ok">📁 ${a(d.name)}</span><button type="button" class="btn btn-sm btn-ghost" data-action="backup-forget-sql">${e("不再用")}</button>`:l.supported?`<button type="button" class="btn btn-sm" data-action="backup-pick-sql">${e("选 supabase 文件夹")}</button>`:""}</span>`,A=t.last?e("上次备份 {d}",{d:N(t.last)}):e("还没备份过"),M=se(t)?o&&o.getTime()<=Date.now()?e("已到期，下次打开应用时自动备份"):e("下次 {d}",{d:N(o?.toISOString())}):e("没开定时"),h=ae(),x="";if(h.length){r.backupSrc=h.includes(r.backupSrc)?r.backupSrc:h[0];let p=r.backupSrc,b=(s.lists||{})[p]||[],w=j[p],E=m=>`<li><div class="grow"><span class="name">${a(m.name)}</span><small>${a(N(m.at))} · ${ut(m.size)}</small></div>
        <button type="button" class="btn btn-sm btn-ghost" data-action="backup-dl" data-src="${p}" data-id="${a(m.id||m.name)}" data-name="${a(m.name)}">${e("下载")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-use" data-src="${p}" data-id="${a(m.id||m.name)}">${e("恢复")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-rm" data-src="${p}" data-id="${a(m.id||m.name)}" data-name="${a(m.name)}" aria-label="${a(e("删除"))}">✕</button></li>`,y=b.slice(0,3),P=b.slice(3,30);x=`<div class="panel bk-panel"><h3>${e("备份记录")}</h3>${h.length>1?`<div class="chips bk-srcs">${h.map(m=>`<button type="button" class="chip" data-action="backup-src" data-src="${m}" aria-pressed="${m===p}">${j[m].icon} ${e(j[m].label)}</button>`).join("")}</div>`:`<p class="muted">${w.icon} ${e(w.label)}</p>`}
      ${s.errs?.[p]?`<p class="bk-err">⚠️ ${a(s.errs[p])} <button type="button" class="btn btn-sm" data-action="backup-relist" data-src="${p}">${e("重新授权并刷新")}</button></p>`:""}${s.loading&&!b.length?`<p class="muted">${e("读取中…")}</p>`:b.length?`<ul class="restock-list">${y.map(E).join("")}</ul>${P.length?`<details class="bk-more"><summary>${e("更早的 {n} 条",{n:P.length})}</summary><ul class="restock-list">${P.map(E).join("")}</ul></details>`:""}`:`<p class="muted" style="margin:0">${e("这里还没有备份。上面勾上它，再点「现在备份」。")}</p>`}</div>`}let at=e("需要先在 config.js 里填好（见 README「云盘备份」）"),de=(p,b,w,E,y,P,m,dt,rt,re)=>G(p,c(p),b,w,E?e("放在你 {d} 里指定的文件夹，手机电脑都能用；只留 {n} 天",{d:w,n:F}):at,E?(p==="gdrive"&&t.gdId?`<span class="bk-row"><span class="bk-pill ok">📁 ${a(t.gdName||e("已选的文件夹"))}</span><button type="button" class="btn btn-sm btn-ghost" data-action="backup-gd-clear">${e("改用路径")}</button></span>`:`<span class="bk-row bk-path"><label class="muted">${m}</label><input name="${P}" value="${a(dt||"")}" placeholder="${a(rt)}" maxlength="120" autocomplete="off"></span>${p==="gdrive"?`<small class="bk-hint">${e("只能用应用自己建的文件夹；想用你在 Drive 里已有的文件夹，请点下面的「或在 Drive 里选一个文件夹…」。")}</small>`:""}${p==="gdrive"&&y&&f.gdPickerAvailable()?`<span class="bk-row"><button type="button" class="btn btn-sm btn-ghost" data-action="backup-gd-pick">${e("或在 Drive 里选一个文件夹…")}</button></span>`:""}`)+`<span class="bk-row">${y?`<span class="bk-pill ok">${e("已连接")}${y.email?` ${a(y.email)}`:""}${re?` · ${a(re)}`:""}</span><button type="button" class="btn btn-sm btn-ghost" data-action="backup-${p==="gdrive"?"gd":"dbx"}-off">${e("断开")}</button>`:`<button type="button" class="btn btn-sm" data-action="backup-${p==="gdrive"?"gd":"dbx"}-on">${e("连接 {d}",{d:w})}</button>`}</span>`:"",!E||!y),g=r.backupPreview,nt=g?g.ok?`<div class="notice" role="status"><b>${e("备份来自 {h}，{d}，共 {n} 行",{h:a(g.household||e("未知家庭")),d:N(g.exported_at),n:g.rows})}</b>
      <div class="muted" style="font-size:12.5px;margin:4px 0">${Object.entries(g.counts).map(([p,b])=>`${a(p)} ${b}`).join(" · ")}</div>
      ${g.sameHousehold?"":`<p class="muted" style="margin:4px 0;font-size:12.5px">${e("这是另一个家庭 id 的备份（换了项目或重建过家庭时正常）：会导进现在这个家庭。")}</p>`}
      <p style="margin:6px 0 0;font-size:13px">${e("恢复 = 把文件里的数据导回当前家庭：只补缺的，已有同 id 的行不动，也不删任何行。导出者的记录归到现在登录的你。")}</p>
      <div class="bk-row" style="margin-top:8px"><button type="button" class="btn btn-primary btn-sm" data-action="backup-restore-confirm">${e("恢复到当前家庭")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-restore-cancel">${e("取消")}</button></div></div>`:`<div class="notice" role="alert"><b>${e("不能恢复：{why}",{why:a(g.why)})}</b> <button type="button" class="btn btn-sm btn-ghost" data-action="backup-restore-cancel">${e("关闭")}</button></div>`:"",ot=r.backupResult?`<div class="notice ${r.backupResult.ok===!1?"bad":""}" role="status"><b>${a(r.backupResult.title)}</b>${r.backupResult.detail?`<div class="muted" style="font-size:12.5px;margin-top:4px">${a(r.backupResult.detail)}</div>`:""}</div>`:"",lt=n&&r.household?.name||"",it=`<div class="panel synccard ${n?U.err?"bad":"ok":"off"}"><span class="sdot" aria-hidden="true"></span>
    <div class="stext"><b id="syncBadge" class="syncb ${U.err?"err":""}" role="status">${n?a(U.text||e("已同步")):e("保存在这个浏览器")}</b><small>${n?`${a(lt)}${r.members?.length?` · ${e("{n} 位成员",{n:r.members.length})}`:""}`:e("本地演示：数据只在这个浏览器里，更要备份")}</small></div>
    ${n?`<button type="button" class="btn" data-action="reload">${e("立即同步")}</button>`:""}</div>`;return`<h2 class="bk-h">${e("同步")}</h2>${it}
    <h2 class="bk-h">${e("备份")}</h2>
    ${r.backupPending?`<div class="notice" role="status"><b>${e("定时备份在等你点一下")}</b> ${e("写入这台电脑的文件夹需要你授权一次。")} <button type="button" class="btn btn-sm" data-action="backup-continue">${e("继续备份")}</button></div>`:""}
    ${ot}
    <div class="panel bk-panel"><div class="bk-status bk-statushead"><div><b>${a(A)}</b><small>${t.lastInfo?`${a(t.lastInfo)} · `:""}${a(M)}</small></div>
      <div class="bk-row"><button type="button" class="btn btn-primary" data-action="backup-now">${e("现在备份")}</button><button type="button" class="btn btn-ghost" data-action="backup-download">${e("下载一份")}</button></div></div>
    <form id="backupForm" onsubmit="return false">
      <div class="bk-sched"><label>${e("多久备份一次")} <select name="every" aria-label="${a(e("多久备份一次"))}">${[["off","不自动备份"],["week","每周"],["month","每月"],["custom","自定义（天）"]].map(([p,b])=>`<option value="${p}" ${t.every===p?"selected":""}>${e(b)}</option>`).join("")}</select></label>
        <label data-backup-days ${t.every==="custom"?"":"hidden"}>${e("每隔几天")} <input name="days" type="number" min="1" max="365" inputmode="numeric" value="${t.days}" aria-label="${a(e("每隔几天"))}"> ${e("天")}</label></div>
      <p class="muted">${e("网页关着时跑不了：到期后下次打开应用时自动备份一次。")}</p>
      <h3>${e("备份到哪")} <small class="muted">${e("可多选")}</small></h3>
      <div class="bk-cards">
        ${G("folder",c("folder"),"☁️",e("云盘同步文件夹"),e("Google Drive / Dropbox / OneDrive / iCloud Drive 的电脑客户端都有一个同步文件夹，选它就等于备份上了那家云盘；也可以选电脑上任何位置。只留 {n} 天。",{n:F}),v)}
        ${n?G("cloud",c("cloud"),"🗄️",e("应用自己的云端"),e("这个家庭在 Supabase 里的存储，全家任何设备都能恢复；只留 {n} 天；需要先执行迁移 037。",{n:F})):""}
        ${de("gdrive","▲","Google Drive",f.gdConfigured(),f.tok("gd"),"gdPath",e("Drive 里的文件夹路径"),t.gdPath,"爱家小助手备份",f.gdOn()?f.gdPathText():"")}
        ${de("dropbox","◆","Dropbox",f.dbxConfigured(),f.tok("dbx"),"dbxPath",e("应用文件夹里的子路径"),t.dbxPath,e("留空 = 直接放应用文件夹"),"")}
        ${G("download",c("download"),"⬇️",e("下载到设备"),e("每次弹出下载。手机上下载后可以「存储到文件」放进 iCloud Drive / Google Drive；浏览器下载的旧文件不会自动清理。"))}
      </div>
      <div class="bk-sql"><b>⚠️ ${e("数据库脚本不在备份里")}</b><small>${e("supabase/schema.sql 和 migrations 只在你的电脑上（不进 git）。电脑没了，备份文件就导不回去。请把这个文件夹手动拷到云盘或别的位置；选了云盘同步文件夹的话，可以让每次备份顺带把 .sql 一起拷进去：")}</small>${T}</div>
    </form></div>
    ${x}
    <div class="panel bk-panel"><h3>${e("从备份恢复")}</h3><p class="muted">${e("换了手机、数据库被删、或换了 Supabase 项目：先登录并建好家庭（新项目要先在 SQL Editor 执行 supabase/schema.sql），再选备份文件导回来。")}</p>
      <div class="bk-row"><label class="btn btn-sm">${e("选备份文件")}<input id="backupFile" type="file" accept="application/json,.json" hidden></label></div>
      ${nt}</div>
    <details class="ref-panel panel"><summary><b>${e("数据库没了怎么重建")}</b><span class="mch" aria-hidden="true">›</span></summary><div class="ref-body"><ol class="small" style="margin:0;padding-left:18px">
      <li>${e("新建 Supabase 项目（或在原项目里），SQL Editor 执行 supabase/schema.sql（完整建表，含所有迁移；再执行 037_backups.sql 建备份桶）。")}</li>
      <li>${e("把新项目的 URL 和 anon key 填进 config.js，重新部署。")}</li>
      <li>${e("每位家人重新注册登录；家主创建家庭，其他人用邀请码加入。")}</li>
      <li>${e("家主在这里「选备份文件」导入最近一份备份（应用云端里的备份跟着旧项目一起没了，所以云盘 / 下载的那份才是保险）。")}</li>
      <li>${e("家人各自的收入只能由本人登录后再填一次（收入按登录账号存，新账号对不上）。")}</li></ol></div></details>`}var Ge=()=>{let t=te();return`${se(t)?t.every==="week"?e("每周"):t.every==="month"?e("每月"):e("每 {n} 天",{n:t.days}):e("没开定时")} · ${t.last?e("上次 {d}",{d:me(t.last.slice(0,10))}):e("还没备份过")}`};var k=1048576,bt="044_usage.sql",L={name:"Free",db:500*k,storage:1024*k},$t=.7,vt=.9,Ye="",gt={media:"睡前歌曲",backups:"云端备份"},$=null,_=null,le=0,S=null;function O(t){return t=+t||0,t>=1024*k?(t/(1024*k)).toFixed(2)+" GB":t>=k?(t/k).toFixed(t>=100*k?0:1)+" MB":Math.round(t/1024)+" KB"}var ft=t=>t>=vt?"full":t>=$t?"warn":"ok",ht=t=>!!t&&/storage_usage|PGRST202|schema cache|does not exist/i.test(`${t.code||""} ${t.message||""}`);function Qe(t=!1){if(S)return S;if(!t&&$&&Date.now()-le<6e4)return Promise.resolve($);let s=ee.sb;return s?(S=(async()=>{try{let{data:n,error:l}=await s.rpc("storage_usage");if(l)throw l;$=n,le=Date.now(),_=null}catch(n){_=n}return S=null,Ke(),$})(),Ke(),S):Promise.resolve(null)}function He(t,s,n,l,d,c){let o=d?l/d:0,i=ft(o),u=Math.min(100,Math.round(o*100)),v=i==="full"?e("🚨 快满了：再传可能失败，也会挤占备份。先删掉不用的，或升级套餐。"):i==="warn"?e("⚠️ 已经用了一大半，别再大量上传，先清理不用的。"):e("✅ 空间还很宽裕。");return`<div class="usage-row ${i}">
    <div class="usage-top"><b>${t} ${a(s)}</b><span class="usage-num">${e("{used} / {cap} · {p}%",{used:O(l),cap:O(d),p:u})}</span></div>
    <div class="usage-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${u}" aria-label="${a(s)} ${u}%"><i style="width:${l>0?Math.max(u,2):0}%"></i></div>
    <p class="usage-note"><span class="muted">${a(n)}</span><br>${v}${c||""}</p>
  </div>`}function Ve(){if(D.mode!=="cloud"||!ee.sb)return`<p class="muted usage-small">${e("登录并进入家庭后，这里会显示用量。")}</p>`;if(_&&!$){let l=ht(_)?e("还没执行迁移 {n}（用量查询），先在 Supabase 里执行 supabase/migrations/{n}",{n:bt}):e("查询失败：{msg}",{msg:_.message||"error"});return`<p class="usage-small">${a(l)}</p><div class="btns" style="margin-top:8px"><button class="btn btn-sm" data-usage-refresh>${e("重试")}</button></div>`}if(!$)return`<p class="muted usage-small" aria-live="polite">${e("正在查看用量…")}</p>`;let s=(Array.isArray($.buckets)?$.buckets:[]).filter(l=>+l.bytes>0).map(l=>`${a(e(gt[l.name]||l.name))} ${O(l.bytes)}`),n=s.length?`<br><span class="muted">${e("其中：")}${s.join(" · ")}</span>`:"";return`${He("🗄️",e("数据库"),e("记录、任务、日志这些文字数据"),+$.db_bytes,L.db)}
  ${He("📦",e("文件存储"),e("上传的文件和云端备份"),+$.storage_bytes,L.storage,n)}
  <div class="usage-foot"><span class="muted usage-small">${e("更新于 {time}",{time:new Date(le).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})})}${_?" · "+e("刚才刷新失败，显示的是上次的数字"):""}</span>
    <button class="btn btn-sm" data-usage-refresh ${S?"disabled":""}>${S?e("刷新中…"):e("刷新")}</button></div>
  <p class="muted usage-small">${e("{plan} 套餐上限：数据库 {db}、文件存储 {st}（以 Supabase 控制台为准）。{shared}",{plan:L.name,db:O(L.db),st:O(L.storage),shared:Ye?e(Ye):""})}</p>`}function Ke(){document.querySelectorAll("[data-usage]").forEach(t=>{t.innerHTML=Ve()})}function We(){return setTimeout(()=>Qe(),0),`<div class="panel usage" data-usage>${Ve()}</div>`}document.addEventListener("click",t=>{t.target.closest("[data-usage-refresh]")&&Qe(!0)});var ie=()=>_e(),Ze=()=>{let t=r.household?.invite_expires_at;if(!t)return"";let s=new Date(t).getTime()-Date.now();return s<=0?`<b style="color:var(--out)">${e("邀请码已过期")}</b>`:e("有效期至 {d}（还有 {n} 天）",{d:K(t),n:Math.max(1,Math.ceil(s/864e5))})};function Je(){let t=r.pendingMembers||[];if(!ie()||!t.length)return"";let s=n=>`<li><div class="grow"><b>${a(n.display_name)}</b>${n.joined_at?`<small class="muted">${e("{d} 申请",{d:K(n.joined_at)})}</small>`:""}</div>
      <span class="head-acts"><button type="button" class="btn btn-sm btn-primary" data-action="member-approve" data-id="${n.user_id}">${e("批准")}</button><button type="button" class="btn btn-sm btn-danger-ghost" data-action="member-reject" data-id="${n.user_id}">${e("拒绝")}</button></span></li>`;return`<div class="panel pend-panel"><h3 style="font-size:15px;margin:0 0 6px">${e("等你批准（{n}）",{n:t.length})}</h3>
    <p class="muted small" style="margin:0 0 8px">${e("认识这个人再批准：批准后对方能看到家里的数据（对账单、收入、预算除外，要另外开财务权限）。不认识就拒绝，并重新生成邀请码。")}</p>
    <ul class="member-list">${t.map(s).join("")}</ul></div>`}function Xe(){let t=window.SISTER_APPS||[];return t.length<2?"":`<div class="panel">
    <div class="kv"><div><b>${e("姐妹站点")}</b><div class="muted">${e("同一作者的其他小工具；顶栏站名旁的「‹」「›」小胶囊也能切换")}</div></div></div>
    <ul class="app-list">${t.map(s=>`<li class="${s.id==="home-pantry"?"current":""}">
      <span class="app-ico" aria-hidden="true">${s.icon}</span>
      <div class="grow"><b>${a(e(s.name))}</b><small>${a(e(s.sub))}</small></div>
      ${s.id==="home-pantry"?`<span class="badge b-ok">${e("当前")}</span>`:`<a class="btn btn-sm" href="${a(s.url)}">${e("打开")}</a>`}</li>`).join("")}</ul>
  </div>`}var yt=(t,s,n)=>{let l=s.rpm?` · ${e("{a}/分 · {b}/天",{a:s.rpm,b:s.rpd})}`:s.live?` · ${e("上限以控制台为准")}`:"";return`<option value="${a(s.id)}" ${s.id===n?"selected":""} ${s.dead?"disabled":""}>${a(e(s.name))}${s.name!==s.id?` (${a(s.id)})`:""}${l}${s.dead?`（${e("这个 key 已不可用")}）`:""}</option>`},et=(t,s,n,l)=>`<option value="">${e("自动：按这个 key 能用的模型自动选（推荐）")}</option>${s.map(d=>yt(t,d,l?"":n)).join("")}${n&&!l&&!s.some(d=>d.id===n)?`<option value="${a(n)}" selected>${a(n)}</option>`:""}<option value="__custom" ${l?"selected":""}>${e("其他（手填模型名）…")}</option>`;function tt(t,s){if(!s)return e("自动：按可用列表从新到旧试，某个模型超限或下线会自动换下一个。上限用下面的默认值。");let n=Z(t,s);return n?.rpm?e("免费档公布值：每分钟 {a} 次、每天 {b} 次，已带入下面的上限（会变，以控制台为准）。它超限或下线时仍会自动换别的模型。",{a:n.rpm,b:n.rpd}):e("这个模型的免费上限目录里没有：下面的上限留空用默认值，或按控制台 Rate limits 页手填。")}function kt(t,s){if(!z[s.id])return`<label>${e("模型名（留空用默认）")}<input name="model" maxlength="80" placeholder="${a(X(s.id)||s.model)}" value="${a(t.model)}"></label>`;let n=t.model||"",l=z[s.id].filter(c=>c.free!==!1).map(c=>({...c,live:!1})),d=!!n&&!l.some(c=>c.id===n)&&X(s.id)!==n;return`<label class="span-2">${e("模型")}<select name="modelSel" data-provider="${s.id}">${et(s.id,l,n,d)}</select>
      <small id="modelLimitHint">${tt(s.id,d?"":n)}</small></label>
    <div class="span-2 model-refresh"><button type="button" class="btn btn-sm btn-ghost" id="modelRefreshBtn" data-action="ai-models-refresh">↻ ${e("刷新模型列表")}</button><small id="modelListNote" class="muted">${e("正在查这个 key 实际能用的模型…")}</small></div>
    <div class="span-2" id="modelNotices">${st(s.id,n,null)}</div>
    <label class="span-2" id="modelCustomWrap" ${d?"":"hidden"}>${e("模型名（照服务商控制台里的写）")}<input name="model" maxlength="80" placeholder="${a(s.model)}" value="${a(n)}"></label>`}function st(t,s,n){let l=ye(),d=[],c={rpd:e("每天"),rpm:e("每分钟")};for(let i of ke(t))i.type==="limit"?d.push(`⚠️ ${e("Google 返回的 {m} {f}上限是 {n} 次，目录里是 {w}，已按实际的更新。",{m:a(i.model),f:c[i.field],n:i.now,w:i.was??e("没有")})}`):d.push(`🔔 ${e("这个 key 的模型列表有变化：")}${i.added?.length?` ${e("新增")} ${i.added.map(a).join("、")}`:""}${i.removed?.length?` ${e("下线")} ${i.removed.map(a).join("、")}`:""}`);s&&n&&!n.some(i=>i.id===s&&i.live)&&d.push(`⚠️ ${e("你选的 {m} 已不在这个 key 的可用列表里，会自动换别的模型；建议改选“自动”或另一个。",{m:a(s)})}`);let o=z[t]?e("免费上限目录更新于 {d}（{n} 天前）",{d:he,n:l})+(l>45?`，${e("可能已过期，上限以控制台为准")}`:""):"";return`${d.length?`<div class="notice-box" role="status">${d.map(i=>`<p>${i}</p>`).join("")}<button type="button" class="btn btn-sm btn-ghost" data-action="ai-notice-dismiss" data-provider="${t}">${e("知道了")}</button></div>`:""}
    ${o?`<p class="muted" style="margin:6px 0 0;font-size:12.5px">${o}</p>`:""}`}async function ds({refresh:t=!1}={}){let s=document.querySelector("#aiSettingsForm [name=modelSel]");if(!s)return!1;let n=s.dataset.provider,l=document.getElementById("modelRefreshBtn"),d=J(n);l&&(l.disabled=!0);let c;try{c=await Se(n,{refresh:t})}finally{l&&(l.disabled=!1)}let o=document.querySelector("#aiSettingsForm [name=modelSel]");if(!o||o.dataset.provider!==n)return!1;let i=c.filter(x=>x.free!==!1),u=o.value==="__custom",v=o.form.elements.model.value.trim();o.innerHTML=et(n,i,v,u);let T=document.getElementById("modelNotices");T&&(T.innerHTML=st(n,v,c));let A=document.getElementById("modelListNote"),M=J(n),h=M?new Date(M).toLocaleString(void 0,{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}):"";return A&&(A.textContent=c.some(x=>x.live)?e("列表是这个 key 实际能用的模型（每天自动查一次，也可手动刷新；上次 {when}）；灰色的是已对这个 key 下线的。",{when:h}):e("还没查到实际列表（填好 key 并保存后会查），先列常用的。")),M>d}async function rs(t){let s=t.form,n=document.getElementById("modelCustomWrap"),l=t.value==="__custom",d=t.dataset.provider;if(n.hidden=!l,l){s.elements.model.value="",s.elements.model.focus();return}s.elements.model.value=t.value;let c=Z(d,t.value);s.elements.rpm.value=c?.rpm?c.rpm:"",s.elements.rpd.value=c?.rpd?c.rpd:"";let o=document.getElementById("modelLimitHint");o&&(o.textContent=tt(d,t.value)),await qe(s),ue(t.value?e("已选 {m}，上限已带入并保存",{m:t.value}):e("已改回自动选模型"))}function St(){let t=W(),s=V(t.provider),n=s.id==="custom",l={free:e("免费额度"),cheapest:e("最便宜"),cheap:e("便宜"),mid:e("中等")};return`<form id="aiSettingsForm" class="panel">
    <p class="muted" style="margin:0 0 10px;font-size:13px">${e("key 只保存在这台设备的浏览器里，不进仓库也不进数据库；浏览器直连模型，家人各自填自己的。没填 key 时菜单助手会改成“复制提示词”模式，照样能用。")}</p>
    <div class="form-grid">
      <label>${e("模型服务")}<select name="provider">${ve.map(d=>`<option value="${d.id}" ${d.id===t.provider?"selected":""}>${a(e(d.name))}${l[d.cost]?` · ${l[d.cost]}`:""}</option>`).join("")}</select>
        <small>${a(e(s.hint||""))}${s.signup?` <a href="${s.signup}" target="_blank" rel="noopener noreferrer">${e("去申请 key")}</a>`:""}</small></label>
      <label>${e("API key")}<input name="key" type="password" autocomplete="off" maxlength="300" value="${a(t.key)}" placeholder="${a(s.keyPrefix?`${[].concat(s.keyPrefix)[0]}…`:"sk-…")}">
        <small>${a(e(s.keyHint||"在服务商控制台创建 API key，整段粘贴到这里"))}</small></label>
      <label>${e("家庭人数（菜单份量）")}<input name="people" type="number" inputmode="numeric" min="1" max="20" value="${t.people||4}"></label>
    </div>
    ${n?"":`<p class="hint">${e("模型名和接口地址已内置（{model}），一般不用改；要换模型再展开下面的“高级”。",{model:ge(t,s).model})}${t.model||t.base?` <button type="button" class="btn btn-sm btn-ghost" data-action="ai-clear-adv">${e("清掉手填的模型名 / 地址")}</button>`:""}</p>`}
    <details class="adv" ${n?"open":""}><summary>${n?e("接口地址、模型与鉴权（自定义必填）"):e("高级：换模型 / 自定义接口地址")}</summary>
      <div class="form-grid" style="margin-top:8px">
        ${kt(t,s)}
        <label>${e("接口地址（自定义时填）")}<input name="base" maxlength="200" placeholder="${a(s.base||"https://…/v1")}" value="${a(t.base)}"><small>${e("要填真正的 API 域名（到 /v1 为止），不是官网；401 多半是 key 和地址不配")}</small></label>
        <label>${e("鉴权头（自定义时）")}<select name="auth">${Object.entries(Ee).map(([d,c])=>`<option value="${d}" ${(t.auth||"bearer")===d?"selected":""}>${e(c)}</option>`).join("")}</select></label>
      </div>
    </details>
    ${Fe(t,s)}
    <div class="form-actions" style="margin-top:10px"><button type="submit" class="btn btn-primary btn-sm">${e("保存")}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="ai-test">${e("测试连接")}</button><span id="aiTestOut" class="muted"></span></div>
    <p class="hint">${e("性价比：DeepSeek、通义千问 qwen-turbo、豆包 lite 一次菜单约几分钱；Gemini Flash 有免费额度。只用于生成菜单，不会上传备注等个人信息。")}</p>
  </form>`}function cs(){let t=D.mode==="cloud",s="Notification"in window?Notification.permission:"unsupported",n=r.route?.q?.get("sec"),l=ne.find(o=>o.id===n);if(!l){let o={family:t?e("{name} · {n} 位成员",{name:r.household?.name||"",n:r.members.length}):e("本地演示：数据只保存在这个浏览器里"),prefs:`${R[I()||Y()]} · ${e(Units.region.name)} · ${Units.region.currency}`,categories:e("{n} 个分类 · 自建 {m} · 改过 {k}",{n:CATEGORIES.filter(i=>!i.hidden).length,m:CATEGORIES.filter(i=>i.custom).length,k:CATEGORIES.filter(i=>i.overridden).length}),locations:e("{n} 个位置 · 自定义 {m}",{n:window.LOCATIONS.length,m:Re().length}),modules:[r.houseEnabled?e("房屋 ✓"):e("房屋 ✗"),r.billsEnabled?e("账单 ✓"):e("账单 ✗"),r.gearEnabled?e("家居耐用品 ✓"):e("家居耐用品 ✗")].join(" · "),print:r.billsEnabled?e("购物车、账单概览"):e("购物车"),data:s==="granted"?e("通知已开启"):e("通知未开启"),backup:q()?Ge():e("需要财务权限"),usage:t?e("数据库与文件存储，对照免费额度"):e("本地演示：没有云端空间"),ai:fe()?`${e("{p} · 已填 key",{p:e(V(W().provider).name)})}${(()=>{let i=xe();return i.cap?` · ${e("今天 {n}/{cap}",{n:i.used,cap:i.cap})}`:""})()}`:e("未填 key，用“复制提示词”模式"),apps:e("小月亮、家庭学堂；介绍与注意事项")};return`<section class="section menu-page"><div class="section-head"><p>${e("家庭、房产、语言、存放位置、模块、同步与备份、AI、姐妹站点")}</p></div>
      <div class="panel mlist">${ne.map(i=>`<a class="mrow" href="${C("me","settings")}?sec=${i.id}"><span class="mi" aria-hidden="true">${i.icon==="__AI__"?we(24):i.icon}</span><span class="mt"><b>${e(i.name)}</b><small>${a(o[i.id])}</small></span><span class="mch" aria-hidden="true">›</span></a>`).join("")}</div>
      <div class="form-actions" style="margin-top:14px">${t?`<button type="button" class="btn btn-danger-ghost" data-action="logout">${e("退出登录")}</button>`:`<button type="button" class="btn btn-danger-ghost" data-action="reset-demo">${e("恢复演示数据")}</button>`}</div>
    </section>`}let d=(o,i,u,v)=>`<div class="panel"><div class="kv"><div><b>${u}</b><div class="muted">${v}</div></div>
      <label class="switch"><input type="checkbox" id="${o}" ${i?"checked":""}><span>${i?e("已打开"):e("已关闭")}</span></label></div></div>`;return`<section class="section"><div class="settings">${{family:()=>{let o=r.route.q;if(o.get("person"))return oe(o.get("person"));if(o.get("member")){let i=De().find(u=>u.user_id===o.get("member"));return i?.person_id?oe(i.person_id):Me(o.get("member"))}return`
    <div class="panel">
      <div class="kv"><div><b>${a(r.household?.name||"")}</b><div class="muted">${t?e("云端协同：家人修改会实时同步"):e("本地演示：数据只保存在这个浏览器里")}</div></div>
        ${t?`<a class="btn btn-sm btn-ghost" href="${C("me","settings")}?sec=backup">${e("同步与备份")} ›</a>`:""}</div>
      ${t&&r.households.length>1?`<label style="display:grid;gap:4px;margin-top:12px">${e("切换家庭")}<select id="hhSwitch">${r.households.map(i=>`<option value="${i.id}" ${i.id===r.household.id?"selected":""}>${a(i.name)}</option>`).join("")}</select></label>`:""}
    </div>
    ${t?`
    <div class="panel">
      <div class="kv"><div><div class="muted">${e("邀请家人：把这个邀请码发给他们")}</div><div class="code">${a(r.household.invite_code)}</div><div class="muted small">${Ze()}</div></div>
        <div class="head-acts"><button type="button" class="btn btn-sm" data-action="copy-invite">${e("复制邀请码")}</button>
          ${ie()?`<button type="button" class="btn btn-sm btn-ghost" data-action="rotate-invite">${e("重新生成")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="close-invite">${e("关闭邀请")}</button>`:""}</div></div>
      <p class="muted" style="font-size:12px;margin:8px 0 0">${e("家人用邀请码申请加入（不用收邮件），邀请码 7 天有效；申请后要家主在这里批准才能进来。邀请码泄露了或家人都加好了，请家主点「重新生成」或「关闭邀请」，旧码立即失效，已加入的家人不受影响。")}</p>
      ${r.user?.is_anonymous?`<p class="muted" style="font-size:12px;margin:6px 0 0">${e("你是通过邀请码直接进入的，身份保存在本设备浏览器里；清除浏览器数据或换手机后需要重新用邀请码进入。")}</p>`:""}
    </div>`:""}
    ${t?Pe():""}
    ${t?Je():""}
    ${Be()}
    ${t?"":`    <div class="panel config-diag">
      <b>${e("为什么还是本地演示模式")}</b>
      <p>${a(e(r.configIssue||"没有检测到 Supabase 配置。"))}</p>
      <p class="muted" style="margin:0">${e("自查：在浏览器打开 {link}，确认看到的是你填好的地址和 key；改完后等 1–2 分钟，再按 Ctrl+F5（Mac：Cmd+Shift+R）强制刷新。",{link:`<a href="config.js" target="_blank" rel="noopener">${e("本站的 config.js")}</a>`})}</p>
    </div>`}`},prefs:()=>`
    <div class="panel">
      <label class="field-label" for="langSel">${e("语言")}</label>
      <select id="langSel">
        <option value="" ${I()?"":"selected"}>${e("自动（检测为{lang}）",{lang:R[Y()]})}</option>
        ${Object.entries(R).map(([o,i])=>`<option value="${o}" ${I()===o?"selected":""}>${i}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${e("繁體中文由简体自动转换；English 没有翻译到的文案会显示中文。自己起的位置 / 分类 / 小类名字可以在下面填各语言叫法；物品名称不翻译。")}</p>
    </div>
    ${Ue()}
    <div class="panel">
      <label class="field-label" for="regionSel">${e("地区与单位")}</label>
      <select id="regionSel">
        <option value="" ${Units.override?"":"selected"}>${e("自动（检测为{region}{tz}）",{region:a(e(Units.detected().name)),tz:Units.timeZone()?e("，时区 {tz}",{tz:a(Units.timeZone())}):""})}</option>
        ${Object.values(Units.REGIONS).map(o=>`<option value="${o.id}" ${Units.override===o.id?"selected":""}>${e(o.name)}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${e("当前：{units}，货币 {cur}。",{units:Units.region.system==="us"?e("美制单位 lb、oz、fl oz、qt、gal"):e("公制单位 kg、g、斤、L、mL"),cur:Units.region.currency})}
        ${e("已有物品按原单位保存，显示时自动换算；按“个、盒、袋”计数的物品不换算。")}</p>
    </div>
    <div class="panel">
      <label class="field-label" for="dateFmtSel">${e("日期格式")}</label>
      <select id="dateFmtSel" data-nosearch>
        ${ce.map(o=>`<option value="${o}" ${pe()===o?"selected":""}>${a(o==="auto"?e("跟随语言（{ex}）",{ex:H(new Date,!1,"auto")}):H(new Date,!1,o)+({ymd:"  (YYYY-MM-DD)",mdy:"  (MM/DD/YYYY)",dmy:"  (DD/MM/YYYY)",cn:""}[o]||""))}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${e("花费、收入、账单等列表里的日期都按这个显示，按金额 / 名称排序时也看得出年月。只存在这台设备上；导出的 CSV 仍是 YYYY-MM-DD。")}</p>
    </div>
    ${q()?`<div class="panel">
      <label class="field-label" for="moneyModeSel">${e("金额显示")}</label>
      <select id="moneyModeSel" data-nosearch>
        <option value="hide" ${Q()?"selected":""}>${e("遮挡（外出）：大数字模糊，点一个看 10 秒")}</option>
        <option value="show" ${Q()?"":"selected"}>${e("常显示（在家）")}</option>
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${e("今日「钱 · 本月」和财务各页看板上的大数字。也可以在那里点眼睛：单击全部显示 10 秒，双击或长按切换模式。常显示时页面在后台超过 30 分钟，回来自动切回遮挡。只存在这台设备上。")}</p>
    </div>`:""}
    <div class="panel">
      <label class="field-label" for="tempUnitSel">${e("温度单位")}</label>
      <select id="tempUnitSel" data-nosearch>
        ${[["auto",e("跟随地区（现在是 {u}）",{u:Units.region.system==="us"?"°F":"°C"})],["c",e("摄氏 °C")],["f",e("华氏 °F")]].map(([o,i])=>`<option value="${o}" ${je()===o?"selected":""}>${a(i)}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${e("今日页日期旁的天气用这个单位。只存在这台设备上。")}</p>
    </div>
    <div class="panel">
      <label class="field-label" for="pageSizeSel">${e("列表每次显示")}</label>
      <select id="pageSizeSel" data-nosearch>
        ${be.map(o=>`<option value="${o}" ${$e()===o?"selected":""}>${e("{n} 条",{n:o})}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${e("花费、缴费、收入、库存、设备等长列表先显示这么多条，往下点“继续加载”再看更多。只存在这台设备上；没改过时手机 10 条、电脑 20 条。")}</p>
    </div>`,modules:()=>`
    ${d("houseToggle",r.houseEnabled,e("房屋维护模块"),e("关闭后导航和首页只显示日常消耗品，适合租房或不需要的家庭；数据不会删除"))}
    ${d("billsToggle",r.billsEnabled,e("财务模块"),e("水电气、网络、HOA、房产税、房贷、保险等周期账单的提醒与记录；关闭后导航里不再显示，数据不会删除"))}
    ${d("gearToggle",r.gearEnabled,e("家居耐用品模块"),e("床品、电器、自行车、工具等耐用品，只记数量和位置；关闭后储藏里不再显示“家居耐用品”，数据不会删除"))}`,data:()=>`
    <div class="panel"><div class="kv"><div><b>${e("浏览器通知")}</b><div class="muted">${e("打开网页时，若有新的缺货或少货会弹出提醒")}</div></div>
      ${s==="granted"?`<span class="badge b-ok">${e("已开启")}</span>`:s==="unsupported"?`<span class="muted">${e("此浏览器不支持")}</span>`:`<button type="button" class="btn btn-sm" data-action="notif">${e("开启通知")}</button>`}</div></div>
    `,backup:()=>q()?Ne():`<div class="panel"><p style="margin:0">${e("备份里有全家的收入、预算和对账单，只有家主和有财务权限的家人能备份、恢复。数据本身已经实时存在云端。")}</p></div>`,usage:()=>`<p class="muted" style="margin:0 0 10px">${e("看看数据占了 Supabase 免费空间的多少，快满之前会变黄、变红提醒你。")}</p>${We()}`,ai:()=>St(),print:()=>Ie(),locations:()=>ze(),categories:()=>Ce(),apps:()=>`
    ${Xe()}
    <div class="panel"><div class="kv"><div><b>${e("介绍与注意事项")}</b><div class="muted">${e("这个网站是什么、第一次怎么用、提醒怎么分级、哪些事要注意")}</div></div>
      <a class="btn btn-sm" href="${C("me","about")}">${e("查看介绍")}</a></div></div>`}[l.id]()}</div></section>`}export{ds as hydrateModelSelect,tt as limitHint,st as modelNotices,et as modelOptionsHtml,rs as onModelPick,cs as viewSettings};
