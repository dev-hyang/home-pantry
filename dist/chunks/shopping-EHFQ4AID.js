import{a as I,d as w,e as M,f as S,g as m,h as x,i as Z}from"./chunk-XYE3WP5G.js";import{d as U}from"./chunk-WGB3BV5I.js";import"./chunk-VM5LRGUI.js";import{P as R,Q as D}from"./chunk-TKDK6MWE.js";import"./chunk-YIC2WQIH.js";import{A as O,x as y}from"./chunk-QGFWPAXQ.js";import"./chunk-EFC6AQI3.js";import{d as v}from"./chunk-MBCEB5XQ.js";import{b as F}from"./chunk-RG3RGRR5.js";import{Ga as A}from"./chunk-IFW3TOAA.js";import{I as E}from"./chunk-DZP5H5VD.js";import"./chunk-HGWUQHGC.js";import"./chunk-6FXZI5A5.js";import{d as L,h as j}from"./chunk-FR5PHJUP.js";import{a as C,c as N,d as B}from"./chunk-VTDLDXIR.js";import"./chunk-N5J5Q5KS.js";import"./chunk-GOZRGHCE.js";import"./chunk-PTIY56F7.js";import"./chunk-ZLBCJS5B.js";import"./chunk-URJPG7XY.js";import"./chunk-3EP65HAQ.js";import"./chunk-PTWHRSHS.js";import"./chunk-H4GYPJJX.js";import"./chunk-PUPSK6GE.js";import{a as l,f as d}from"./chunk-UVTSSMY7.js";import{A as g,C as f,W as $,Y as T,d as q,k as a,s as u,t as n,u as r,v as _,y as H,z as k}from"./chunk-PZOKEXDK.js";function K(t){let s=m(t),p=H(s),e=Units.step(p),o=_(k(r(t.quantity,1),s));return`<span class="shop-qty" role="group" aria-label="${n(a("{name} 数量",{name:t.name}))}">
    <button type="button" data-action="shop-qty" data-id="${t.id}" data-dir="-1" aria-label="${n(a("{name} 减少 {q} {u}",{name:t.name,q:e,u:a(p)}))}">−</button>
    <input type="number" inputmode="decimal" min="${e}" step="${e}" value="${o}" data-qty-for="${t.id}" aria-label="${n(a("{name} 数量",{name:t.name}))}">
    <input type="text" class="unit-in" list="unitList" maxlength="10" value="${n(a(p))}" data-unit-for="${t.id}" placeholder="${n(a("单位"))}" aria-label="${n(a("{name} 单位",{name:t.name}))}">
    <button type="button" data-action="shop-qty" data-id="${t.id}" data-dir="1" aria-label="${n(a("{name} 增加 {q} {u}",{name:t.name,q:e,u:a(p)}))}">+</button>
  </span>`}var X=[["new","最近加入的在前"],["old","加入最久的在前"],["name","名称 A → Z"],["cat","按分类"]],Y=t=>l.items.find(s=>s.id===t.item_id)?.category||t.category||"other",z=[["open","全部未买"],["todo","尚未认领"],["claimed","已认领"],["mine","我认领的"],["bought","已买到"],["all","全部（含已买到）"]],P=t=>t.claimed_by_name||(w(t)?a("我"):a("家人")),b=t=>d("shopping","list",t&&t!=="open"?`?st=${t}`:"");function tt(){let t=l.shopFilter,s=(o,i,c)=>`<option value="${n(o)}" ${c===o?"selected":""}>${n(i)}</option>`,p=[...new Set(l.shopping.map(Y))],e=o=>l.shopping.filter(M(o)).length;return`<div class="toolbar shop-toolbar">
    <label class="shop-q"><span class="sr-only">${a("搜索购物车")}</span><input type="search" id="shopQ" value="${n(t.q||"")}" placeholder="${n(a("搜索要买的东西"))}" autocomplete="off"></label>
    <select id="shopSt" aria-label="${a("按状态筛选")}">${z.map(([o,i])=>s(o,`${a(i)}${q==="en"?` (${e(o)})`:`（${e(o)}）`}`,t.st)).join("")}</select>
    <select id="shopCat" data-search aria-label="${a("按分类筛选")}">${s("all",a("全部分类"),t.cat)}${p.map(o=>s(o,`${(window.CATEGORIES.find(i=>i.id===o)||OTHER_CAT).icon||""} ${a((window.CATEGORIES.find(i=>i.id===o)||OTHER_CAT).name)}`.trim(),t.cat)).join("")}</select>
    <select id="shopSort" aria-label="${a("排序")}">${X.map(([o,i])=>s(o,a(i),t.sort)).join("")}</select>${B("shop",N(t,C.shop))}</div>`}function Q(){let t=l.shopFilter,s=S(),p=`shop:${t.st}`,e=L(p,JSON.stringify(t)),o=t.q?a("没找到「{q}」。",{q:t.q}):{open:a("没有待买的东西。"),todo:a("都有人认领了。"),claimed:a("点“我来买”认领，家人就不会重复买。"),mine:a("你还没有认领要买的东西。"),bought:a("买到后自动加回库存。"),all:a("购物车是空的。")}[t.st]||"",i=t.st==="bought"||t.st==="all"?l.shopping.some(c=>c.status==="bought"):!1;return`<div class="shop-list-meta" data-n="${s.length}">${i?`<button type="button" class="btn btn-sm btn-ghost" data-action="shop-clear">${a("清空已买到")}</button>`:""}</div>
    ${s.length?`<ul class="shop-list">${s.slice(0,e).map(nt).join("")}</ul>${j(p,s.length,e)}`:`<p class="muted shops-empty">${n(o)}</p>`}`}function _t(){let t=u("#shopListBox");t&&(t.innerHTML=Q()),at()}function at(){let t=u("#shopListBox .shop-list-meta")?.dataset.n,s=u("#shopN");s&&t!=null&&(s.textContent=a("{n} 项",{n:t}))}var st=()=>{let t=l.route?.q?.get("add");return t?[...new Set(t.split("|").map(s=>s.trim().slice(0,60)).filter(Boolean))].slice(0,40):[]};function et(){let t=st();if(!t.length)return"";let s=new Set(l.shopping.filter(e=>e.status!=="bought").map(e=>String(e.name).trim().toLowerCase())),p=l.route.q.get("from")||"";return`<div class="panel shop-import" id="shopImport" role="region" aria-label="${n(a("从别的应用带来的采购项"))}">
    <b>🐑 ${p?a("来自牧羊人 · {n}",{n:p}):a("来自牧羊人")}</b><p class="muted" style="margin:4px 0 8px;font-size:13px">${a("勾选要买的，再点「加进购物车」。已经在清单里的默认不勾。")}</p>
    <div class="shop-import-list">${t.map(e=>{let o=s.has(e.toLowerCase());return`<label class="check-inline"><input type="checkbox" value="${n(e)}" ${o?"":"checked"}><span>${n(e)}${o?` <small class="muted">${a("已在清单里")}</small>`:""}</span></label>`}).join("")}</div>
    <div class="form-actions" style="margin-top:8px"><button type="button" class="btn btn-primary btn-sm" data-action="shop-import">${a("加进购物车")}</button><button type="button" class="btn btn-ghost btn-sm" data-action="shop-import-cancel">${a("不用了")}</button></div></div>`}function nt(t){let s=w(t),p="";t.status==="todo"&&(p=`<button type="button" class="btn btn-sm btn-dark" data-action="shop-claim" data-id="${t.id}">${a("我来买")}</button>
    <button type="button" class="btn btn-sm btn-primary" data-action="shop-bought" data-id="${t.id}">${a("已买到")}</button>`),t.status==="claimed"&&(p=`${s?`<button type="button" class="btn btn-sm btn-ghost" data-action="shop-unclaim" data-id="${t.id}">${a("取消认领")}</button>`:""}
    <button type="button" class="btn btn-sm btn-primary" data-action="shop-bought" data-id="${t.id}">${a("已买到")}</button>`);let e=t.status==="bought"?t.amount!=null?`<div class="muted" style="font-size:12px">${a("花费 {m}",{m:f(r(t.amount))})}</div>`:"":`<div class="price-in">
        <input type="number" min="0" step="0.01" inputmode="decimal" data-price-for="${t.id}" data-keep="price-${t.id}" placeholder="${n(a("花费 {sym}（可不填）",{sym:Units.money(0).replace(/[\d.,\s]/g,"")}))}" aria-label="${n(a("{name} 实际花费",{name:t.name}))}">
        <input type="text" maxlength="40" list="storeList" data-store-for="${t.id}" data-keep="store-${t.id}" placeholder="${a("在哪买（可不填）")}" aria-label="${n(a("{name} 购买商店",{name:t.name}))}">
        ${E("card_id",void 0,`data-card-for="${t.id}" data-keep="card-${t.id}"`)}
      </div>`,o=t.status==="bought"&&t.bought_at?a("{d} 买到",{d:$(t.bought_at)}):t.created_at?a("{d} 加入",{d:$(t.created_at)}):"",i=l.shopSel,c=i?.has(t.id),G=i?` data-row-sel-shop="${t.id}"`:` data-swipe-del="shop"${t.status==="bought"?"":` data-swipe-alt="shop" data-swipe-alt-label="${n(a("已买到"))}" data-swipe-alt-go="${n(a("松手买到"))}"`}`,W=t.category||l.items.find(V=>V.id===t.item_id)?.category,J=t.status==="bought"?e:`<details class="si-spend"><summary>💰 ${a("记一笔花费（可选）")}</summary>${e}</details>`;return`<li class="shop-item ${t.status==="bought"?"done":""}${c?" is-picked":""}"${G}>
    <div class="si-top">${i?`<input type="checkbox" class="shop-chk" data-id="${t.id}" ${c?"checked":""} aria-label="${n(a("选择 {name}",{name:t.name}))}">`:""}<b class="si-name">${n(t.name)}</b>${o?`<small class="si-when muted" title="${n(T(t))}">${o}</small>`:""}
      <button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="shop-del" data-id="${t.id}" aria-label="${n(a("删除 {name}",{name:t.name}))}">${a("删除")}</button>${t.status==="bought"?"":`<button type="button" class="btn btn-sm btn-ghost swipe-alt-src" data-action="shop-bought" data-id="${t.id}" data-confirm="1" aria-label="${n(a("{name} 已买到",{name:t.name}))}">${a("已买到")}</button>`}</div>
    ${t.status==="bought"?"":`<div class="card-hint-slot">${U(W,"")}</div>`}
    ${t.status==="claimed"?`<div class="who">🛍 ${a("{who} 正在买",{who:n(P(t))})}</div>`:""}
    ${t.status==="bought"?t.claimed_by_name?`<div class="who">✅ ${a("{who} 买到的",{who:n(t.claimed_by_name)})}</div>`:"":R(t)}
    ${t.item_id?"":`<div class="muted si-note">${a("未关联库存，买到后需手动入库")}</div>`}
    ${J}
    <div class="si-bottom">${p?`<div class="acts">${p}</div>`:"<span></span>"}<div class="si-qty">${t.status==="bought"?g(r(t.quantity,1),m(t)):K(t)}</div></div>
  </li>`}function ot(){let t=l.shopping.filter(i=>i.status!=="bought"),s=t.filter(i=>i.status==="claimed"),p=Date.now()-30*864e5,e=l.shopping.filter(i=>i.status==="bought"&&Date.parse(i.bought_at||i.created_at||0)>=p),o=new Map;for(let i of s){let c=P(i);o.set(c,(o.get(c)||0)+1)}return{open:t.length,todo:t.length-s.length,claimed:s.length,byWho:o,recent:e.length,spent:e.reduce((i,c)=>i+r(c.amount,0),0),priced:e.some(i=>i.amount!=null)}}var h=(t,s,p,e,o)=>`<a class="panel sd-tile" href="${t}">
  <span class="sd-top"><span class="sd-ico" aria-hidden="true">${s}</span><span class="sd-lbl">${p}</span><span class="mch" aria-hidden="true">›</span></span>
  <span class="sd-big">${e}</span><span class="sd-sub">${o}</span></a>`;function it(){let t=ot(),s=D(),p=[...t.byWho].map(([e,o])=>`${n(e)} ${o}`).join(" · ");return`<section class="section shop-home">
    <div class="section-head"><h2>${a("采购")}</h2></div>
    ${et()}
    <div class="sd-acts" role="group" aria-label="${n(a("录入"))}">
      <div class="sd-grp"><span class="sd-grp-t">${a("买回来了，录入库存")}</span>
        <a class="btn" href="${d("pantry","scan")}">🧾 ${a("拍小票 / 网购订单入库")}</a></div>
    </div>
    ${y()}
    <div class="sd-grid sd-n5">
      ${h(b("open"),"🛒",a("待购买"),`${t.open}<small>${a("项")}</small>`,`<span class="nw">${a("{n} 尚未认领",{n:t.todo})}</span> · <span class="nw">${a("{n} 已认领",{n:t.claimed})}</span>`)}
      ${h(b("claimed"),"🛍",a("家人认领"),`${t.claimed}<small>${a("项")}</small>`,t.claimed?p:a("点“我来买”认领，家人就不会重复买。"))}
      ${h(d("shops","list"),"🏪",a("常去的商店"),s.shops?`${s.shops}<small>${a("家")}</small>`:"—",s.shops?s.due?`<em>${a("{n} 家待更新",{n:s.due})}</em><span class="sd-hitnames">${n(s.dueNames.slice(0,4).join("、"))}${s.due>4?"…":""}</span>`:a("特价都是最新的"):a("放进常去的超市，看本周特价、哪家最便宜"))}
      ${h(s.items?`${d("shops","deals")}?f=list`:d("shops","deals"),"🏷",a("商店特价一览"),s.shops?`${s.items}<small>${a("样清单上的有特价")}</small>`:"—",s.shops?[s.items?`<span class="sd-hitnames">${n(s.itemNames.slice(0,4).join("、"))}${s.items>4?"…":""}</span>`:"",a("{n} 家",{n:s.shops}),a("特价 {n} 项",{n:s.deals}),s.due?`<em>${a("{n} 家待更新",{n:s.due})}</em>`:""].filter(Boolean).map(e=>`<span class="nw">${e}</span>`).join(" · "):a("放进常去的超市，看本周特价、哪家最便宜"))}
      ${h(b("bought"),"✅",a("近 30 天买到"),`${t.recent}<small>${a("项")}</small>`,t.priced?a("花费 {m}",{m:f(t.spent)}):a("买到后自动加回库存。"))}
    </div>
    ${O()}
  </section>`}function lt(){let t=l.route?.q?.get("st");return t&&z.some(([s])=>s===t)&&(l.shopFilter.st=t,l.route.q.delete("st"),history.replaceState(null,"",d("shopping","list"))),`<section class="section shop-list-page">
    ${v([{href:d("shopping"),label:a("采购")},{label:a("购物车"),icon:"🛒"}])}
    <div class="section-head"><h2>${a("购物车")} <span class="muted shop-n" id="shopN">${a("{n} 项",{n:S().length})}</span></h2>
      <div class="head-acts"><button type="button" class="btn btn-sm ${l.shopSel?"btn-primary":"btn-ghost"}" data-action="shop-select" aria-pressed="${!!l.shopSel}">${l.shopSel?a("完成"):`☑ ${a("多选")}`}</button></div></div>
    ${l.shopSel?"":`<p class="muted rs-hint shop-hint"><span class="rs-hint-touch">${a("← 左滑删除 · 右滑标成已买到 →")}</span><span class="rs-hint-mouse">${a("在一项上往左拖删除，往右拖标成已买到；也可以点下面的按钮")}</span></p>`}
    ${tt()}
    ${A()}
    <div id="shopListBox">${Q()}</div>
    ${l.shopSel?"":`<a class="fab" href="${d("shopping","add","?mode=photo")}" aria-label="${n(a("添加要买的东西（默认拍照，可切换手动）"))}" title="${n(a("添加要买的东西"))}"><span aria-hidden="true">＋</span></a>`}
    ${l.shopSel?`<div class="inv-selbar shop-selbar" role="toolbar" aria-label="${n(a("多选操作"))}">
      <span class="inv-seln" aria-live="polite">${n(x())}</span>
      <button type="button" class="btn btn-sm btn-ghost" data-action="shop-sel-all">${a("全选")}</button><span class="spacer"></span>
      <button type="button" class="btn btn-sm btn-danger-ghost" data-action="shop-sel-remove" ${l.shopSel.size?"":"disabled"}>${a("移出购物车")}</button></div>`:""}
  </section>`}function pt(){let t=l.route?.q?.get("mode")==="photo",s=l.shopping.filter(e=>e.status!=="bought").sort((e,o)=>String(o.created_at||"").localeCompare(String(e.created_at||""))).slice(0,5),p=`<form class="panel shop-add-form" id="shopForm" aria-label="${a("手动添加采购项")}">
      <label class="full">${a("要买什么")}<input name="name" required maxlength="60" placeholder="${a("例如：鸡蛋、牛奶、洗洁精")}" list="itemNames" autocomplete="off"></label>
      <label>${a("数量")}<input name="quantity" type="number" min="0.1" step="0.1" value="1" inputmode="decimal"></label>
      <label>${a("单位")}<input name="unit" list="unitList" placeholder="${a("不填自动选")}" maxlength="10"></label>
      <label>${a("分类")}<select name="category"><option value="">${a("自动分类")}</option>${F()}</select></label>
      <label>${a("预估金额")}<input name="estimate" type="number" min="0" step="0.01" inputmode="decimal" placeholder="${a("可不填，用来做预算提示")}"></label>
      <div class="form-actions full"><button class="btn btn-primary" type="submit">${a("加入购物车")}</button><a class="btn btn-ghost" href="${d("shopping")}">${a("完成")}</a></div>
      <p class="muted full shop-add-tip">${a("加完一项可以接着加；库存里有的东西会自动关联，买到后自动入库。")}</p>
    </form>`;return`<section class="section shop-add-page">
    ${v([{href:d("shopping"),label:a("采购")},{label:a("加入购物车"),icon:"＋"}])}
    <nav class="shop-mode" aria-label="${n(a("添加方式"))}">
      <a class="chip" href="${d("shopping","add","?mode=photo")}" ${t?'aria-current="page"':""}>📷 ${a("拍照")}</a>
      <a class="chip" href="${d("shopping","add")}" ${t?"":'aria-current="page"'}>✍️ ${a("手动")}</a>
      <button type="button" class="chip" data-action="shop-add-alerts">🔔 ${a("补货提醒")}</button>
    </nav>
    ${t?I():p}
    <datalist id="itemNames">${l.items.map(e=>`<option value="${n(e.name)}">`).join("")}</datalist>
    ${y()}
    ${s.length?`<div class="panel sd-preview"><div class="section-head"><h3>${a("最近加入")}</h3><a class="btn btn-sm btn-ghost" href="${b("open")}">${a("购物车")} ›</a></div>
      <ul>${s.map(e=>`<li class="sp-row"><span class="sp-txt"><b>${n(e.name)}</b> <small class="muted">${g(r(e.quantity,1),m(e))}${e.created_at?` · ${a("{d} 加入",{d:$(e.created_at)})}`:""}</small></span></li>`).join("")}</ul></div>`:""}
    <a class="panel shops-entry" href="${d("pantry","scan")}"><span aria-hidden="true">🧾</span><span><b>${a("买回来了？拍小票或贴网购订单")}</b><small>${a("这是录入库存、记花费，不是加购物车")}</small></span><span class="mch" aria-hidden="true">›</span></a>
  </section>`}function Ht(){let t=l.route?.section==="shopping"?l.route.sub:"home";return t==="list"?lt():t==="add"?pt():it()}export{st as importNames,_t as renderShopList,x as shopSelText,m as shopUnit,Z as shopVisibleIds,Ht as viewShopping};
