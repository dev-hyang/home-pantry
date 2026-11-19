/* 出了问题：事件（文件和下拉由这里自己监听）。 */
import { $, toast } from "../core/util.js";
import { addPart, current, inShop, partLabel } from "./fix-parts.js";
import { aiQuota, aiReady } from "../core/ai.js";
import { answerText, fixPrompt, logFix, runFix } from "./fix-page.js";
import { compressImage } from "../core/autofill-common.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { MAX_IMAGES, fx, repaint, vehQuick } from "./fix-common.js";

/* ── 事件：main.js 把 fix-* 转过来；文件和下拉由这里自己监听 ── */
export async function fixAction(action, el, { refresh, render, go }) {
  const f = fx();
  switch (action) {
    case "fix-quick": {
      const a = current(), item = a ? vehQuick(a)[+el.dataset.i] : null; if (!item) return;
      f.text = t(item.q); f.error = ""; f.result = null; f.added = {}; f.logged = false;
      const q = aiReady() ? aiQuota() : null;
      if (!aiReady() || (q && !q.ok)) { repaint(); return toast(aiReady() ? t("今天的免费额度用完了：问题已填好，可以点“复制提示词”去别的 AI 问") : t("还没填 API key：问题已填好，点“复制提示词”拿去任一 AI 问")); }
      repaint();   // 先把问题写进输入框（runFix 从输入框里读），再问
      const p = runFix(); repaint(); await p; return repaint();
    }
    case "fix-img-del": f.images.splice(+el.dataset.i, 1); return repaint();
    case "fix-reset": Object.assign(f, { text: "", images: [], result: null, raw: "", error: "", added: {}, logged: false }); return repaint();
    case "fix-copy": {
      f.text = ($("#fixText")?.value ?? f.text).trim();
      if (!f.text && !f.images.length) return toast(t("先写一句哪里不对"));
      try { await navigator.clipboard.writeText(fixPrompt().text); toast(t("提示词已复制，打开任一 AI 粘贴即可（照片要自己附上）")); } catch { window.prompt(t("复制下面的提示词"), fixPrompt().text); }
      return;
    }
    case "fix-copy-answer": if (f.result) { try { await navigator.clipboard.writeText(answerText(f.result)); toast(t("已复制")); } catch { /* 忽略 */ } } return;
    case "fix-more": {   // 带着问题和诊断去整页咩咩咩追问
      if (!f.result) return;
      state.aiPage = { ...(state.aiPage || {}), q: `${t("接着上面这个问题：")}${f.text.trim()}\n${t("你之前的回答：")}${answerText(f.result).slice(0, 600)}\n\n${t("我想再问：")}`, answer: null, error: null, withContext: true };
      return go(href("ai"));
    }
    case "fix-part-add": el.disabled = true; await addPart(el.dataset.key); return refresh();
    case "fix-parts-all": {
      const x = f.result?.fixes[+el.dataset.fix]; if (!x) return;
      el.disabled = true;
      for (let j = 0; j < x.parts.length; j++) { const key = `f-${el.dataset.fix}-${j}`; if (!f.added[key] && !inShop(partLabel(x.parts[j]))) await addPart(key); else f.added[key] = true; }
      return refresh();
    }
    case "fix-log": el.disabled = true; await logFix(); return refresh();
    default: return render();
  }
}
document.addEventListener("change", async (e) => {
  if (e.target.id === "fixFile") {
    const f = fx(), files = [...e.target.files].slice(0, MAX_IMAGES - f.images.length); e.target.value = "";
    f.error = "";
    for (const file of files) { try { f.images.push(await compressImage(file, 1280)); } catch { f.error = t("这张图读不了，换一张（JPG / PNG）。"); } }
    f.text = $("#fixText")?.value ?? f.text;
    repaint(); return;
  }
  if (e.target.id === "fixAsset") {
    const f = fx(); f.text = $("#fixText")?.value ?? f.text;
    Object.assign(f, { asset: e.target.value, result: null, error: "", logged: false, added: {} });
    // 地址带着设备 id，刷新 / 分享还是这台；不选设备就去掉参数
    const h = `${href("house", "fix")}${f.asset ? `?asset=${f.asset}` : ""}`;
    if (location.hash !== h) history.replaceState(null, "", h);
    repaint();
  }
});
document.addEventListener("input", (e) => { if (e.target.id === "fixText") fx().text = e.target.value; });
