/**
 * 标签相似度：0 表示无关，1 表示完全相同。
 *
 * 为什么要自己算：MySQL 没有"字符串像不像"的内置函数（`SOUNDEX` 只对英文发音有效），
 * 而标签总量很小（几十到几百个），在 Node 里算一遍完全够用。
 *
 * 三种关系：
 * 1. 完全相同 → 1
 * 2. 一个包含另一个（缓存 / 缓存设计）→ 0.5~0.9，按长度比例给分，短的那个更具体
 * 3. 编辑距离接近（缓存 / 缓村）→ 按相似比例打折，最高 0.8
 */
export function tagSimilarity(a: string, b: string): number {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();

  if (!x || !y) return 0;
  if (x === y) return 1;

  if (x.includes(y) || y.includes(x)) {
    const short = x.length <= y.length ? x : y;
    const long = x.length <= y.length ? y : x;
    return 0.5 + 0.4 * (short.length / long.length);
  }

  const distance = levenshtein(x, y);
  const ratio = 1 - distance / Math.max(x.length, y.length);

  // 相似度低于 0.5 的标签对检索没有意义，直接判为无关，避免噪音
  return ratio >= 0.5 ? ratio * 0.8 : 0;
}

/** 编辑距离：把 a 改成 b 最少需要几次增/删/改 */
function levenshtein(a: string, b: string): number {
  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) previous[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }

    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j] ?? 0;
  }

  return previous[b.length] ?? 0;
}
