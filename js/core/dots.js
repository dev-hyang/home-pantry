/* 「A · B · C」这类一行信息：换行时只在「·」那里断开，一条信息不会被拆成两行；
 * 排不下时后面的条目整条落到下一行（样式 styles.css 的 .dots；右对齐的行加 .r）。items = 已经转义好的 html 片段。 */
export const dots = (items) => items.filter(Boolean).map((x) => `<span class="dt">${x}</span>`).join("");
