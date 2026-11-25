import{a as x}from"./chunk-4Y27IIES.js";import{A as w,E as k,b as g,c as u,d as b,m as f,x as y,z as v}from"./chunk-TNRVAN2X.js";import{Ka as h}from"./chunk-QQNIDFRO.js";import{a as r,f as $}from"./chunk-NIZSID7P.js";import{_ as m,d,k as t,t as o}from"./chunk-IRUOA7QV.js";var A=["低糖高蛋白，六人份","用掉快过期的食材","先做掉放得最久的食材","哺乳期追奶：多汤水、高蛋白","产后恢复：温补、补铁、易消化","孩子爱吃、少油少盐","30 分钟能做完的晚餐","一周三餐的购物车"],M=[["豆包","https://www.doubao.com/"],["通义千问","https://www.tongyi.com/"],["Kimi","https://www.kimi.com/"],["ChatGPT","https://chatgpt.com/"],["Gemini","https://gemini.google.com/"]];function q(){let a=r.ai||(r.ai={ask:"",busy:!1,result:null,error:null,raw:null}),i=f(),n=u(),s=g(n.provider),e=i?v(n):null,l=!!e&&!e.ok,p=A.map(c=>`<button type="button" class="chip" data-action="ai-ask" data-ask="${o(t(c))}">${o(t(c))}</button>`).join(""),S=i?l?w(e):`${t("{p} · 会把库存食材、临期和饮食模式一起发给模型",{p:t(s.name)})}${e.cap?` · ${t("今天还剩 {n} 次免费",{n:e.remaining})}`:""}`:t("没填 key 也能用：生成提示词，复制到豆包 / 千问 / ChatGPT");return`<section class="section ai-panel">
    <div class="section-head"><h2>${k(26)} ${t("AI 菜单助手")}</h2><p class="${l?"form-error":""}">${o(S)}</p></div>
    <form id="aiForm" class="panel">
      <div class="chips" style="margin-bottom:8px">${p}</div>
      <div class="ai-row">
        <input name="ask" maxlength="300" placeholder="${t("想吃什么、几个人、有什么要求…")}" value="${o(a.ask)}" aria-label="${t("菜单需求")}">
        <label class="ai-people">${t("人数")}<input name="people" ${x("int",{max:20,min:1,step:null})} value="${n.people||4}"></label>
      </div>
      <div class="ui-acts" style="margin-top:8px">
        ${i&&!l?`<button type="submit" class="ui-btn" data-tone="primary" ${a.busy?"disabled":""}>${a.busy?t("生成中…"):t("生成今日菜单")}</button>`:""}
        <button type="button" class="ui-btn" data-tone="${i&&!l?"ghost":"primary"}" data-action="ai-copy">${t("复制提示词")}</button>
        ${M.slice(0,d==="en"?5:3).map(([c,j])=>`<a class="ui-btn" data-size="sm" data-tone="ghost" href="${j}" target="_blank" rel="noopener noreferrer">${t("打开{n}",{n:t(c)})}</a>`).join("")}
        <a class="ui-btn" data-size="sm" data-tone="ghost" href="${$("me","settings")}?sec=ai">${i?t("换模型"):t("填 API key 直接出结果")}</a>
      </div>
      ${a.error?`<p class="form-error" role="alert">${o(a.error)}</p>`:""}
    </form>
    ${a.result?C(a.result):a.raw?`<div class="panel"><p class="muted" style="margin:0 0 6px">${t("模型没有按格式返回，原文如下：")}</p><pre class="ai-raw">${o(a.raw)}</pre></div>`:""}
  </section>`}function C(a){let i=[...new Set(a.meals.flatMap(n=>n.dishes.flatMap(s=>s.missing)))];return`<div class="panel ai-result">
    ${a.title?`<h3>${o(a.title)}</h3>`:""}
    <div class="plan">${a.meals.map(n=>`<div class="slot"><h3>${o(n.name)}</h3>${n.dishes.map(s=>`<div class="dish">${o(s.name)}
      <small>${s.uses.length?`<span class="have">${t("用库存：{list}",{list:o(s.uses.join("、"))})}</span>`:""}${s.missing.length?` <span class="miss">${t("缺：{list}",{list:o(s.missing.join("、"))})}</span>`:""}${s.note?`<br>${o(s.note)}`:""}</small></div>`).join("")}</div>`).join("")}</div>
    ${a.tips?`<p class="muted" style="margin:10px 0 0;font-size:13px">💡 ${o(a.tips)}</p>`:""}
    <div class="ui-acts" style="margin-top:10px">
      ${i.length?`<button type="button" class="ui-btn" data-size="sm" data-action="ai-add-missing">${t("缺的 {n} 样加入购物车",{n:i.length})}</button>`:""}
      <button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="ai-again">${t("换一版")}</button>
    </div>
    <p class="disclaimer">${t("由 AI 生成，分量和做法请自行把握；过敏、慢病饮食以医生建议为准。")}</p>
  </div>`}async function K(a){let i=r.ai,n=a.elements.ask.value.trim(),s=+a.elements.people.value||4,e=u();if(e.people!==s){e.people=s;try{localStorage.setItem("hmh-ai",JSON.stringify(e))}catch{}}Object.assign(i,{ask:n,busy:!0,error:null});try{let{text:l,menu:p}=await y(n,{people:s});Object.assign(i,{result:p,raw:p?null:l,busy:!1}),p&&m(t("菜单已生成"))}catch(l){Object.assign(i,{busy:!1,error:l.message})}}async function Q(a){let i=a?.elements.ask.value.trim()||r.ai?.ask||"",n=+a?.elements.people.value||u().people||4,s=b(i,{people:n});try{await navigator.clipboard.writeText(s),m(t("提示词已复制，去豆包 / 千问 / ChatGPT 粘贴即可"))}catch{window.prompt(t("复制下面的提示词"),s)}}async function R(){let a=r.ai?.result;if(!a)return;let i=[...new Set(a.meals.flatMap(e=>e.dishes.flatMap(l=>l.missing)))],n=new Set(r.shopping.filter(e=>e.status!=="bought").map(e=>e.name.trim().toLowerCase())),s=0;for(let e of i)n.has(e.toLowerCase())||(await h.saveShopping({name:e,quantity:1,unit:"",item_id:null,category:"fresh"}),s++);m(s?t("已加入 {n} 样到购物车",{n:s}):t("都已经在购物车里了"))}export{q as a,K as b,Q as c,R as d};
