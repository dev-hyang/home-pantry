/* 点击动作：今日页、咩咩咩、快捷操作、提醒页翻页、重新加载。 */
import { $, toast } from "../../core/util.js";
import * as Ask from "../../core/ask.js";
import { DEFAULT_QUICK, quickList, saveQuick, setTodayPref } from "../../today.js";
import { addAiMissing, copyPrompt } from "../../pantry/ai.js";
import { aiReady, aiSettings, clearModelMarks, dismissAiChanges, resetUsage, testModel } from "../../core/ai.js";
import { copyAnswer, copyGeneralPrompt, pickTopic, shiftAlertSource } from "../lazy-modules.js";
import { enableWeather } from "../../core/weather.js";
import { go, goBack, href } from "../../core/router.js";
import { hydrateModelSelect, saveAiForm } from "../../settings/views.js";
import { refresh } from "../data.js";
import { render } from "../render.js";
import { state } from "../../core/state.js";
import { t } from "../../core/i18n.js";

/** 点击动作（今日页、咩咩咩、快捷操作、提醒页翻页、重新加载）：这一组处理的 data-action */
export const TODAY_ACTIONS = new Set(["wx-enable","today-view","today-pref","today-source","quick-edit","quick-open","quick-swap","quick-swap-do","quick-add","quick-del","quick-reset","quick-run","alerts-prev","alerts-next","nav-back","ai-ask","ai-copy","ai-again","ai-add-missing","ai-topic","ai-copy-general","ai-copy-answer","ai-notice-dismiss","ai-models-refresh","ai-marks-clear","ai-usage-reset","ai-clear-adv","ai-test","ask-toggle","ask-run","ask-copy","ask-copy-answer","reload","reload-page"]);
/** 点击动作（今日页、咩咩咩、快捷操作、提醒页翻页、重新加载）：按 data-action 分支；el 是被点的元素，id 是它的 data-id，e 是点击事件 */
export async function clickToday(action, el, id, e) {
  switch (action) {
      case "wx-enable": { el.disabled = true; const ok = await enableWeather(() => render()); if (!ok) { el.disabled = false; toast(t("没拿到位置：浏览器里允许定位后再点一次")); } return; }   // 今日日期旁的天气（js/core/weather.js）
      case "today-view": setTodayPref({ view: el.dataset.v }); return render();   // 待办 | 注意事项：按模块 / 按优先级
      case "today-pref": {
        const k = el.dataset.key;
        if (k === "mode") setTodayPref({ mode: "severity" }); else if (k === "mode-property") setTodayPref({ mode: "property" });
        else setTodayPref({ [k]: !state.today[k] });
        return render();
      }
      case "today-source": setTodayPref({ source: state.today.source === el.dataset.source ? null : el.dataset.source }); return render();
      case "quick-edit": state.quickEdit = !state.quickEdit; state.quickAdd = false; state.quickSwap = null; return render();
      case "quick-open": if (state.quickSwap) state.quickSwap = null; else state.quickAdd = !state.quickAdd; return render();   // 「取消」：关掉改成 / 添加面板
      case "quick-swap": state.quickSwap = state.quickSwap === el.dataset.id ? null : el.dataset.id; state.quickAdd = false; return render();   // 编辑模式点格子：改成别的快捷操作
      case "quick-swap-do": { const h = $("#quickSel")?.value, list = quickList(), i = list.indexOf(el.dataset.id); if (h && i >= 0) { list[i] = h; await saveQuick([...new Set(list)]); } state.quickSwap = null; return render(); }
      case "quick-add": { const h = $("#quickSel")?.value; if (h) await saveQuick([...new Set([...quickList(), h])]); state.quickAdd = false; return render(); }
      case "quick-del": await saveQuick(quickList().filter((x) => x !== el.dataset.id)); return render();
      case "quick-reset": await saveQuick(DEFAULT_QUICK()); toast(t("已恢复默认快捷操作")); return render();
      case "quick-run": if (el.dataset.id === "action:print") go(`${href("me", "settings")}?sec=print`); return;   // 打印：进入 设置 → 打印
      case "alerts-prev": shiftAlertSource(-1); return render();
      case "alerts-next": shiftAlertSource(1); return render();
      case "nav-back": return goBack(el.dataset.href);
      case "ai-ask": { state.ai = state.ai || { ask: "", busy: false, result: null, error: null, raw: null }; state.ai.ask = el.dataset.ask; render(); const fm = $("#aiForm"); if (fm) { if (aiReady()) fm.requestSubmit(); else fm.elements.ask.focus(); } return; }
      case "ai-copy": return copyPrompt($("#aiForm"));
      case "ai-again": { const fm = $("#aiForm"); return fm ? fm.requestSubmit() : null; }
      case "ai-add-missing": await addAiMissing(); return refresh();
      // 咩咩咩整页
      case "ai-topic": { pickTopic(el.dataset.topic); render(); const fm = $("#aiPageForm"); if (fm) { if (aiReady()) fm.requestSubmit(); else fm.elements.q.focus(); } return; }
      case "ai-copy-general": return copyGeneralPrompt($("#aiPageForm"));
      case "ai-copy-answer": return copyAnswer();
      case "ai-notice-dismiss": dismissAiChanges(el.dataset.provider); document.getElementById("modelNotices")?.querySelector(".notice-box")?.remove(); return;
      case "ai-models-refresh": {
        if (!aiSettings().key.trim() && aiSettings().provider !== "openrouter") return toast(t("先填好并保存 API key，才能查这个 key 能用的模型"));
        toast(t("正在查…")); const ok = await hydrateModelSelect({ refresh: true });
        return toast(ok ? t("已刷新") : t("没查到新列表（网络或 key 有问题），先用上次的"));
      }
      case "ai-marks-clear": clearModelMarks(); toast(t("已清除，下次会重新试这些模型")); return render();
      case "ai-usage-reset": resetUsage(el.dataset.provider); toast(t("已重置本机的调用计数")); return render();
      case "ai-clear-adv": { const f = $("#aiSettingsForm"); if (f) { f.elements.model.value = ""; f.elements.base.value = ""; if (f.elements.rpm) { f.elements.rpm.value = ""; f.elements.rpd.value = ""; } await saveAiForm(f); } toast(t("已清掉，改用内置默认")); return render(); }
      case "ai-test": {
        el.disabled = true; const out = $("#aiTestOut");
        try { await saveAiForm($("#aiSettingsForm")); await testModel(); out.textContent = t("连接成功 ✓"); out.className = "muted ok-text"; }
        catch (err) { out.textContent = t("失败：{msg}", { msg: err.message }); out.className = "form-error"; }
        finally { el.disabled = false; }
        return;
      }
      case "ask-toggle": Ask.toggleAsk(el.dataset.ask); return render(false);
      case "ask-run": return Ask.runAsk(el.dataset.ask);
      case "ask-copy": return Ask.copyAskPrompt(el.dataset.ask);
      case "ask-copy-answer": return Ask.copyAskAnswer(el.dataset.ask);
      case "reload": return refresh();
      case "reload-page": return location.reload();   // 页面代码没下载下来（断网）：重试
  }
}
