/* 数字框的值是不是「零」：0 / 0.0 / 0.00 / 00 / -0（空串、"."、非零都不算） */
export const isZero = value => {
  const v = String(value ?? "").trim();
  return v !== "" && /^[+-]?0*\.?0*$/.test(v) && /0/.test(v);
};
