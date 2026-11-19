/* 收款方各部分共用的小件。从 payees.js 抽出来，各部分依赖这里。 */
import { state } from "../core/state.js";

export const P = () => (state.payees ||= { q: "", sort: { k: "total", dir: "desc" }, limit: 0, renameKey: null, sel: null, mergeTo: "", tidy: false, tidyOff: new Set(), tidyTo: {}, open: null });
export const TZ = () => Units.timeZone() || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
