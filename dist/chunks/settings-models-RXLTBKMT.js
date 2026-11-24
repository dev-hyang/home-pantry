import{e as Be,f as oe}from"./chunk-BEWGCB4J.js";import"./chunk-SBDEPK7H.js";import{a as Ne,b as Ge}from"./chunk-VFIY2LAK.js";import{B as Ie,J as F,K as B,L as ae,N as se,O as Ue,R as Ce,U as qe,X as ze,Y as f,Z as j,_ as ne}from"./chunk-6TVBSOJ2.js";import"./chunk-VDYUS3IK.js";import"./chunk-MIBLVZUI.js";import"./chunk-N47BNCVZ.js";import"./chunk-JIO6KTWV.js";import{b as Fe}from"./chunk-IR2BDE2W.js";import"./chunk-ZSZML32Q.js";import"./chunk-74DL6255.js";import"./chunk-VYRLEEFH.js";import"./chunk-57T55XAN.js";import{la as Le,ma as Oe,na as Re,oa as te,pa as Te,qa as Ae}from"./chunk-7TUFFMRJ.js";import"./chunk-7GCOW65V.js";import"./chunk-4LVF3QIA.js";import"./chunk-KMCQFRIS.js";import"./chunk-HRQ7JXCM.js";import{b as je}from"./chunk-XZZVW4PO.js";import{a as be,b as $e}from"./chunk-KHI3VGYC.js";import"./chunk-PFAOQ5UO.js";import"./chunk-HXMYHWGE.js";import"./chunk-FYY65ISI.js";import{c as Q}from"./chunk-KWPA4ID4.js";import"./chunk-2P7NKX3K.js";import"./chunk-XBJBYWLX.js";import{a as ve,c as ge,h as fe,u as Pe}from"./chunk-CSJACS6Q.js";import"./chunk-L6DYA3SC.js";import"./chunk-DQIRS54T.js";import"./chunk-I5AKBPEG.js";import"./chunk-FPJMLZE2.js";import"./chunk-VGG566Y7.js";import"./chunk-AKCVIRG6.js";import"./chunk-7CIM2CQP.js";import"./chunk-LFYQBCKE.js";import"./chunk-JCWY22KU.js";import"./chunk-P4VODXI5.js";import{a as q}from"./chunk-S3PLTJCZ.js";import"./chunk-RR3SE5EV.js";import{D as ee,E as De,F as Me,a as he,b as W,c as Z,k as ye,m as ke,n as z,o as Se,p as xe,q as we,s as J,t as X,u as Ee,z as _e}from"./chunk-OW3LC6FT.js";import"./chunk-M4QFWMDI.js";import{Ja as V,Ka as _}from"./chunk-LEAJVSXF.js";import"./chunk-TZBLDSUG.js";import{a as r,f as C}from"./chunk-CZVMPAK5.js";import{Q as ce,R as pe,T as H,U as me,V as K,Y as U,_ as ue,b as A,c as Y,e as I,k as e,t as s}from"./chunk-DDYZ6EAU.js";var mt=()=>window.dispatchEvent(new Event("hmh-rerender")),ut=t=>t&&t.message==="NEED_GESTURE"?e("Google 登录过期了（授权只管一小时）"):t&&t.message||e("读取失败");function bt(){let t=r.backupUi;if(t&&!t.stale)return t;r.backupUi={...t||{},stale:!1,loading:!0};let a=ne();return Promise.all([qe().catch(()=>({supported:!1,perm:"none",name:""})),ze().catch(()=>({name:""})),...a.map(o=>j[o].list().then(l=>({r:l}),l=>({e:l})))]).then(([o,l,...n])=>{let c={...r.backupUi.lists||{}},i={};a.forEach((d,u)=>{n[u].e?i[d]=ut(n[u].e):c[d]=n[u].r}),r.backupUi={...r.backupUi,folder:o,sql:l,lists:c,errs:i,loading:!1,stale:!1},mt()}),r.backupUi}var N=t=>t?new Date(t).toLocaleString(void 0,{dateStyle:"medium",timeStyle:"short"}):"",$t=t=>t>1048576?`${(t/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(t/1024))} KB`,G=(t,a,o,l,n,c="",i=!1)=>`<label class="bk-card ${a&&!i?"on":""} ${i?"off":""}"><input type="checkbox" name="target" value="${t}" ${a?"checked":""} ${i?"disabled":""}><span class="bk-ic" aria-hidden="true">${o}</span><span class="bk-body"><b>${l}</b><small>${n}</small>${c?`<span class="bk-sub">${c}</span>`:""}</span></label>`;function Ye(){let t=ae(),a=bt(),o=_.mode==="cloud",l=a.folder||{supported:Ce(),perm:"none",name:""},n=a.sql||{name:""},c=p=>t.targets.includes(p),i=Ue(t),d=B.find(p=>p.id===t.provider)||B[0],u=`<select name="provider" aria-label="${s(e("云盘"))}">${B.map(p=>`<option value="${p.id}" ${p.id===d.id?"selected":""}>${s(e(p.name))}</option>`).join("")}</select>`,v=l.supported?`<span class="bk-row">${u}${l.name?`<span class="bk-pill ok">📁 ${s(l.name)}${l.perm!=="granted"?` · ${e("待授权")}`:""}</span>`:""}</span>
       <span class="bk-row">${l.name?`${l.perm!=="granted"?`<button type="button" class="btn btn-sm" data-action="backup-grant">${e("授权这台电脑写入")}</button>`:""}<button type="button" class="btn btn-sm btn-ghost" data-action="backup-pick-folder">${e("换文件夹")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-forget-folder">${e("不再用")}</button>`:`<button type="button" class="btn btn-sm" data-action="backup-pick-folder">${e("选同步文件夹")}</button>`}</span>
       <em>${s(e(d.hint))}</em>`:`<em class="bk-warn">${e("这个浏览器不能直接写文件夹（手机、iPad 和 Safari 都不行）。手机上用「下载到设备」，再在系统的分享 / 文件里存到 iCloud Drive 或 Google Drive。")}</em>`,R=`<span class="bk-row">${n.name?`<span class="bk-pill ok">📁 ${s(n.name)}</span><button type="button" class="btn btn-sm btn-ghost" data-action="backup-forget-sql">${e("不再用")}</button>`:l.supported?`<button type="button" class="btn btn-sm" data-action="backup-pick-sql">${e("选 supabase 文件夹")}</button>`:""}</span>`,T=t.last?e("上次备份 {d}",{d:N(t.last)}):e("还没备份过"),M=se(t)?i&&i.getTime()<=Date.now()?e("已到期，下次打开应用时自动备份"):e("下次 {d}",{d:N(i?.toISOString())}):e("没开定时"),h=ne(),x="";if(h.length){r.backupSrc=h.includes(r.backupSrc)?r.backupSrc:h[0];let p=r.backupSrc,b=(a.lists||{})[p]||[],w=j[p],E=m=>`<li><div class="grow"><span class="name">${s(m.name)}</span><small>${s(N(m.at))} · ${$t(m.size)}</small></div>
        <button type="button" class="btn btn-sm btn-ghost" data-action="backup-dl" data-src="${p}" data-id="${s(m.id||m.name)}" data-name="${s(m.name)}">${e("下载")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-use" data-src="${p}" data-id="${s(m.id||m.name)}">${e("恢复")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-rm" data-src="${p}" data-id="${s(m.id||m.name)}" data-name="${s(m.name)}" aria-label="${s(e("删除"))}">✕</button></li>`,y=b.slice(0,3),P=b.slice(3,30);x=`<div class="panel bk-panel"><h3>${e("备份记录")}</h3>${h.length>1?`<div class="chips bk-srcs">${h.map(m=>`<button type="button" class="chip" data-action="backup-src" data-src="${m}" aria-pressed="${m===p}">${j[m].icon} ${e(j[m].label)}</button>`).join("")}</div>`:`<p class="muted">${w.icon} ${e(w.label)}</p>`}
      ${a.errs?.[p]?`<p class="bk-err">⚠️ ${s(a.errs[p])} <button type="button" class="btn btn-sm" data-action="backup-relist" data-src="${p}">${e("重新授权并刷新")}</button></p>`:""}${a.loading&&!b.length?`<p class="muted">${e("读取中…")}</p>`:b.length?`<ul class="restock-list">${y.map(E).join("")}</ul>${P.length?`<details class="bk-more"><summary>${e("更早的 {n} 条",{n:P.length})}</summary><ul class="restock-list">${P.map(E).join("")}</ul></details>`:""}`:`<p class="muted" style="margin:0">${e("这里还没有备份。上面勾上它，再点「现在备份」。")}</p>`}</div>`}let ot=e("需要先在 config.js 里填好（见 README「云盘备份」）"),de=(p,b,w,E,y,P,m,ct,pt,re)=>G(p,c(p),b,w,E?e("放在你 {d} 里指定的文件夹，手机电脑都能用；只留 {n} 天",{d:w,n:F}):ot,E?(p==="gdrive"&&t.gdId?`<span class="bk-row"><span class="bk-pill ok">📁 ${s(t.gdName||e("已选的文件夹"))}</span><button type="button" class="btn btn-sm btn-ghost" data-action="backup-gd-clear">${e("改用路径")}</button></span>`:`<span class="bk-row bk-path"><label class="muted">${m}</label><input name="${P}" value="${s(ct||"")}" placeholder="${s(pt)}" maxlength="120" autocomplete="off"></span>${p==="gdrive"?`<small class="bk-hint">${e("只能用应用自己建的文件夹；想用你在 Drive 里已有的文件夹，请点下面的「或在 Drive 里选一个文件夹…」。")}</small>`:""}${p==="gdrive"&&y&&f.gdPickerAvailable()?`<span class="bk-row"><button type="button" class="btn btn-sm btn-ghost" data-action="backup-gd-pick">${e("或在 Drive 里选一个文件夹…")}</button></span>`:""}`)+`<span class="bk-row">${y?`<span class="bk-pill ok">${e("已连接")}${y.email?` ${s(y.email)}`:""}${re?` · ${s(re)}`:""}</span><button type="button" class="btn btn-sm btn-ghost" data-action="backup-${p==="gdrive"?"gd":"dbx"}-off">${e("断开")}</button>`:`<button type="button" class="btn btn-sm" data-action="backup-${p==="gdrive"?"gd":"dbx"}-on">${e("连接 {d}",{d:w})}</button>`}</span>`:"",!E||!y),g=r.backupPreview,lt=g?g.ok?`<div class="notice" role="status"><b>${e("备份来自 {h}，{d}，共 {n} 行",{h:s(g.household||e("未知家庭")),d:N(g.exported_at),n:g.rows})}</b>
      <div class="muted" style="font-size:12.5px;margin:4px 0">${Object.entries(g.counts).map(([p,b])=>`${s(p)} ${b}`).join(" · ")}</div>
      ${g.sameHousehold?"":`<p class="muted" style="margin:4px 0;font-size:12.5px">${e("这是另一个家庭 id 的备份（换了项目或重建过家庭时正常）：会导进现在这个家庭。")}</p>`}
      <p style="margin:6px 0 0;font-size:13px">${e("恢复 = 把文件里的数据导回当前家庭：只补缺的，已有同 id 的行不动，也不删任何行。导出者的记录归到现在登录的你。")}</p>
      <div class="bk-row" style="margin-top:8px"><button type="button" class="btn btn-primary btn-sm" data-action="backup-restore-confirm">${e("恢复到当前家庭")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="backup-restore-cancel">${e("取消")}</button></div></div>`:`<div class="notice" role="alert"><b>${e("不能恢复：{why}",{why:s(g.why)})}</b> <button type="button" class="btn btn-sm btn-ghost" data-action="backup-restore-cancel">${e("关闭")}</button></div>`:"",it=r.backupResult?`<div class="notice ${r.backupResult.ok===!1?"bad":""}" role="status"><b>${s(r.backupResult.title)}</b>${r.backupResult.detail?`<div class="muted" style="font-size:12.5px;margin-top:4px">${s(r.backupResult.detail)}</div>`:""}</div>`:"",dt=o&&r.household?.name||"",rt=`<div class="panel synccard ${o?U.err?"bad":"ok":"off"}"><span class="sdot" aria-hidden="true"></span>
    <div class="stext"><b id="syncBadge" class="syncb ${U.err?"err":""}" role="status">${o?s(U.text||e("已同步")):e("保存在这个浏览器")}</b><small>${o?`${s(dt)}${r.members?.length?` · ${e("{n} 位成员",{n:r.members.length})}`:""}`:e("本地演示：数据只在这个浏览器里，更要备份")}</small></div>
    ${o?`<button type="button" class="btn" data-action="reload">${e("立即同步")}</button>`:""}</div>`;return`<h2 class="bk-h">${e("同步")}</h2>${rt}
    <h2 class="bk-h">${e("备份")}</h2>
    ${r.backupPending?`<div class="notice" role="status"><b>${e("定时备份在等你点一下")}</b> ${e("写入这台电脑的文件夹需要你授权一次。")} <button type="button" class="btn btn-sm" data-action="backup-continue">${e("继续备份")}</button></div>`:""}
    ${it}
    <div class="panel bk-panel"><div class="bk-status bk-statushead"><div><b>${s(T)}</b><small>${t.lastInfo?`${s(t.lastInfo)} · `:""}${s(M)}</small></div>
      <div class="bk-row"><button type="button" class="btn btn-primary" data-action="backup-now">${e("现在备份")}</button><button type="button" class="btn btn-ghost" data-action="backup-download">${e("下载一份")}</button></div></div>
    <form id="backupForm" onsubmit="return false">
      <div class="bk-sched"><label>${e("多久备份一次")} <select name="every" aria-label="${s(e("多久备份一次"))}">${[["off","不自动备份"],["week","每周"],["month","每月"],["custom","自定义（天）"]].map(([p,b])=>`<option value="${p}" ${t.every===p?"selected":""}>${e(b)}</option>`).join("")}</select></label>
        <label data-backup-days ${t.every==="custom"?"":"hidden"}>${e("每隔几天")} <input name="days" type="number" min="1" max="365" inputmode="numeric" value="${t.days}" aria-label="${s(e("每隔几天"))}"> ${e("天")}</label></div>
      <p class="muted">${e("网页关着时跑不了：到期后下次打开应用时自动备份一次。")}</p>
      <h3>${e("备份到哪")} <small class="muted">${e("可多选")}</small></h3>
      <div class="bk-cards">
        ${G("folder",c("folder"),"☁️",e("云盘同步文件夹"),e("Google Drive / Dropbox / OneDrive / iCloud Drive 的电脑客户端都有一个同步文件夹，选它就等于备份上了那家云盘；也可以选电脑上任何位置。只留 {n} 天。",{n:F}),v)}
        ${o?G("cloud",c("cloud"),"🗄️",e("应用自己的云端"),e("这个家庭在 Supabase 里的存储，全家任何设备都能恢复；只留 {n} 天；需要先执行迁移 037。",{n:F})):""}
        ${de("gdrive","▲","Google Drive",f.gdConfigured(),f.tok("gd"),"gdPath",e("Drive 里的文件夹路径"),t.gdPath,"爱家小助手备份",f.gdOn()?f.gdPathText():"")}
        ${de("dropbox","◆","Dropbox",f.dbxConfigured(),f.tok("dbx"),"dbxPath",e("应用文件夹里的子路径"),t.dbxPath,e("留空 = 直接放应用文件夹"),"")}
        ${G("download",c("download"),"⬇️",e("下载到设备"),e("每次弹出下载。手机上下载后可以「存储到文件」放进 iCloud Drive / Google Drive；浏览器下载的旧文件不会自动清理。"))}
      </div>
      <div class="bk-sql"><b>⚠️ ${e("数据库脚本不在备份里")}</b><small>${e("supabase/schema.sql 和 migrations 只在你的电脑上（不进 git）。电脑没了，备份文件就导不回去。请把这个文件夹手动拷到云盘或别的位置；选了云盘同步文件夹的话，可以让每次备份顺带把 .sql 一起拷进去：")}</small>${R}</div>
    </form></div>
    ${x}
    <div class="panel bk-panel"><h3>${e("从备份恢复")}</h3><p class="muted">${e("换了手机、数据库被删、或换了 Supabase 项目：先登录并建好家庭（新项目要先在 SQL Editor 执行 supabase/schema.sql），再选备份文件导回来。")}</p>
      <div class="bk-row"><label class="btn btn-sm">${e("选备份文件")}<input id="backupFile" type="file" accept="application/json,.json" hidden></label></div>
      ${lt}</div>
    <details class="ref-panel panel"><summary><b>${e("数据库没了怎么重建")}</b><span class="mch" aria-hidden="true">›</span></summary><div class="ref-body"><ol class="small" style="margin:0;padding-left:18px">
      <li>${e("新建 Supabase 项目（或在原项目里），SQL Editor 执行 supabase/schema.sql（完整建表，含所有迁移；再执行 037_backups.sql 建备份桶）。")}</li>
      <li>${e("把新项目的 URL 和 anon key 填进 config.js，重新部署。")}</li>
      <li>${e("每位家人重新注册登录；家主创建家庭，其他人用邀请码加入。")}</li>
      <li>${e("家主在这里「选备份文件」导入最近一份备份（应用云端里的备份跟着旧项目一起没了，所以云盘 / 下载的那份才是保险）。")}</li>
      <li>${e("家人各自的收入只能由本人登录后再填一次（收入按登录账号存，新账号对不上）。")}</li></ol></div></details>`}var He=()=>{let t=ae();return`${se(t)?t.every==="week"?e("每周"):t.every==="month"?e("每月"):e("每 {n} 天",{n:t.days}):e("没开定时")} · ${t.last?e("上次 {d}",{d:me(t.last.slice(0,10))}):e("还没备份过")}`};var k=1048576,vt="044_usage.sql",L={name:"Free",db:500*k,storage:1024*k},gt=.7,ft=.9,Ke="",ht={media:"睡前歌曲",backups:"云端备份"},$=null,D=null,le=0,S=null;function O(t){return t=+t||0,t>=1024*k?(t/(1024*k)).toFixed(2)+" GB":t>=k?(t/k).toFixed(t>=100*k?0:1)+" MB":Math.round(t/1024)+" KB"}var yt=t=>t>=ft?"full":t>=gt?"warn":"ok",kt=t=>!!t&&/storage_usage|PGRST202|schema cache|does not exist/i.test(`${t.code||""} ${t.message||""}`);function We(t=!1){if(S)return S;if(!t&&$&&Date.now()-le<6e4)return Promise.resolve($);let a=V.sb;return a?(S=(async()=>{try{let{data:o,error:l}=await a.rpc("storage_usage");if(l)throw l;$=o,le=Date.now(),D=null}catch(o){D=o}return S=null,Ve(),$})(),Ve(),S):Promise.resolve(null)}function Qe(t,a,o,l,n,c){let i=n?l/n:0,d=yt(i),u=Math.min(100,Math.round(i*100)),v=d==="full"?e("🚨 快满了：再传可能失败，也会挤占备份。先删掉不用的，或升级套餐。"):d==="warn"?e("⚠️ 已经用了一大半，别再大量上传，先清理不用的。"):e("✅ 空间还很宽裕。");return`<div class="usage-row ${d}">
    <div class="usage-top"><b>${t} ${s(a)}</b><span class="usage-num">${e("{used} / {cap} · {p}%",{used:O(l),cap:O(n),p:u})}</span></div>
    <div class="usage-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${u}" aria-label="${s(a)} ${u}%"><i style="width:${l>0?Math.max(u,2):0}%"></i></div>
    <p class="usage-note"><span class="muted">${s(o)}</span><br>${v}${c||""}</p>
  </div>`}function Ze(){if(_.mode!=="cloud"||!V.sb)return`<p class="muted usage-small">${e("登录并进入家庭后，这里会显示用量。")}</p>`;if(D&&!$){let l=kt(D)?e("还没执行迁移 {n}（用量查询），先在 Supabase 里执行 supabase/migrations/{n}",{n:vt}):e("查询失败：{msg}",{msg:D.message||"error"});return`<p class="usage-small">${s(l)}</p><div class="btns" style="margin-top:8px"><button class="btn btn-sm" data-usage-refresh>${e("重试")}</button></div>`}if(!$)return`<p class="muted usage-small" aria-live="polite">${e("正在查看用量…")}</p>`;let a=(Array.isArray($.buckets)?$.buckets:[]).filter(l=>+l.bytes>0).map(l=>`${s(e(ht[l.name]||l.name))} ${O(l.bytes)}`),o=a.length?`<br><span class="muted">${e("其中：")}${a.join(" · ")}</span>`:"";return`${Qe("🗄️",e("数据库"),e("记录、任务、日志这些文字数据"),+$.db_bytes,L.db)}
  ${Qe("📦",e("文件存储"),e("上传的文件和云端备份"),+$.storage_bytes,L.storage,o)}
  <div class="usage-foot"><span class="muted usage-small">${e("更新于 {time}",{time:new Date(le).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})})}${D?" · "+e("刚才刷新失败，显示的是上次的数字"):""}</span>
    <button class="btn btn-sm" data-usage-refresh ${S?"disabled":""}>${S?e("刷新中…"):e("刷新")}</button></div>
  <p class="muted usage-small">${e("{plan} 套餐上限：数据库 {db}、文件存储 {st}（以 Supabase 控制台为准）。{shared}",{plan:L.name,db:O(L.db),st:O(L.storage),shared:Ke?e(Ke):""})}</p>`}function Ve(){document.querySelectorAll("[data-usage]").forEach(t=>{t.innerHTML=Ze()})}function Je(){return setTimeout(()=>We(),0),`<div class="panel usage" data-usage>${Ze()}</div>`}document.addEventListener("click",t=>{t.target.closest("[data-usage-refresh]")&&We(!0)});var ie=()=>ge(),Xe=()=>{let t=r.household?.invite_expires_at;if(!t)return"";let a=new Date(t).getTime()-Date.now();return a<=0?`<b style="color:var(--out)">${e("邀请码已过期")}</b>`:e("有效期至 {d}（还有 {n} 天）",{d:K(t),n:Math.max(1,Math.ceil(a/864e5))})};function et(){let t=r.pendingMembers||[];if(!ie()||!t.length)return"";let a=(r.people||[]).filter(n=>(n.kind||"adult")==="adult"),o=a.map(n=>`<option value="${s(n.id)}">${s(n.name)}</option>`).join(""),l=n=>`<li class="pend-row"><div class="grow"><b>${s(n.display_name)}</b>${n.joined_at?`<small class="muted">${e("{d} 申请",{d:K(n.joined_at)})}</small>`:""}${n.join_note?`<small class="muted">💬 ${s(n.join_note)}</small>`:""}${n.finance_requested_at?`<small><span class="badge">💰 ${e("想要财务权限")}</span></small>`:""}
      <div class="pend-opts"><label>${e("他是名册里的谁")}<select data-appr-person="${n.user_id}"><option value="">${e("稍后再关联")}</option>${o}</select></label><label class="check-inline"><input type="checkbox" data-appr-fin="${n.user_id}" ${n.finance_requested_at?"checked":""}><span>${e("同时开财务权限")}</span></label></div></div>
      <span class="head-acts"><button type="button" class="btn btn-sm btn-primary" data-action="member-approve" data-id="${n.user_id}">${e("批准")}</button><button type="button" class="btn btn-sm btn-danger-ghost" data-action="member-reject" data-id="${n.user_id}">${e("拒绝")}</button></span></li>`;return`<div class="panel pend-panel"><h3 style="font-size:15px;margin:0 0 6px">${e("等你批准（{n}）",{n:t.length})}</h3>
    <p class="muted small" style="margin:0 0 8px">${e("认识这个人再批准：批准后对方能看到家里的数据（对账单、收入、预算除外，要另外开财务权限）。不认识就拒绝，并重新生成邀请码。")}</p>
    <ul class="member-list">${t.map(l).join("")}</ul></div>`}function tt(){let t=window.SISTER_APPS||[];return t.length<2?"":`<div class="panel">
    <div class="kv"><div><b>${e("姐妹站点")}</b><div class="muted">${e("同一作者的其他小工具；顶栏站名旁的「‹」「›」小胶囊也能切换")}</div></div></div>
    <ul class="app-list">${t.map(a=>`<li class="${a.id==="home-pantry"?"current":""}">
      <span class="app-ico" aria-hidden="true">${a.icon}</span>
      <div class="grow"><b>${s(e(a.name))}</b><small>${s(e(a.sub))}</small></div>
      ${a.id==="home-pantry"?`<span class="badge b-ok">${e("当前")}</span>`:`<a class="btn btn-sm" href="${s(a.url)}">${e("打开")}</a>`}</li>`).join("")}</ul>
  </div>`}var St=(t,a,o)=>{let l=a.rpm?` · ${e("{a}/分 · {b}/天",{a:a.rpm,b:a.rpd})}`:a.live?` · ${e("上限以控制台为准")}`:"";return`<option value="${s(a.id)}" ${a.id===o?"selected":""} ${a.dead?"disabled":""}>${s(e(a.name))}${a.name!==a.id?` (${s(a.id)})`:""}${l}${a.dead?`（${e("这个 key 已不可用")}）`:""}</option>`},at=(t,a,o,l)=>`<option value="">${e("自动：按这个 key 能用的模型自动选（推荐）")}</option>${a.map(n=>St(t,n,l?"":o)).join("")}${o&&!l&&!a.some(n=>n.id===o)?`<option value="${s(o)}" selected>${s(o)}</option>`:""}<option value="__custom" ${l?"selected":""}>${e("其他（手填模型名）…")}</option>`;function st(t,a){if(!a)return e("自动：按可用列表从新到旧试，某个模型超限或下线会自动换下一个。上限用下面的默认值。");let o=J(t,a);return o?.rpm?e("免费档公布值：每分钟 {a} 次、每天 {b} 次，已带入下面的上限（会变，以控制台为准）。它超限或下线时仍会自动换别的模型。",{a:o.rpm,b:o.rpd}):e("这个模型的免费上限目录里没有：下面的上限留空用默认值，或按控制台 Rate limits 页手填。")}function xt(t,a){if(!z[a.id])return`<label>${e("模型名（留空用默认）")}<input name="model" maxlength="80" placeholder="${s(ee(a.id)||a.model)}" value="${s(t.model)}"></label>`;let o=t.model||"",l=z[a.id].filter(c=>c.free!==!1).map(c=>({...c,live:!1})),n=!!o&&!l.some(c=>c.id===o)&&ee(a.id)!==o;return`<label class="span-2">${e("模型")}<select name="modelSel" data-provider="${a.id}">${at(a.id,l,o,n)}</select>
      <small id="modelLimitHint">${st(a.id,n?"":o)}</small></label>
    <div class="span-2 model-refresh"><button type="button" class="btn btn-sm btn-ghost" id="modelRefreshBtn" data-action="ai-models-refresh">↻ ${e("刷新模型列表")}</button><small id="modelListNote" class="muted">${e("正在查这个 key 实际能用的模型…")}</small></div>
    <div class="span-2" id="modelNotices">${nt(a.id,o,null)}</div>
    <label class="span-2" id="modelCustomWrap" ${n?"":"hidden"}>${e("模型名（照服务商控制台里的写）")}<input name="model" maxlength="80" placeholder="${s(a.model)}" value="${s(o)}"></label>`}function nt(t,a,o){let l=xe(),n=[],c={rpd:e("每天"),rpm:e("每分钟")};for(let d of we(t))d.type==="limit"?n.push(`⚠️ ${e("Google 返回的 {m} {f}上限是 {n} 次，目录里是 {w}，已按实际的更新。",{m:s(d.model),f:c[d.field],n:d.now,w:d.was??e("没有")})}`):n.push(`🔔 ${e("这个 key 的模型列表有变化：")}${d.added?.length?` ${e("新增")} ${d.added.map(s).join("、")}`:""}${d.removed?.length?` ${e("下线")} ${d.removed.map(s).join("、")}`:""}`);a&&o&&!o.some(d=>d.id===a&&d.live)&&n.push(`⚠️ ${e("你选的 {m} 已不在这个 key 的可用列表里，会自动换别的模型；建议改选“自动”或另一个。",{m:s(a)})}`);let i=z[t]?e("免费上限目录更新于 {d}（{n} 天前）",{d:Se,n:l})+(l>45?`，${e("可能已过期，上限以控制台为准")}`:""):"";return`${n.length?`<div class="notice-box" role="status">${n.map(d=>`<p>${d}</p>`).join("")}<button type="button" class="btn btn-sm btn-ghost" data-action="ai-notice-dismiss" data-provider="${t}">${e("知道了")}</button></div>`:""}
    ${i?`<p class="muted" style="margin:6px 0 0;font-size:12.5px">${i}</p>`:""}`}async function pa({refresh:t=!1}={}){let a=document.querySelector("#aiSettingsForm [name=modelSel]");if(!a)return!1;let o=a.dataset.provider,l=document.getElementById("modelRefreshBtn"),n=X(o);l&&(l.disabled=!0);let c;try{c=await Ee(o,{refresh:t})}finally{l&&(l.disabled=!1)}let i=document.querySelector("#aiSettingsForm [name=modelSel]");if(!i||i.dataset.provider!==o)return!1;let d=c.filter(x=>x.free!==!1),u=i.value==="__custom",v=i.form.elements.model.value.trim();i.innerHTML=at(o,d,v,u);let R=document.getElementById("modelNotices");R&&(R.innerHTML=nt(o,v,c));let T=document.getElementById("modelListNote"),M=X(o),h=M?new Date(M).toLocaleString(void 0,{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}):"";return T&&(T.textContent=c.some(x=>x.live)?e("列表是这个 key 实际能用的模型（每天自动查一次，也可手动刷新；上次 {when}）；灰色的是已对这个 key 下线的。",{when:h}):e("还没查到实际列表（填好 key 并保存后会查），先列常用的。")),M>n}async function ma(t){let a=t.form,o=document.getElementById("modelCustomWrap"),l=t.value==="__custom",n=t.dataset.provider;if(o.hidden=!l,l){a.elements.model.value="",a.elements.model.focus();return}a.elements.model.value=t.value;let c=J(n,t.value);a.elements.rpm.value=c?.rpm?c.rpm:"",a.elements.rpd.value=c?.rpd?c.rpd:"";let i=document.getElementById("modelLimitHint");i&&(i.textContent=st(n,t.value)),await Te(a),ue(t.value?e("已选 {m}，上限已带入并保存",{m:t.value}):e("已改回自动选模型"))}function wt(){let t=Z(),a=W(t.provider),o=a.id==="custom",l={free:e("免费额度"),cheapest:e("最便宜"),cheap:e("便宜"),mid:e("中等")};return`<form id="aiSettingsForm" class="panel">
    <p class="muted" style="margin:0 0 10px;font-size:13px">${e("key 只保存在这台设备的浏览器里，不进仓库也不进数据库；浏览器直连模型，家人各自填自己的。没填 key 时菜单助手会改成“复制提示词”模式，照样能用。")}</p>
    <div class="form-grid">
      <label>${e("模型服务")}<select name="provider">${he.map(n=>`<option value="${n.id}" ${n.id===t.provider?"selected":""}>${s(e(n.name))}${l[n.cost]?` · ${l[n.cost]}`:""}</option>`).join("")}</select>
        <small>${s(e(a.hint||""))}${a.signup?` <a href="${a.signup}" target="_blank" rel="noopener noreferrer">${e("去申请 key")}</a>`:""}</small></label>
      <label>${e("API key")}<input name="key" type="password" autocomplete="off" maxlength="300" value="${s(t.key)}" placeholder="${s(a.keyPrefix?`${[].concat(a.keyPrefix)[0]}…`:"sk-…")}">
        <small>${s(e(a.keyHint||"在服务商控制台创建 API key，整段粘贴到这里"))}</small></label>
      <label>${e("家庭人数（菜单份量）")}<input name="people" type="number" inputmode="numeric" min="1" max="20" value="${t.people||4}"></label>
    </div>
    ${o?"":`<p class="hint">${e("模型名和接口地址已内置（{model}），一般不用改；要换模型再展开下面的“高级”。",{model:ye(t,a).model})}${t.model||t.base?` <button type="button" class="btn btn-sm btn-ghost" data-action="ai-clear-adv">${e("清掉手填的模型名 / 地址")}</button>`:""}</p>`}
    <details class="adv" ${o?"open":""}><summary>${o?e("接口地址、模型与鉴权（自定义必填）"):e("高级：换模型 / 自定义接口地址")}</summary>
      <div class="form-grid" style="margin-top:8px">
        ${xt(t,a)}
        <label>${e("接口地址（自定义时填）")}<input name="base" maxlength="200" placeholder="${s(a.base||"https://…/v1")}" value="${s(t.base)}"><small>${e("要填真正的 API 域名（到 /v1 为止），不是官网；401 多半是 key 和地址不配")}</small></label>
        <label>${e("鉴权头（自定义时）")}<select name="auth">${Object.entries(Me).map(([n,c])=>`<option value="${n}" ${(t.auth||"bearer")===n?"selected":""}>${e(c)}</option>`).join("")}</select></label>
      </div>
    </details>
    ${Ae(t,a)}
    <div class="form-actions" style="margin-top:10px"><button type="submit" class="btn btn-primary btn-sm">${e("保存")}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="ai-test">${e("测试连接")}</button><span id="aiTestOut" class="muted"></span></div>
    <p class="hint">${e("性价比：DeepSeek、通义千问 qwen-turbo、豆包 lite 一次菜单约几分钱；Gemini Flash 有免费额度。只用于生成菜单，不会上传备注等个人信息。")}</p>
  </form>`}function ua(){let t=_.mode==="cloud",a="Notification"in window?Notification.permission:"unsupported",o=r.route?.q?.get("sec"),l=te.find(i=>i.id===o);if(!l){let i={family:t?e("{name} · {n} 位成员",{name:r.household?.name||"",n:r.members.length}):e("本地演示：数据只保存在这个浏览器里"),prefs:`${A[I()||Y()]} · ${e(Units.region.name)} · ${Units.region.currency}`,categories:e("{n} 个分类 · 自建 {m} · 改过 {k}",{n:CATEGORIES.filter(d=>!d.hidden).length,m:CATEGORIES.filter(d=>d.custom).length,k:CATEGORIES.filter(d=>d.overridden).length}),locations:e("{n} 个位置 · 自定义 {m}",{n:window.LOCATIONS.length,m:je().length}),modules:[r.houseEnabled?e("房屋 ✓"):e("房屋 ✗"),r.billsEnabled?e("账单 ✓"):e("账单 ✗"),r.gearEnabled?e("家居耐用品 ✓"):e("家居耐用品 ✗")].join(" · "),print:r.billsEnabled?e("购物车、账单概览"):e("购物车"),data:a==="granted"?e("通知已开启"):e("通知未开启"),backup:q()?He():e("需要财务权限"),usage:t?e("数据库与文件存储，对照免费额度"):e("本地演示：没有云端空间"),ai:ke()?`${e("{p} · 已填 key",{p:e(W(Z().provider).name)})}${(()=>{let d=_e();return d.cap?` · ${e("今天 {n}/{cap}",{n:d.used,cap:d.cap})}`:""})()}`:e("未填 key，用“复制提示词”模式"),apps:e("小月亮、家庭学堂；介绍与注意事项")};return`<section class="section menu-page"><div class="section-head"><p>${e("家庭、房产、语言、存放位置、模块、同步与备份、AI、姐妹站点")}</p></div>
      <div class="panel mlist">${te.map(d=>`<a class="mrow" href="${C("me","settings")}?sec=${d.id}"><span class="mi" aria-hidden="true">${d.icon==="__AI__"?De(24):d.icon}</span><span class="mt"><b>${e(d.name)}</b><small>${s(i[d.id])}</small></span><span class="mch" aria-hidden="true">›</span></a>`).join("")}</div>
      <div class="form-actions" style="margin-top:14px">${t?`<button type="button" class="btn btn-danger-ghost" data-action="logout">${e("退出登录")}</button>`:`<button type="button" class="btn btn-danger-ghost" data-action="reset-demo">${e("恢复演示数据")}</button>`}</div>
    </section>`}let n=(i,d,u,v)=>`<div class="panel"><div class="kv"><div><b>${u}</b><div class="muted">${v}</div></div>
      <label class="switch"><input type="checkbox" id="${i}" ${d?"checked":""}><span>${d?e("已打开"):e("已关闭")}</span></label></div></div>`;return`<section class="section"><div class="settings">${{family:()=>{let i=r.route.q;if(i.get("person"))return oe(i.get("person"));if(i.get("member")){let d=ve().find(u=>u.user_id===i.get("member"));return d?.person_id?oe(d.person_id):fe(i.get("member"))}return`
    <div class="panel">
      <div class="kv"><div><b>${s(r.household?.name||"")}</b><div class="muted">${t?e("云端协同：家人修改会实时同步"):e("本地演示：数据只保存在这个浏览器里")}</div></div>
        ${t?`<a class="btn btn-sm btn-ghost" href="${C("me","settings")}?sec=backup">${e("同步与备份")} ›</a>`:""}</div>
      ${t&&r.households.length>1?`<label style="display:grid;gap:4px;margin-top:12px">${e("切换家庭")}<select id="hhSwitch">${r.households.map(d=>`<option value="${d.id}" ${d.id===r.household.id?"selected":""}>${s(d.name)}</option>`).join("")}</select></label>`:""}
    </div>
    ${t?`
    <div class="panel">
      <div class="kv"><div><div class="muted">${e("邀请家人：把这个邀请码发给他们")}</div><div class="code">${s(r.household.invite_code)}</div><div class="muted small">${Xe()}</div></div>
        <div class="head-acts"><button type="button" class="btn btn-sm" data-action="copy-invite">${e("复制邀请码")}</button>
          ${ie()?`<button type="button" class="btn btn-sm btn-ghost" data-action="rotate-invite">${e("重新生成")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="close-invite">${e("关闭邀请")}</button>`:""}</div></div>
      <p class="muted" style="font-size:12px;margin:8px 0 0">${e("家人用邀请码申请加入（不用收邮件），邀请码 7 天有效；申请后要家主在这里批准才能进来。邀请码泄露了或家人都加好了，请家主点「重新生成」或「关闭邀请」，旧码立即失效，已加入的家人不受影响。")}</p>
      ${r.user?.is_anonymous?`<p class="muted" style="font-size:12px;margin:6px 0 0">${e("你是通过邀请码直接进入的，身份保存在本设备浏览器里；清除浏览器数据或换手机后需要重新用邀请码进入。")}</p>`:""}
    </div>`:""}
    ${t?Pe():""}
    ${t?et():""}
    ${t?Ge():""}
    ${t?Ne():""}
    ${Be()}
    ${t?"":`    <div class="panel config-diag">
      <b>${e("为什么还是本地演示模式")}</b>
      <p>${s(e(r.configIssue||"没有检测到 Supabase 配置。"))}</p>
      <p class="muted" style="margin:0">${e("自查：在浏览器打开 {link}，确认看到的是你填好的地址和 key；改完后等 1–2 分钟，再按 Ctrl+F5（Mac：Cmd+Shift+R）强制刷新。",{link:`<a href="config.js" target="_blank" rel="noopener">${e("本站的 config.js")}</a>`})}</p>
    </div>`}`},prefs:()=>`
    <div class="panel">
      <label class="field-label" for="langSel">${e("语言")}</label>
      <select id="langSel">
        <option value="" ${I()?"":"selected"}>${e("自动（检测为{lang}）",{lang:A[Y()]})}</option>
        ${Object.entries(A).map(([i,d])=>`<option value="${i}" ${I()===i?"selected":""}>${d}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${e("繁體中文由简体自动转换；English 没有翻译到的文案会显示中文。自己起的位置 / 分类 / 小类名字可以在下面填各语言叫法；物品名称不翻译。")}</p>
    </div>
    ${Le()}
    <div class="panel">
      <label class="field-label" for="regionSel">${e("地区与单位")}</label>
      <select id="regionSel">
        <option value="" ${Units.override?"":"selected"}>${e("自动（检测为{region}{tz}）",{region:s(e(Units.detected().name)),tz:Units.timeZone()?e("，时区 {tz}",{tz:s(Units.timeZone())}):""})}</option>
        ${Object.values(Units.REGIONS).map(i=>`<option value="${i.id}" ${Units.override===i.id?"selected":""}>${e(i.name)}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${e("当前：{units}，货币 {cur}。",{units:Units.region.system==="us"?e("美制单位 lb、oz、fl oz、qt、gal"):e("公制单位 kg、g、斤、L、mL"),cur:Units.region.currency})}
        ${e("已有物品按原单位保存，显示时自动换算；按“个、盒、袋”计数的物品不换算。")}</p>
    </div>
    <div class="panel">
      <label class="field-label" for="dateFmtSel">${e("日期格式")}</label>
      <select id="dateFmtSel" data-nosearch>
        ${ce.map(i=>`<option value="${i}" ${pe()===i?"selected":""}>${s(i==="auto"?e("跟随语言（{ex}）",{ex:H(new Date,!1,"auto")}):H(new Date,!1,i)+({ymd:"  (YYYY-MM-DD)",mdy:"  (MM/DD/YYYY)",dmy:"  (DD/MM/YYYY)",cn:""}[i]||""))}</option>`).join("")}
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
        ${[["auto",e("跟随地区（现在是 {u}）",{u:Units.region.system==="us"?"°F":"°C"})],["c",e("摄氏 °C")],["f",e("华氏 °F")]].map(([i,d])=>`<option value="${i}" ${Ie()===i?"selected":""}>${s(d)}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${e("今日页日期旁的天气用这个单位。只存在这台设备上。")}</p>
    </div>
    <div class="panel">
      <label class="field-label" for="pageSizeSel">${e("列表每次显示")}</label>
      <select id="pageSizeSel" data-nosearch>
        ${be.map(i=>`<option value="${i}" ${$e()===i?"selected":""}>${e("{n} 条",{n:i})}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0;font-size:13px">${e("花费、缴费、收入、库存、设备等长列表先显示这么多条，往下点“继续加载”再看更多。只存在这台设备上；没改过时手机 10 条、电脑 20 条。")}</p>
    </div>`,modules:()=>`
    ${n("houseToggle",r.houseEnabled,e("房屋维护模块"),e("关闭后导航和首页只显示日常消耗品，适合租房或不需要的家庭；数据不会删除"))}
    ${n("billsToggle",r.billsEnabled,e("财务模块"),e("水电气、网络、HOA、房产税、房贷、保险等周期账单的提醒与记录；关闭后导航里不再显示，数据不会删除"))}
    ${n("gearToggle",r.gearEnabled,e("家居耐用品模块"),e("床品、电器、自行车、工具等耐用品，只记数量和位置；关闭后储藏里不再显示“家居耐用品”，数据不会删除"))}`,data:()=>`
    <div class="panel"><div class="kv"><div><b>${e("浏览器通知")}</b><div class="muted">${e("打开网页时，若有新的缺货或少货会弹出提醒")}</div></div>
      ${a==="granted"?`<span class="badge b-ok">${e("已开启")}</span>`:a==="unsupported"?`<span class="muted">${e("此浏览器不支持")}</span>`:`<button type="button" class="btn btn-sm" data-action="notif">${e("开启通知")}</button>`}</div></div>
    `,backup:()=>q()?Ye():`<div class="panel"><p style="margin:0">${e("备份里有全家的收入、预算和对账单，只有家主和有财务权限的家人能备份、恢复。数据本身已经实时存在云端。")}</p></div>`,usage:()=>`<p class="muted" style="margin:0 0 10px">${e("看看数据占了 Supabase 免费空间的多少，快满之前会变黄、变红提醒你。")}</p>${Je()}`,ai:()=>wt(),print:()=>Fe(),locations:()=>Re(),categories:()=>Oe(),apps:()=>`
    ${tt()}
    <div class="panel"><div class="kv"><div><b>${e("介绍与注意事项")}</b><div class="muted">${e("这个网站是什么、第一次怎么用、提醒怎么分级、哪些事要注意")}</div></div>
      <a class="btn btn-sm" href="${C("me","about")}">${e("查看介绍")}</a></div></div>`}[l.id]()}</div></section>`}export{pa as hydrateModelSelect,st as limitHint,nt as modelNotices,at as modelOptionsHtml,ma as onModelPick,ua as viewSettings};
