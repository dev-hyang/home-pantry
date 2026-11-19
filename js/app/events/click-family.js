/* 点击动作：家庭与设置：成员、家人名册、邀请、加入、登录、备份。 */
import { $, armed, confirmDelete, num, toast } from "../../core/util.js";
import * as Backup from "../../core/backup.js";
import { CloudStore, DemoStore, Store } from "../../core/store.js";
import { ackLoginDo, loginsMore } from "../../settings/logins.js";
import { afterLogin, waitTimer } from "../auth/household.js";
import { changeLang } from "../page-events.js";
import { doBackup, doRestore } from "../actions/backup.js";
import { exportJson } from "../actions/export-notify.js";
import { famMembers, familyHref, reloadMembers } from "../../settings/members.js";
import { go } from "../../core/router.js";
import { refresh } from "../data.js";
import { render } from "../render.js";
import { renderLogin } from "../auth/login.js";
import { state } from "../../core/state.js";
import { t } from "../../core/i18n.js";
import { personAddCancel, personAddDo, personMerge, personMergeCancel, personMergeOpen, personUse } from "../lazy-modules.js";
import { refreshBackupUi } from "../../settings/backup-ui.js";
import { deviceLinkDo, deviceLinkNew, removePerson } from "../lazy-modules.js";

/** 点击动作（家庭与设置：成员、家人名册、邀请、加入、登录、备份）：这一组处理的 data-action */
export const FAMILY_ACTIONS = new Set(["login-ack","logins-more","person-del-page","person-remove","person-new-cancel","device-link","device-link-new","discard","person-add-do","person-add-cancel","person-use","person-merge-open","person-merge-cancel","person-merge","copy-invite","notif","export","backup-now","backup-continue","backup-download","backup-pick-folder","backup-forget-folder","backup-pick-sql","backup-forget-sql","backup-grant","backup-relist","backup-src","backup-dl","backup-use","backup-rm","backup-gd-on","backup-gd-pick","backup-gd-clear","backup-gd-off","backup-dbx-on","backup-dbx-off","backup-restore-cancel","backup-restore-confirm","reset-demo","logout","login-mode","otp-back","lang","member-role","member-finance","member-remove","rotate-invite","close-invite","member-approve","member-reject","join-recheck","join-cancel"]);
/** 点击动作（家庭与设置：成员、家人名册、邀请、加入、登录、备份）：按 data-action 分支；el 是被点的元素，id 是它的 data-id，e 是点击事件 */
export async function clickFamily(action, el, id, e) {
  switch (action) {
      case "login-ack": await ackLoginDo(id); return render(true);   // 登录记录：是我们家人
      case "logins-more": await loginsMore(); return;   // 登录记录：再往前 6 天
      case "person-del-page": {   // 家庭成员详情页的「删除」：名下没有设备时才有这个按钮
        if (!confirmDelete(t("删除这位家庭成员？相关账单里的名字会保留，但不再关联到这个人。"))) return;
        await Store.deletePerson(id); state.people = await Store.listPeople(); toast(t("已删除")); return go(familyHref(), { replace: true });
      }
      case "person-remove": await removePerson(id); await refresh(); return render(true);
      case "person-new-cancel": return go(familyHref(), { replace: true });
      case "device-link": await deviceLinkDo(); return render(true);   // 这台设备是谁？→ 选已有的人
      case "device-link-new": await deviceLinkNew(); return render(true);   // …或新建一个人
      case "discard": {   // 过期扔掉：剩下的全部记成 discard（迁移 065；没跑迁移时云端会报错，提示先执行）
        const it = state.items.find((x) => x.id === id); if (!it || !(num(it.quantity) > 0)) return;
        el.disabled = true;
        try { await Store.adjust(id, -num(it.quantity), "discard"); } catch (e) { el.disabled = false; return toast(/invalid reason/.test(e.message) ? t("要先在 Supabase 执行迁移 065，才能记「扔掉」") : e.message); }
        toast(t("已记下：{name} 过期扔掉了；「我的 → 家里的数字」里能看到浪费", { name: it.name }));
        return refresh();
      }
      case "person-add-do": return personAddDo();
      case "person-add-cancel": return personAddCancel();
      case "person-use": return personUse(el.dataset.id);
      case "person-merge-open": return personMergeOpen(el.dataset.id);
      case "person-merge-cancel": return personMergeCancel();
      case "person-merge": return personMerge(el.dataset.id);
      case "copy-invite": await navigator.clipboard.writeText(state.household.invite_code); return toast(t("邀请码已复制"));
      case "notif": await Notification.requestPermission(); return render();
      case "export": return exportJson();
      case "backup-now": case "backup-continue": return doBackup(Backup.settings().targets.length ? Backup.settings().targets : ["download"], el);
      case "backup-download": return doBackup(["download"], el);
      case "backup-pick-folder": try { await Backup.pickFolder(); toast(t("已记住这个文件夹")); } catch (err) { if (err.name !== "AbortError") toast(t("选文件夹失败：{msg}", { msg: err.message })); } refreshBackupUi(); return render(false);
      case "backup-forget-folder": await Backup.forgetFolder(); refreshBackupUi(); return render(false);
      case "backup-pick-sql": try { await Backup.pickSqlFolder(); toast(t("以后每次写云盘文件夹时会把 .sql 一起拷进 sql/ 子目录")); } catch (err) { if (err.name !== "AbortError") toast(t("选文件夹失败：{msg}", { msg: err.message })); } refreshBackupUi(); return render(false);
      case "backup-forget-sql": await Backup.forgetSqlFolder(); refreshBackupUi(); return render(false);
      case "backup-grant": { const st = await Backup.folderStatus(); if (st.handle) { try { await st.handle.requestPermission({ mode: "readwrite" }); } catch { /* 用户取消 */ } } refreshBackupUi(); return render(false); }
      case "backup-relist": { el.disabled = true; try { const S0 = Backup.SOURCES[el.dataset.src], r = await (S0.relist || S0.list)(); state.backupUi = { ...(state.backupUi || {}), lists: { ...(state.backupUi?.lists || {}), [el.dataset.src]: r }, errs: { ...(state.backupUi?.errs || {}), [el.dataset.src]: "" } }; } catch (err) { toast(t("读取失败：{msg}", { msg: err.message === "NEED_GESTURE" ? t("需要重新登录 Google") : err.message })); } return render(false); }
      case "backup-src": state.backupSrc = el.dataset.src; return render(false);
      case "backup-dl": try { const d = await Backup.SOURCES[el.dataset.src].read(el.dataset.id); Backup.download(Backup.toBlob(d), el.dataset.name); } catch (err) { toast(t("下载失败：{msg}", { msg: err.message })); } return;
      case "backup-use": try { const d = await Backup.SOURCES[el.dataset.src].read(el.dataset.id); state.backupPreview = { ...Backup.inspect(d), data: d, from: el.dataset.name }; } catch (err) { toast(t("读取失败：{msg}", { msg: err.message })); } return render(false);
      case "backup-rm": if (!confirm(t("删除备份 {n}？", { n: el.dataset.name }))) return; try { await Backup.SOURCES[el.dataset.src].del(el.dataset.id); } catch (err) { toast(t("删除失败：{msg}", { msg: err.message })); } refreshBackupUi(); return render(false);
      case "backup-gd-on": el.disabled = true; try { await Backup.DR.gdConnect(); Backup.saveSettings({ targets: [...new Set([...Backup.settings().targets, "gdrive"])] }); toast(t("已连接 Google Drive")); } catch (err) { toast(t("连接 Google Drive 失败：{msg}", { msg: err.message })); } refreshBackupUi(); return render(false);
      case "backup-gd-pick": try { const fo = await Backup.DR.gdPickFolder(); if (fo) { Backup.saveSettings({ gdId: fo.id, gdName: fo.name }); toast(t("以后备份放到「{n}」", { n: fo.name })); } } catch (err) { toast(t("选文件夹失败：{msg}", { msg: err.message })); } refreshBackupUi(); return render(false);
      case "backup-gd-clear": Backup.saveSettings({ gdId: "", gdName: "" }); refreshBackupUi(); return render(false);
      case "backup-gd-off": Backup.DR.gdDisconnect(); Backup.saveSettings({ targets: Backup.settings().targets.filter((x) => x !== "gdrive") }); refreshBackupUi(); return render(false);
      case "backup-dbx-on": try { await Backup.DR.dbxConnect(); } catch (err) { toast(t("连接 Dropbox 失败：{msg}", { msg: err.message })); } return;
      case "backup-dbx-off": await Backup.DR.dbxDisconnect(); Backup.saveSettings({ targets: Backup.settings().targets.filter((x) => x !== "dropbox") }); refreshBackupUi(); return render(false);
      case "backup-restore-cancel": state.backupPreview = null; return render(false);
      case "backup-restore-confirm": return doRestore(el);
      case "reset-demo": if (armed(el, t("再点一次确认恢复"))) { DemoStore.reset(); toast(t("已恢复演示数据")); refresh(); } return;
      case "logout": await CloudStore.sb.auth.signOut(); localStorage.removeItem("hmh-hid"); return location.reload();
      case "login-mode": state.loginMode = el.dataset.mode; state.phonePending = null; return renderLogin();
      case "otp-back": state.phonePending = null; return renderLogin();
      case "lang": return changeLang(el.dataset.lang || null);
      case "member-role": {
        const m = famMembers().find((x) => x.user_id === id), role = el.dataset.role;
        if (!m) return;
        if (!armed(el, role === "owner" ? t("再点一次设为家主") : t("再点一次取消家主"))) return;
        await Store.setMemberRole(id, role);
        await reloadMembers();
        toast(role === "owner" ? t("{name} 已设为家主", { name: m.display_name }) : t("{name} 已取消家主", { name: m.display_name })); return render();
      }
      case "member-finance": {   // 家主开 / 关某位家人的财务权限（对账单、收入、预算、用卡）
        const m = famMembers().find((x) => x.user_id === id), on = el.dataset.on === "1";
        if (!m) return;
        if (on && !confirm(t("给 {name} 开财务权限？开了就能看、能改对账单、收入、预算和用卡。", { name: m.display_name }))) return;
        try { await Store.setMemberFinance(id, on); } catch (err) { toast(err.message); return; }
        await reloadMembers();
        toast(on ? t("{name} 现在能看、能改对账单、收入、预算和用卡", { name: m.display_name }) : t("已收回 {name} 的财务权限", { name: m.display_name })); render(); $(".tgl")?.focus(); return;   // 重画后把焦点放回开关（键盘 / 读屏）
      }
      case "member-remove": {
        const m = famMembers().find((x) => x.user_id === id);
        if (!m) return;
        if (!armed(el, t("再点一次确认移出"))) return;
        await Store.removeMember(id);
        await reloadMembers();
        toast(t("{name} 已移出家庭", { name: m.display_name })); return render(true);
      }
      case "rotate-invite": {
        if (!armed(el, t("再点一次确认重置"))) return;
        const { data, error } = await CloudStore.sb.rpc("rotate_invite_code", { p_household: state.household.id });
        if (error) throw new Error(error.message);
        state.household.invite_code = data;
        const { data: hh } = await CloudStore.sb.from("households").select("invite_expires_at").eq("id", state.household.id).single();
        state.household.invite_expires_at = hh?.invite_expires_at || null;
        toast(t("已生成新邀请码（7 天内有效），旧邀请码立即失效")); return render();
      }
      case "close-invite": {
        if (!armed(el, t("再点一次关闭邀请"))) return;
        await CloudStore.closeInvite(); state.household.invite_expires_at = new Date().toISOString();
        toast(t("已关闭邀请：现在谁也不能用邀请码加入了")); return render();
      }
      case "member-approve": {
        await CloudStore.approveMember(id);
        state.members = await CloudStore.listMembers(); state.pendingMembers = await CloudStore.listPendingMembers();
        toast(t("已批准，对方现在可以进入了")); return render();
      }
      case "member-reject": {
        if (!armed(el, t("再点一次确认拒绝"))) return;
        await CloudStore.removeMember(id); state.pendingMembers = await CloudStore.listPendingMembers();
        toast(t("已拒绝这个申请")); return render();
      }
      case "join-recheck": return afterLogin();
      case "join-cancel": {
        await CloudStore.sb.from("household_members").delete().eq("household_id", el.dataset.hid).eq("user_id", state.user.id);
        clearInterval(waitTimer); return afterLogin();
      }
  }
}
