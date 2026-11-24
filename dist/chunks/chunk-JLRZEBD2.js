import{a as d,b,c as f,d as T,e as k}from"./chunk-3DESJQ57.js";import{e as x,o as y,r as B}from"./chunk-F2ZLFLED.js";import{a as c,f as v}from"./chunk-NIZSID7P.js";import{C as h,V as g,k as t,m as _,t as r,u as $}from"./chunk-SRSA6JA7.js";function F(){let o=c.billsEnriched.filter(a=>a.pays.filter(e=>e.amount!=null).length>=2).sort(k);if(!o.length)return"";let l=o.find(a=>a.id===c.billsFilter.trend)||o[0],s=[...l.pays].filter(a=>a.amount!=null).reverse().slice(-12),p=Charts.line({title:t("{name}缴费金额",{name:f(l)}),labels:s.map(a=>g(`${a.paid_on}T12:00:00`)),fmt:a=>h(a),series:[{name:f(l),color:"var(--pine)",values:s.map(a=>$(a.amount))}]});return`<section class="section"><div class="section-head"><h2>${t("缴费趋势")}</h2><p>${t("每次缴费金额的走势，选一条账单看")}</p></div>
    <div class="panel chart-panel"><div class="chart-head"><h3>${t("单账单金额趋势")}</h3>
    <select id="billTrend" aria-label="${t("选择账单")}">${o.map(a=>`<option value="${a.id}" ${a.id===l.id?"selected":""}>${r(T(a))}</option>`).join("")}</select></div>${p}</div></section>`}function w(){return c.houseProfile?.region||(Units.region.system==="us"?"na":"cn")}function I(){let o=w(),l=d().TEMPLATES[o]||[],s=B(),p=new Set(c.bills.filter(e=>!e.ended).map(e=>`${e.property_id||""}|${e.category}|${e.name}`)),a=e=>{let i=e.property===!1?"":s?.id||"";return p.has(`${i}|${e.category}|${e.name}`)||p.has(`${i}|${e.category}|${t(e.name)}`)};return`
    <section class="section">
      <div class="section-head"><p>${t("{region}模板，共 {n} 条；金额和到期日建好后再补",{region:t(o==="na"?"北美":"中国"),n:l.length})}</p></div>
      ${b()}
      <form id="billTemplateForm" class="panel">
        <div class="tpl-bar">
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="1">${t("全选")}</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="0">${t("全不选")}</button>
          <span class="muted">${s?t("与房产相关的账单会挂在“{p}”下；每套房产可以各建一条（到期日可能不同），切换上面的房产再建",{p:r(s.name)}):""}</span>
        </div>
        ${(()=>{let e=[...new Set(l.map(n=>n.group||"常用账单"))],i=(n,m)=>{let u=a(n),P=y(n.category),S=n.due_dates?_(n.due_dates.map(E=>E.replace("-","/"))):n.due_day?t("每月 {d} 号",{d:n.due_day}):t("到期日建后补填");return`<label class="ui-row tpl-row ${u?"is-have":""}" style="--cat:var(--pine)">
            <input type="checkbox" name="tpl" value="${m}" ${u?"disabled":n.optional?"":"checked"}>
            <span class="grow"><b>${P.icon} ${r(t(n.name))}</b>${n.sub_kind?` <span class="badge sub-kind">${t(d().SUB_KINDS[n.sub_kind]||n.sub_kind)}</span>`:""}<small>${[n.payee?r(n.payee):null,t(d().FREQUENCIES[n.frequency])+(n.frequency==="custom"?` (${n.interval_months})`:""),S,n.autopay?t("通常自动扣款"):t("手动缴费"),n.property===!1?t("与房产无关"):null].filter(Boolean).join(" · ")}</small>
              ${n.note?`<small class="note">${r(t(n.note))}</small>`:""}</span>
            ${u?`<span class="badge b-ok">${n.property===!1?t("已有"):t("此房产已有")}</span>`:""}
          </label>`};return e.map(n=>`<fieldset class="tpl-group"><legend>${t(n)}${n==="订阅与会员"?`<span class="muted" style="font-weight:400;font-size:13px"> · ${t("默认不勾，勾了再补金额和到期日；年付到期前 30 天提醒")}</span>`:""}</legend>
            ${l.map((m,u)=>(m.group||"常用账单")===n?i(m,u):"").join("")}</fieldset>`).join("")})()}
        <div class="form-actions" style="margin-top:12px">
          <button type="submit" class="btn btn-primary">${t("建立选中的账单")}</button>
          <a class="btn btn-ghost" href="${v("bills","all")}">${t("稍后再说")}</a>
        </div>
      </form>
    </section>`}function j(o){let l=w(),s=d().TEMPLATES[l]||[],p=Units.region.currency,a=c.propertyId;return o.map(e=>s[e]).filter(Boolean).map(e=>{let i={property_id:e.property===!1?null:a,name:t(e.name),category:e.category,direction:"payable",sub_kind:e.sub_kind||null,trial_ends_on:null,payee:e.payee||null,account_last4:null,login_hint:null,pay_url:null,pay_channel:e.autopay?"autopay":e.channel||"online",amount_type:e.amount_type||"variable",typical_amount:null,currency:p,frequency:e.frequency,interval_months:e.interval_months||null,due_day:e.due_day||null,due_dates:e.due_dates||[],next_due_on:null,grace_days:e.grace_days||0,late_fee_note:null,autopay:!!e.autopay,autopay_method:null,autopay_card_expires:null,statement_channel:e.statement||"email",reminder_days:e.reminder_days||[7,1],assigned_person_id:null,essential:e.essential!==!1&&y(e.category).essential,active:!0,notes:e.note?t(e.note):null};return i.next_due_on=x(i),i})}export{F as a,I as b,j as c};
