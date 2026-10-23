/**
 * 分页参数的内联工具。
 *
 * 为什么不用 `LIMIT ? OFFSET ?`：
 * MySQL 支持占位符，但 TiDB 走预处理协议时会报 `Incorrect arguments to LIMIT`
 * （实测 v8.5.3 serverless）。所以这两个数字只能拼进 SQL。
 *
 * 拼字符串是有风险的动作，因此这里先强制归一化成非负安全整数——
 * 任何非法值直接抛错，而不是"转成字符串塞进去"。
 */

export function toSafeInt(value: number, name: string): number {
  const normalized = Math.trunc(Number(value));

  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error(`${name} 必须是非负整数，收到：${String(value)}`);
  }

  return normalized;
}

/** 生成 `LIMIT n OFFSET m`，两个数字都已校验 */
export function limitClause(pageSize: number, offset: number): string {
  return `LIMIT ${toSafeInt(pageSize, 'pageSize')} OFFSET ${toSafeInt(offset, 'offset')}`;
}
