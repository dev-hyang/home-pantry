/* 备份界面的同步小件：数据变了就把备份页标记成需要重读。 */
import { state } from "../core/state.js";

export const refreshBackupUi = () => { if (state.backupUi) state.backupUi.stale = true; };
