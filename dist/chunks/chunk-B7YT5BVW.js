import{A as w,E as k,b as d,c as u,d as g,m as f,x as y,z as v}from"./chunk-MHSLMDCJ.js";import{Ja as $}from"./chunk-VMLJQYLE.js";import{a as r,f as h}from"./chunk-DZDSB6EA.js";import{_ as m,d as b,k as t,t as o}from"./chunk-FTWC6REB.js";var j=["低糖高蛋白，六人份","用掉快过期的食材","先做掉放得最久的食材","哺乳期追奶：多汤水、高蛋白","产后恢复：温补、补铁、易消化","孩子爱吃、少油少盐","30 分钟能做完的晚餐","一周三餐的购物车"],M=[["豆包","https://www.doubao.com/"],["通义千问","https://www.tongyi.com/"],["Kimi","https://www.kimi.com/"],["ChatGPT","https://chatgpt.com/"],["Gemini","https://gemini.google.com/"]];function _(){let s=r.ai||(r.ai={ask:"",busy:!1,result:null,error:null,raw:null}),n=f(),i=u(),a=d(i.provider),e=n?v(i):null,l=!!e&&!e.ok,p=j.map(c=>`<button type="button" class="chip" data-action="ai-ask" data-ask="${o(t(c))}">${o(t(c))}</button>`).join(""),x=n?l?w(e):`${t("{p} · 会把库存食材、临期和饮食模式一起发给模型",{p:t(a.name)})}${e.cap?` · ${t("今天还剩 {n} 次免费",{n:e.remaining})}`:""}`:t("没填 key 也能用：生成提示词，复制到豆包 / 千问 / ChatGPT");return`<section class="section ai-panel">
    <div class="section-head"><h2>${k(26)} ${t("AI 菜单助手")}</h2><p class="${l?"form-error":""}">${o(x)}</p></div>
    <form id="aiForm" class="panel">
      <div class="chips" style="margin-bottom:8px">${p}</div>
      <div class="ai-row">
        <input name="ask" maxlength="300" placeholder="${t("想吃什么、几个人、有什么要求…")}" value="${o(s.ask)}" aria-label="${t("菜单需求")}">
        <label class="ai-people">${t("人数")}<input name="people" type="number" inputmode="numeric" min="1" max="20" value="${i.people||4}"></label>
      </div>
      <div class="form-actions" style="margin-top:8px">
        ${n&&!l?`<button type="submit" class="btn btn-primary" ${s.busy?"disabled":""}>${s.busy?t("生成中…"):t("生成今日菜单")}</button>`:""}
        <button type="button" class="btn ${n&&!l?"btn-ghost":"btn-primary"}" data-action="ai-copy">${t("复制提示词")}</button>
        ${M.slice(0,b==="en"?5:3).map(([c,S])=>`<a class="btn btn-sm btn-ghost" href="${S}" target="_blank" rel="noopener noreferrer">${t("打开{n}",{n:t(c)})}</a>`).join("")}
        <a class="btn btn-sm btn-ghost" href="${h("me","settings")}?sec=ai">${n?t("换模型"):t("填 API key 直接出结果")}</a>
      </div>
      ${s.error?`<p class="form-error" role="alert">${o(s.error)}</p>`:""}
    </form>
    ${s.result?A(s.result):s.raw?`<div class="panel"><p class="muted" style="margin:0 0 6px">${t("模型没有按格式返回，原文如下：")}</p><pre class="ai-raw">${o(s.raw)}</pre></div>`:""}
  </section>`}function A(s){let n=[...new Set(s.meals.flatMap(i=>i.dishes.flatMap(a=>a.missing)))];return`<div class="panel ai-result">
    ${s.title?`<h3>${o(s.title)}</h3>`:""}
    <div class="plan">${s.meals.map(i=>`<div class="slot"><h3>${o(i.name)}</h3>${i.dishes.map(a=>`<div class="dish">${o(a.name)}
      <small>${a.uses.length?`<span class="have">${t("用库存：{list}",{list:o(a.uses.join("、"))})}</span>`:""}${a.missing.length?` <span class="miss">${t("缺：{list}",{list:o(a.missing.join("、"))})}</span>`:""}${a.note?`<br>${o(a.note)}`:""}</small></div>`).join("")}</div>`).join("")}</div>
    ${s.tips?`<p class="muted" style="margin:10px 0 0;font-size:13px">💡 ${o(s.tips)}</p>`:""}
    <div class="form-actions" style="margin-top:10px">
      ${n.length?`<button type="button" class="btn btn-sm" data-action="ai-add-missing">${t("缺的 {n} 样加入购物车",{n:n.length})}</button>`:""}
      <button type="button" class="btn btn-sm btn-ghost" data-action="ai-again">${t("换一版")}</button>
    </div>
    <p class="disclaimer">${t("由 AI 生成，分量和做法请自行把握；过敏、慢病饮食以医生建议为准。")}</p>
  </div>`}async function q(s){let n=r.ai,i=s.elements.ask.value.trim(),a=+s.elements.people.value||4,e=u();if(e.people!==a){e.people=a;try{localStorage.setItem("hmh-ai",JSON.stringify(e))}catch{}}Object.assign(n,{ask:i,busy:!0,error:null});try{let{text:l,menu:p}=await y(i,{people:a});Object.assign(n,{result:p,raw:p?null:l,busy:!1}),p&&m(t("菜单已生成"))}catch(l){Object.assign(n,{busy:!1,error:l.message})}}async function K(s){let n=s?.elements.ask.value.trim()||r.ai?.ask||"",i=+s?.elements.people.value||u().people||4,a=g(n,{people:i});try{await navigator.clipboard.writeText(a),m(t("提示词已复制，去豆包 / 千问 / ChatGPT 粘贴即可"))}catch{window.prompt(t("复制下面的提示词"),a)}}async function Q(){let s=r.ai?.result;if(!s)return;let n=[...new Set(s.meals.flatMap(e=>e.dishes.flatMap(l=>l.missing)))],i=new Set(r.shopping.filter(e=>e.status!=="bought").map(e=>e.name.trim().toLowerCase())),a=0;for(let e of n)i.has(e.toLowerCase())||(await $.saveShopping({name:e,quantity:1,unit:"",item_id:null,category:"fresh"}),a++);m(a?t("已加入 {n} 样到购物车",{n:a}):t("都已经在购物车里了"))}export{_ as a,q as b,K as c,Q as d};
