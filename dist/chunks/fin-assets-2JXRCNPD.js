import{a as W}from"./chunk-QTUTXNPU.js";import"./chunk-GQOP7HOK.js";import"./chunk-6K3HQIFH.js";import"./chunk-OQ6CCYW6.js";import"./chunk-IV6OIXW6.js";import{g as B}from"./chunk-K4JO6D2R.js";import"./chunk-7X7GUUD6.js";import"./chunk-WK4QF4YM.js";import{$a as V,Ka as U,Nd as K,Zc as F,ab as x,bb as N,cb as P,eb as Y,jd as M,kd as R,r as H,s as T,v as L}from"./chunk-IKY7Z33I.js";import"./chunk-ME7YTUOC.js";import"./chunk-TEBJ3VRR.js";import"./chunk-JKQKEHDY.js";import"./chunk-PUU4H4EW.js";import"./chunk-55QT3SAT.js";import{v as C}from"./chunk-VHWQVX7M.js";import{a as d,f as m}from"./chunk-UVTSSMY7.js";import{C as c,V as _,k as s,t as r,u as I}from"./chunk-7MFRLEF5.js";var h=()=>Units.region.currency,J=()=>{let a=new Date,t=a.getFullYear();return Array.from({length:a.getMonth()+1},(l,o)=>`${t}-${String(o+1).padStart(2,"0")}`)};function Q(){let a=K(J());if(!a)return null;let t={};for(let l of a)l.prop&&l.nat!=="transfer"&&(l.cur||h())===h()&&(t[l.prop]=(t[l.prop]||0)+l.sum);return t}function z(a){let t=d.billsEnriched.filter(l=>l.property_id===a&&l.active&&!l.ended&&(l.currency||h())===h());return{n:t.length,monthly:t.reduce((l,o)=>l+o.monthly,0),escrow:t.reduce((l,o)=>l+o.escrowMonthly,0)}}var X=()=>d.debtsOk?U().filter(a=>a.direction==="payable"&&!C(a.status)):[],D=a=>`<a href="${r(V(a.id))}">${r(a.name)}</a> ${a.balance!=null?`${s("未还 {a}",{a:c(a.balance)})}`:""}${a.bill?` · ${c(a.bill.monthly)}${s("/月")}`:""}${a.link_confirmed===!1?` <span class="badge b-soon">${s("待确认")}</span>`:""}`,p=(a,t)=>t?`<span class="fa-fact"><small>${r(a)}</small>${t}</span>`:"",k=(a,t)=>[a!=null&&a!==""?c(I(a)):"",t?r(_(t)):""].filter(Boolean).join(" · ");function G(a){if(!d.nwOk)return p(s("估值"),'<span class="muted">—</span>');if(!a)return"";let t=a.value==null?`<span class="muted">${s("未估值")}</span>`:`${c(a.value)}${a.source==="purchase"?` <small class="muted">${s("按购入价")}</small>`:""}`;return p(s("市值"),t)+(a.equity!=null?p(s("净值"),`<b class="${a.equity<0?"down":""}">${c(a.equity)}</b>${a.loanBalance?` <small class="muted">${s("贷款 {a}",{a:c(a.loanBalance)})}</small>`:""}`):"")}function Z(a,t,l=[],o=null){let i=window.DEALS.PROPERTY_STATUS,$=window.BILLS.PROPERTY_KINDS,u=z(a.id),b=new Date().getFullYear(),y=t==null?`<span class="muted">${s("读取中…")}</span>`:c(t[a.id]||0),v=(d.medEnriched||[]).filter(f=>f.property_id===a.id),g=v.filter(f=>(f.currency||h())===h()).reduce((f,w)=>f+(w.balance||0),0),S=v.length?`${s("{n} 个一次性账单",{n:v.length})}${g>0?` · ${s("余额 {a}",{a:c(g)})}`:""} · <a href="${B({type:"onetime",asset:`property:${a.id}`})}">${s("查看")}</a>`:"",E=[u.n?`${c(u.monthly)}${s("/月")}${u.escrow?` <small class="muted">${s("+ Escrow {a}",{a:c(u.escrow)})}</small>`:""} · <a href="${B({type:"recurring",asset:`property:${a.id}`})}">${s("{n} 条账单",{n:u.n})}</a>`:"",S].filter(Boolean).join("<br>")||`<span class="muted">${s("没有挂账单")}</span>`;return`<li class="fa-row">
    <div class="fa-head"><b>${r(a.name)}</b><span class="badge">${r(s(i[a.status]||"持有"))}</span><small class="muted">${r(s($[a.kind]||""))}${a.archived?` · ${s("已归档")}`:""}</small>
      <a class="btn btn-sm btn-ghost fa-edit" href="${m("house","overview")}?prop=${encodeURIComponent(a.id)}" aria-label="${r(s("在房屋里打开 {name}",{name:a.name}))}">${s("在房屋里打开")} ›</a></div>
    <div class="fa-facts">
      ${p(s("买入"),k(a.purchase_price,a.acquired_on)||`<span class="muted">${s("未记录")}</span>`)}
      ${a.sold_on||a.sale_price!=null?p(s("卖出"),k(a.sale_price,a.sold_on)):""}
      ${p(s("关联账单"),E)}
      ${l.length?p(s("贷款"),l.map(D).join("<br>")):""}
      ${p(s("{y} 年花费",{y:b}),`${y} · <a href="${m("bills","spend")}?tab=records&prop=${encodeURIComponent(a.id)}&year=${b}">${s("明细")}</a>`)}
      ${G(o)}
    </div>
    ${o?R("property",a,{fallback:o.source==="purchase"?o.value:null}):""}</li>`}function q(a,t,l=null){let o=window.VEHICLES,i=a.vehicle||{},$=o.statusOf(a),u=t.length?t.map(D).join("<br>"):"";return`<li class="fa-row">
    <div class="fa-head"><b>${r(T(a))}</b><span class="badge ${o.STATUS[$]?.cls||""}">${r(s(o.STATUS[$]?.name||$))}</span>
      <a class="btn btn-sm btn-ghost fa-edit" href="${m("asset",a.id)}" aria-label="${r(s("打开车辆 {name}",{name:T(a)}))}">${s("打开车辆")} ›</a></div>
    <div class="fa-facts">
      ${p(s("买入"),k(a.purchase_price,a.installed_on)||`<span class="muted">${s("未记录")}</span>`)}
      ${i.disposed_on||i.sale_price!=null?p($==="returned"?s("归还"):s("卖出"),k(i.sale_price,i.disposed_on)):""}
      ${$==="financed"||$==="leased"||i.loan_end?p($==="leased"?s("租约到期"):s("贷款到期"),i.loan_end?r(_(i.loan_end)):`<span class="muted">${s("未填")}</span>`):""}
      ${p(s("车贷"),u)}
      ${G(l)}
    </div>
    ${l?R("vehicle",a):""}</li>`}function ms(){let a=d.properties.filter(n=>!n.archived||n.purchase_price!=null||n.sale_price!=null),t=Q(),l=L().filter(H),o=X(),i=d.nwOk?F():null,$=(n,e)=>i?.equity.find(A=>A.kind===n&&A.item.id===e)||null,u=l.map(n=>q(n,o.filter(e=>e.asset_id===n.id),$("vehicle",n.id))),b=o.filter(n=>n.category==="auto_loan"&&!n.asset_id),y=d.cards.filter(n=>x.includes(n.kind)&&n.active!==!1),v=d.cards.filter(n=>n.kind==="credit"&&n.active!==!1),g=n=>i?.accounts.find(e=>e.card.id===n)||null,S=n=>{let e=g(n.id);return i?e?.viaDebt?s("余额按借贷里的贷款算"):!e||e.missing?s("余额：未记录"):`${n.kind==="credit"||n.kind==="loan"?s("欠款"):s("余额")} ${c(e.balance)} · ${_(e.as_of)}${e.stale?` · ${s("需要更新")}`:""}`:s("余额：执行 059 后可记")},O=a.filter(n=>!["sold","moved_out","looking"].includes(n.status)&&!n.archived).length,E=l.filter(n=>window.VEHICLES.isActive(n)&&window.VEHICLES.statusOf(n)!=="looking").length,f=a.reduce((n,e)=>n+z(e.id).monthly,0),w=[...x,"credit"].flatMap(n=>[...y,...v].filter(e=>e.kind===n).map(e=>`<li class="fa-acct"><a class="mrow" href="${r(Y(e.id))}">
      <span class="mi" aria-hidden="true">${P(n)}</span>
      <span class="mt"><b>${r(e.name)}${e.last4?` ··${r(e.last4)}`:""}</b><small>${r([N(n),e.issuer].filter(Boolean).join(" · "))} · ${r(S(e))}</small></span>
      <span class="mch" aria-hidden="true">›</span></a>${g(e.id)?.viaDebt?"":M(e)}</li>`)),j=i?i.assets.cash+i.assets.investments+i.assets.retirement+i.assets.hsa:null;return`<section class="section fin-assets">
    <p class="muted" style="margin:-6px 0 12px;font-size:13px">${s("房产、车辆和账户的钱的那一面；改资料回到原来的地方（房屋 / 车辆 / 卡与账户），这里只读")}</p>
    <div class="kpis">
      ${d.houseEnabled?`<a class="kpi" href="${m("house")}">`:'<div class="kpi">'}<span>${s("持有的房产")}</span><b>${O}</b><small>${s("共 {n} 套有记录",{n:a.length})}${d.houseEnabled?" ›":""}</small>${d.houseEnabled?"</a>":"</div>"}
      <a class="kpi" href="${m("house")}"><span>${s("在用的车辆")}</span><b>${E}</b><small>${s("共 {n} 辆有记录",{n:l.length})} ›</small></a>
      <a class="kpi" href="${m("bills","cards")}"><span>${s("账户")}</span><b>${y.length}</b><small>${j==null?s("余额：执行 059 后可记"):s("余额合计 {a}",{a:c(j)})} ›</small></a>
      ${i?`<a class="kpi" href="${m("bills","networth")}"><span>${s("净资产")}</span><b class="${i.netWorth<0?"down":""}">${c(i.netWorth)}</b><small>${s("资产 − 负债")} ›</small></a>`:""}
      <div class="kpi"><span>${s("房产账单每月")}</span><b>${c(f)}</b><small>${s("自己交的部分，不含 Escrow 代缴")}</small></div>
    </div>
    <div class="section-head"><h2>🏠 ${s("房产")}</h2>${d.houseEnabled?`<a class="btn btn-sm btn-ghost" href="${m("house")}">${s("房产列表")}</a>`:""}</div>
    <div class="panel">${a.length?`<ul class="fa-list">${a.map(n=>Z(n,t,o.filter(e=>e.property_id===n.id),$("property",n.id))).join("")}</ul>`:`<div class="empty"><strong>${s("还没有房产")}</strong></div>`}</div>
    <p class="hint">${s("买入 / 卖出价在交易交割时写入（房屋 → 交易）；花费按记账时选的房产统计，账单缴费自动带上账单的房产。")}</p>
    <div class="section-head" style="margin-top:18px"><h2>🚗 ${s("车辆")}</h2><a class="btn btn-sm btn-ghost" href="${m("house")}">${s("管理车辆")}</a></div>
    <div class="panel">${u.length?`<ul class="fa-list">${u.join("")}</ul>`:`<div class="empty"><strong>${s("还没有车辆")}</strong></div>`}
      ${b.length?`<p class="muted" style="margin:10px 4px 4px;font-size:13px">${s("还没关联车辆的车贷（在贷款详情里选车）：")} ${b.map(D).join(" · ")}</p>`:""}</div>
    ${W()}
    <div class="section-head" style="margin-top:18px"><h2>🏦 ${s("账户与余额")}</h2><a class="btn btn-sm btn-ghost" href="${m("bills","cards")}">${s("卡与账户")}</a></div>
    ${w.length?`<ul class="fa-accts panel">${w.join("")}</ul>`:`<div class="panel empty"><strong>${s("还没有登记账户")}</strong>${s("在 卡与账户 里添加支票、储蓄、券商、退休、HSA、贷款或现金账户。")}</div>`}
  </section>`}export{ms as viewFinAssets};
