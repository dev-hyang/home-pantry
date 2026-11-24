/* 数字框聚焦时要不要整段选中：有内容就选（0 / 0.00 / 12.50 都一样），空框不用 */
export const shouldSelect = value => String(value ?? "").trim() !== "";
