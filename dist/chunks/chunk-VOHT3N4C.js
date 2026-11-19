import{i as $e,j as he}from"./chunk-7XSNPMJO.js";import{a as ye}from"./chunk-SKOSYBWS.js";import{m as ge}from"./chunk-GOEMIFCY.js";import{g as de,h as pe}from"./chunk-LE4H7QIA.js";import{d as ie}from"./chunk-ILCEL4BG.js";import{b as D}from"./chunk-UWLWXIFX.js";import{Ca as re,Da as le,Ea as oe,Ga as ce}from"./chunk-N3MVD6F2.js";import{I as P,L as me}from"./chunk-HDTZUMRG.js";import{f as fe}from"./chunk-XTP3HLUK.js";import{f as ue}from"./chunk-NSEIGV6U.js";import{d as z,e as B}from"./chunk-6RFDYHHI.js";import{s as se}from"./chunk-PIWPZCF3.js";import{a as ee,b as te}from"./chunk-RBR77WZC.js";import{A as j,B as M,C as ne,F as A,Ja as x,z as ae}from"./chunk-COAIKXML.js";import{a as c,c as Z,f as v,i as T}from"./chunk-UVTSSMY7.js";import{$ as H,G as L,H as X,I as f,L as C,M as E,N as Y,O as S,Y as R,k as a,t as l,u as b,v as J,y as Q}from"./chunk-RCRFBWHO.js";function V(e){e&&(c.needsRefresh=!0),c.skipAutosave=!0,c.prevRoute?history.back():T(v(...C(f(c.editingCat||"fresh"))),{replace:!0})}var be=()=>c.assetsEnriched.filter(e=>e.kind!=="vehicle"),N=e=>`${ue(e)}${c.properties.length>1&&e.property_id?` · ${se(e.property_id)}`:""}`;var G=e=>e.join("、");function ve(e){let t=be(),n=new Set(Array.isArray(e.asset_ids)?e.asset_ids:[]),i=t.filter(o=>n.has(o.id)).map(N);return`<div class="span-2 only-house pick-field"><span class="pick-lbl" id="assetLinkLbl">${a("关联设备")}</span>
    ${t.length?`<details class="pick">
      <summary aria-labelledby="assetLinkLbl"><span class="pick-val ${i.length?"":"is-empty"}">${l(i.length?G(i):a("不关联设备"))}</span><b class="pick-n ui-badge" data-shape="count" data-size="lg" data-tone="neutral" data-soft ${i.length?"":"hidden"}>${i.length}</b></summary>
      <div class="pick-panel" role="group" aria-labelledby="assetLinkLbl">
        ${t.length>8?`<input type="search" class="pick-q" placeholder="${a("搜索设备")}" aria-label="${a("搜索设备")}">`:""}
        ${t.map(o=>`<label class="pick-row check-inline"><input type="checkbox" name="asset_ids" value="${l(o.id)}" data-label="${l(N(o))}" ${n.has(o.id)?"checked":""}><span>${o.t?.icon||"⚙️"} ${l(N(o))}</span></label>`).join("")}
      </div></details>
      <small class="muted">${a("可多选；设备页的“相关耗材”会列出它。")}</small>`:`<p class="muted" style="margin:4px 0 0;font-size:13px">${a("还没有设备。先在 房屋 → 设备保养 里添加，就能在这里关联。")}</p>`}</div>`}var Ee=e=>!!e.alert_mute_until&&String(e.alert_mute_until)>S();function _e(e){let t=Ee(e)?e.alert_mute_until===E?"forever":"keep":"",n=(i,o)=>`<option value="${i}" ${t===i?"selected":""}>${o}</option>`;return`<label class="span-2 not-gear remind-only">${a("补货提醒")}
    <select name="alert_mute">
      ${n("",a("正常提醒"))}
      ${t==="keep"?n("keep",a("暂停提醒，到 {d}",{d:l(e.alert_mute_until)})):""}
      ${n("30",a("暂停 30 天"))}${n("90",a("暂停 90 天"))}${n("forever",a("不再提醒"))}
    </select>
    <small>${a("试过不好吃、或暂时用完不想补：选一个，它就不会再出现在注意事项里。临期提醒不受影响。")}</small>
  </label>`}function ke(e,t){return e==="forever"?E:e==="30"||e==="90"?Y(+e):e==="keep"&&t||null}function xe(e,t){if(!e||e.elements.item_id.value||e.dataset.catTouched==="1")return;let n=e.elements.space?.value||"pantry",i=ae(t,n,f);if(!i)return;let[o,r]=i,s=e.elements.category,u=e.elements.subcategory;[...s.options].some(m=>m.value===o)&&(s.value!==o&&(s.value=o,s.dispatchEvent(new Event("change",{bubbles:!0}))),r&&[...u.options].some(m=>m.value===r)&&u.value!==r&&(u.value=r,u.dispatchEvent(new Event("change",{bubbles:!0}))))}async function Se(e,{silent:t=!1}={}){let n=e.elements,i=e.querySelector("#itemFormError"),o=(p,y)=>{if(t)H(a("没有自动保存：{msg}",{msg:p}));else{i.textContent=p;let $=y.closest?.("details");$&&($.open=!0),y.focus()}return!1},r=n.name.value.trim(),s=b(n.quantity.value,NaN);if(!r)return o(a("请填写物品名称。"),n.name);let u=M(r,{exceptId:n.item_id.value||null});if(u)return o(a("已经有「{name}」（{cat}）。是同一样东西就去那件补库存；是另一件就在名字里加上品牌、规格区分。",{name:u.name,cat:a(L(u.category).name)}),n.name);if(!Number.isFinite(s)||s<0)return o(a("数量需要是 0 或正数。"),n.quantity);let m=Units.normalize(n.unit.value)||"个",_=n.orig_unit.value,q=m===n.disp_unit.value&&m!==_,h=c.items.find(p=>p.id===n.item_id.value)||{},k=p=>{let y=n[p];return y.value===""?null:q?y.value===y.dataset.orig&&h[p]!=null?b(h[p]):Math.round(Math.max(0,b(y.value))/Units.factor(_)*1e3)/1e3:Math.max(0,b(y.value))},g=f(n.category.value)==="gear",I=!g&&!!n.remind?.checked,d={id:n.item_id.value||void 0,name:r,category:n.category.value,subcategory:n.subcategory.value||null,unit:q?_:m,quantity:Math.round(k("quantity")*100)/100,min_quantity:I?Math.round((k("min_quantity")||0)*100)/100:0,lead_days:I?Math.min(60,Math.max(0,Math.round(b(n.lead_days.value,3)))):0,location:null,expiry_date:g?null:n.expiry_date.value||null,avg_daily_use:g?null:k("avg_daily_use"),notes:n.notes.value.trim()||null};if(f(d.category)==="house"){let p=[...e.querySelectorAll('input[name="asset_ids"]:checked')].map(y=>y.value);(p.length||h.asset_ids?.length)&&(d.asset_ids=p)}else h.asset_ids?.length&&(d.asset_ids=[]);let F=f(d.category)==="house"&&n.owner?.value||"";d.property_id=F.startsWith("p:")?F.slice(2):null,d.owner_asset_id=F.startsWith("a:")?F.slice(2):null;let K=e.querySelector('button[type="submit"]');K.disabled=!0;try{d.location=await pe(n);let p=await x.saveItem(d);if(n.aliases&&(p||d.id)){let $=p||d.id,O=[...new Set(n.aliases.value.split(/[,，、;；]/).map(w=>w.trim().slice(0,60)).filter(w=>w&&j(w)!==j(d.name)))];O.join("|")!==A($).join("|")&&await x.setItemAliases($,O).then(()=>x.listItemAliases()).then(w=>{c.itemAliases=w||[]}).catch(()=>{})}if(!d.id&&n.sp_amount&&n.sp_amount.value!==""&&b(n.sp_amount.value)>0){let $=re(n.sp_store?.value||""),O=n.sp_date?.value||S();await x.addPurchase({item_id:p||null,name:d.name,category:d.category,quantity:d.quantity||null,unit:d.unit||null,amount:Math.round(b(n.sp_amount.value)*100)/100,currency:Units.region.currency,purchased_at:new Date(`${O}T12:00:00`).toISOString(),store:$,...me(n.sp_card?.value||"")}),$&&oe($)}d.id&&h.cat_check&&await x.clearCatCheck([d.id]).catch(()=>{});let y=d.id||p;if(y&&!I&&!g)(h.alert_mute_until||null)!==E&&await x.setItemMute(y,E).catch(()=>{});else if(d.id&&n.alert_mute&&I){let $=ke(n.alert_mute.value,h.alert_mute_until);($||null)!==(h.alert_mute_until||null)&&(await x.setItemMute(d.id,$),h.alert_mute_until=$)}return t||(H(d.id?a("已保存修改"):a("已添加 {name}",{name:r})),V(!0)),!0}catch(p){if(t)throw p;return i.textContent=/items_household_name_key_uniq/.test(p.message)?a("已经有同名的物品了：换个名字区分（品牌、规格），或去那件补库存。"):a("保存失败：{msg}",{msg:p.message}),K.disabled=!1,!1}}var we={frozen:"冷冻肉禽"};function Le(e,t){t===void 0&&(t=we[e]);let n=L(e).subs||[];return t&&!n.includes(t)?`<option value="${l(t)}" selected>${l(a(t))}</option>`+n.map(i=>`<option value="${l(i)}">${l(a(i))}</option>`).join(""):n.map(i=>`<option value="${l(i)}" ${i===t?"selected":""}>${l(a(i))}</option>`).join("")}function qt(e,{space:t,cat:n}={}){let i=new URLSearchParams;t&&i.set("space",t),n&&i.set("cat",n),T(`${v("item",e||"new")}${i.toString()?`?${i}`:""}`)}var Ie=e=>[{href:v("pantry"),label:a("储藏")},e==="gear"?{href:v("pantry","gear"),label:a("家居耐用品")}:{href:e==="house"?`${v("pantry","inventory")}?space=house`:v("pantry","inventory"),label:e==="house"?`${a("库存")} · ${a("汽车房屋消耗品")}`:a("库存")}],Fe={today:"今日",pantry:"储藏",house:"房屋",gear:"家居耐用品",shopping:"购物车",me:"我的"},qe={pantry:"例如：鸡蛋、抽纸、大米",house:"例如：炉子滤网、电池、融雪盐",gear:"例如：被罩、千斤顶、儿童自行车"},Oe=[["pantry","🥫","日常消耗品","吃的喝的、纸巾洗护、药品、宠物粮：用了会少，要补货"],["house","🧰","汽车房屋消耗品","滤网、电池、灯泡、融雪盐、机油：房子、院子、车定期要换的"],["gear","🛋️","家居耐用品","家具、电器、厨具、衣物、玩具、工具：长期用，只记几件、放在哪"]];function Ce(e){let t=c.enriched.find(n=>n.id===e.id);return`${t&&!Te(e)?$e(t):""}${B(e.id)?he():""}`}var Te=e=>f(e.category)==="gear";function Me(e){let t=!!B(e.id),n=c.enriched.find(o=>o.id===e.id),i=t?a("移出购物车"):a("加入购物车");return`<button type="button" class="btn btn-sm af-cart${t?" is-in":""}" data-action="${t?"shop-remove-item":"shop-add-item"}" data-id="${e.id}" ${n?"":"disabled"} title="${l(i)}" aria-label="${l(`${e.name}：${i}`)}">${t?a("移出购物车"):a("加入购物车")}</button>`}function Ae(e,t){let n=Oe.filter(([r])=>r===e||(r==="house"?c.houseEnabled:r==="gear"?c.gearEnabled:!0)),i=([,r,s,u])=>`<b>${r} ${a(s)}</b><small>${a(u)}</small>`,o=n.find(([r])=>r===e)||n[0];return`<fieldset class="span-2 space-pick"><legend>${a("组别")}</legend>
    <details class="space-dd" ${t?"open":""}><summary class="space-card space-sum" aria-label="${l(a("组别"))}"><span class="space-sum-txt">${i(o)}</span><span class="space-chev" aria-hidden="true">▾</span></summary>
    <div class="space-opts">${n.map(r=>`<label class="space-opt">
    <input type="radio" name="space" value="${r[0]}" ${r[0]===e?"checked":""}><span class="space-card">${i(r)}</span></label>`).join("")}</div></details>
    <p class="muted space-rel">${a("组别 › 大类 › 小类：组别决定东西的性质（日常消耗品、汽车房屋消耗品、家居耐用品）；大类是组别下的分类，例如蔬果、清洁；小类是大类下的细分，例如叶菜。")}</p></fieldset>`}var W=new Map,Ne=(e,t)=>`${e||"new"}:${t}`;function U(e,t,n,i,o,r="",s=""){let u=Ne(e,t),m=W.has(u)?W.get(u):o;return`<details class="fsec ${r}" data-fsec="${l(u)}" ${m?"open":""}><summary><span class="fsec-ttl">${n}</span>${s?`<span class="fsec-aside">${s}</span>`:""}<span class="fsec-chev" aria-hidden="true">▾</span></summary>
    <fieldset><legend class="sr-only">${n}</legend>${i}</fieldset></details>`}typeof document<"u"&&document.addEventListener("toggle",e=>{let t=e.target;t?.matches?.("details.fsec[data-fsec]")&&W.set(t.dataset.fsec,t.open)},!0);function Ue(){return U("","spend",a("花费（选填）"),`
          <p class="muted" style="margin:-6px 0 10px;font-size:13px">${a("填了金额就同时记一笔花费，关联到这件物品；不填就只入库。")}</p>
          <div class="form-grid">
            <label>${a("金额（{cur}）",{cur:Units.region.currency})}<input name="sp_amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></label>
            <label>${a("商店 / 收款方")}<input name="sp_store" maxlength="40" list="storeList" value="${l(le())}"></label>
            <label>${a("日期")}<input name="sp_date" type="date" max="${S()}" value="${S()}"></label>
            ${P("sp_card")?`<label>${a("怎么付的")}${P("sp_card")}</label>`:""}
          </div>
          ${ce()}`,!1,"item-spend")}function Et(){let e=c.route,t=e.id&&e.id!=="new"?c.items.find(g=>g.id===e.id):null;if(e.id!=="new"&&!t)return`<div class="panel empty"><strong>${a("找不到这件物品")}</strong>${a("可能已被家人删除。")}<p><a class="btn btn-primary" href="${v("pantry","inventory")}">${a("回到库存")}</a></p></div>`;let n=e.q.get("space")||c.filter.space||"pantry",i=e.q.get("cat"),o=i&&CATEGORIES.some(g=>g.id===i)?i:c.filter.space===n&&c.filter.cat!=="all"?c.filter.cat:X(n)[0].id,r=!t&&e.q.get("copy")?te(c.items.find(g=>g.id===e.q.get("copy")),["expiry_date","asset_ids","alert_mute_until","cat_check","avg_daily_use","name_key"]):null;r&&(r.name=`${r.name}（2）`.slice(0,60));let s=t||r||{category:o,unit:"个",quantity:1,min_quantity:n==="gear"?0:1,lead_days:n==="house"?14:n==="gear"?0:3,location:L(o).loc};c.editingCat=s.category;let u=f(s.category)==="gear",m={href:c.prevRoute&&c.prevHash?c.prevHash:v(...C(n)),label:c.prevRoute?a(Z[c.prevRoute.section]?.name||"上一页"):a(Fe[n]||"列表")},_=Units.factor(s.unit),q=Q(s.unit),h=t||r?(b(s.min_quantity)>0||b(s.lead_days)>0)&&!(t&&t.alert_mute_until===E):!1,k=g=>g==null||g===""?"":J(b(g)*_);return`
    <section class="section form-page">
      ${ie([...Ie(n),{label:t?a("编辑：{name}",{name:t.name}):r?a("复制：{name}",{name:r.name}):a("添加物品"),icon:L(s.category).icon}])}
      ${ge("item","#itemForm",t?Me(t):"")}
      <form id="itemForm" class="panel ${u?"is-gear":""} ${f(s.category)==="house"?"is-house":""} ${h?"is-remind":""}" novalidate data-autosave>
        <input type="hidden" name="item_id" value="${l(t?.id||"")}">
        <input type="hidden" name="orig_unit" value="${l(s.unit)}">
        <input type="hidden" name="disp_unit" value="${l(Units.normalize(q))}">
        ${U(t?.id,"basic",a("基本信息"),`
          <div class="form-grid">
            <label class="span-2">${a("名称")}
              <input name="name" required maxlength="60" autocomplete="off" placeholder="${a(qe[f(s.category)]||qe.pantry)}" value="${l(s.name||"")}">
              <small class="name-hint" id="itemNameHint" role="status" ${t?"":"data-new"} hidden></small>
            </label>
            <label class="span-2">${a("别名（选填）")}
              <input name="aliases" maxlength="200" autocomplete="off" placeholder="${l(a("同一样东西的其他叫法，用逗号隔开，例如：milk, 牛乳"))}" value="${l(t?A(t.id).join(", "):"")}">
              <small class="muted">${a("录入购物、购物车、记花费写成这些叫法，也会对上这件")}</small>
            </label>
            ${Ae(f(s.category),!t)}
            <label>${a("大类")}
              <select name="category" required data-search>${D(s.category,{withOther:!1,only:f(s.category)})}</select>
            </label>
            <label>${a("小类")}
              <select name="subcategory" data-search>${Le(s.category,s.subcategory)}</select>
            </label>
            ${de(s.location)}
            <label class="not-gear">${a("保质期至")}
              <input name="expiry_date" type="date" value="${l(s.expiry_date||"")}">
            </label>
            ${fe(s,e.q.get("prop")?`p:${e.q.get("prop")}`:e.q.get("veh")?`a:${e.q.get("veh")}`:"")}
            ${ve(s)}
          </div>`,!0,"",t?Ce(t):"")}
        ${U(t?.id,"qty",`<span class="not-gear">${a("数量与提醒")}</span><span class="only-gear">${a("数量")}</span>`,`
          <p class="muted only-gear" style="margin:0 0 10px;font-size:13px">${a("家居耐用品只记数量和位置，不算消耗，也不会提醒补货。需要保养周期或保修的，用下方“升级为设备档案”。")}</p>
          <div class="form-grid">
            <label>${a("当前数量")}
              <input name="quantity" type="number" min="0" step="any" inputmode="decimal" required value="${k(s.quantity??0)}" data-orig="${k(s.quantity??0)}">
            </label>
            <label>${a("单位")}
              ${ye(`name="unit" required ${t||r?"":'data-auto="1"'}`,q||"个")}
              ${q!==s.unit?`<small>${a("原单位 {u}，已按当前地区换算显示",{u:l(s.unit)})}</small>`:""}
            </label>
            <label class="span-2 not-gear remind-toggle check-inline"><input type="checkbox" name="remind" ${h?"checked":""}>
              <span><b>${a("提醒补货")}</b><small class="muted">${a("打开后，少于少货线或快用完时提醒；不打开就不提醒")}</small></span></label>
            <label class="not-gear remind-only">${a("少货线")}
              <input name="min_quantity" type="number" min="0" step="any" inputmode="decimal" value="${k(s.min_quantity??0)}" data-orig="${k(s.min_quantity??0)}">
              <small>${a("数量低于或等于它时提醒“少货”")}</small>
            </label>
            <label class="not-gear remind-only">${a("提前几天提醒")}
              <input name="lead_days" type="number" min="0" max="60" step="1" inputmode="numeric" value="${l(s.lead_days??3)}">
              <small>${a("预计剩余天数低于它时提醒“即将告罄”")}</small>
            </label>
            <label class="span-2 not-gear">${a("每天大约用多少（可选）")}
              <input name="avg_daily_use" type="number" min="0" step="any" inputmode="decimal" placeholder="${a("留空则根据家人的使用记录自动估算")}" value="${k(s.avg_daily_use)}" data-orig="${k(s.avg_daily_use)}">
            </label>
            ${t?_e(s):""}
          </div>`,!0)}
        ${U(t?.id,"notes",a("备注"),`
          <label class="sr-only" for="itemNotes">${a("备注")}</label>
          <textarea id="itemNotes" name="notes" rows="3" maxlength="500" placeholder="${u?a("品牌、型号、尺寸、购买时间、借给了谁…"):a("品牌、规格、在哪买更便宜…")}">${l(s.notes||"")}</textarea>`,!!s.notes)}
        ${t?"":Ue()}
        <p id="itemFormError" class="form-error" role="alert"></p>
        <div class="form-actions sticky-actions">
          <button type="submit" class="btn btn-primary">${t?a("保存修改"):a("添加物品")}</button>
          <button type="button" class="btn btn-ghost" data-action="item-cancel">${a("取消")}</button>
          ${t?`<span class="spacer"></span>${ee([{label:u?a("复制为新家居耐用品"):a("复制为新物品"),href:`${v("item","new")}?copy=${encodeURIComponent(t.id)}&space=${f(t.category)}`},u&&{label:a("升级为设备档案"),href:`#/asset/new?from_item=${encodeURIComponent(t.id)}`},{label:a("删除物品"),action:"item-delete",danger:!0}],{up:!0})}`:""}
        </div>
      </form>
      ${t&&R(t)?`<p class="record-meta">${l(R(t))}${x.mode==="cloud"&&z(t.updated_by)?`（${l(z(t.updated_by))}）`:""}</p>`:""}
    </section>`}document.addEventListener("change",e=>{let t=e.target.closest?.("details.pick");if(!t||!t.querySelector("input[name=asset_ids]"))return;let n=[...t.querySelectorAll("input[name=asset_ids]:checked")].map(r=>r.dataset.label),i=t.querySelector(".pick-val"),o=t.querySelector(".pick-n");i.textContent=n.length?G(n):a("不关联设备"),i.classList.toggle("is-empty",!n.length),o.textContent=n.length,o.hidden=!n.length});document.addEventListener("input",e=>{if(!e.target.classList?.contains("pick-q"))return;let t=e.target.value.trim().toLowerCase();e.target.closest(".pick-panel").querySelectorAll(".pick-row").forEach(n=>{n.hidden=!!t&&!n.textContent.toLowerCase().includes(t)})});document.addEventListener("click",e=>document.querySelectorAll("details.pick[open]").forEach(t=>{t.contains(e.target)||(t.open=!1)}));document.addEventListener("keydown",e=>{e.key==="Escape"&&document.querySelectorAll("details.pick[open]").forEach(t=>{t.open=!1,t.querySelector("summary")?.focus()})});document.addEventListener("input",e=>{if(e.target.name==="unit"&&e.target.closest?.("#itemForm")){delete e.target.dataset.auto;return}if(e.target.name==="space"&&e.target.closest?.("#itemForm")){let m=e.target.form.elements.category;m.innerHTML=D(null,{withOther:!1,only:e.target.value}),m.selectedIndex=0,m.dispatchEvent(new Event("change",{bubbles:!0}));let _=e.target.closest(".space-dd"),q=e.target.nextElementSibling;_&&q&&(_.querySelector(".space-sum-txt").innerHTML=q.innerHTML,_.open=!1);return}if(e.target.name==="remind"&&e.target.closest?.("#itemForm")){let m=e.target.form;m.classList.toggle("is-remind",e.target.checked),e.target.checked&&m.elements.alert_mute?.value==="forever"&&(m.elements.alert_mute.value="");return}if((e.target.name==="category"||e.target.name==="subcategory")&&e.target.closest?.("#itemForm")&&e.isTrusted){e.target.form.dataset.catTouched="1";return}if(e.target.name!=="name"||!e.target.closest?.("#itemForm"))return;xe(e.target.form,e.target.value);let t=document.getElementById("itemNameHint"),n=e.target.form;if(!t||!n)return;let i=n.elements.unit;if(i?.dataset.auto==="1"){let m=Units.guess(e.target.value)||"个";i.tagName==="SELECT"&&![...i.options].some(_=>_.value===m)&&i.insertAdjacentHTML("afterbegin",`<option value="${l(m)}">${l(a(m))}</option>`),i.value=i.tagName==="SELECT"?m:a(m)}let o=n.elements.item_id.value||null,r=M(e.target.value,{exceptId:o}),s=r?[]:ne(e.target.value,{exceptId:o});t.hidden=!r&&!s.length;let u=m=>`<a href="${v("item",m.id)}">${l(m.name)}</a>`;t.innerHTML=r?a("已有同名物品：{link}",{link:u(r)}):s.length?a("相近的已有物品：{list}",{list:s.map(u).join("、")}):""});export{V as a,Se as b,Le as c,qt as d,Oe as e,Et as f};
