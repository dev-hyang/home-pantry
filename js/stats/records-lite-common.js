/* 花费列表同步小件共用。 */
import { KINDS as MED_KINDS } from "../bills/medical.js";
import { t } from "../core/i18n.js";

/** 事件型账单（医疗 / 宠物 / 法律 / 项目 / 旅行）的显示名：数据库拼虚拟花费名称用（spend_feed） */
export const medNames = () => Object.fromEntries(Object.entries(MED_KINDS).map(([k, v]) => [k, t(v.name)]));
