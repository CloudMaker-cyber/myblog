/**
 * 接口里的时间统一是 UTC 字符串，例如 '2026-10-21 09:46:08'。
 * 这里负责把它解析成 Date，再按**读者浏览器的时区**显示。
 *
 * 为什么不用 `new Date('2026-10-21 09:46:08')`：
 * 这种写法的时区行为随浏览器实现而变，部分浏览器当成本地时间、部分当成 UTC。
 * 所以手动用 Date.UTC 构造，语义唯一。
 */
function parseUtc(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** '2026-10-21 09:46:08'（UTC）→ 本地时区的 '2026.10.21 17:46' */
export function formatDateTime(value: string | null): string {
  if (!value) return '';
  const date = parseUtc(value);
  if (!date) return value;

  return (
    `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** '2026-10-21 09:46:08'（UTC）→ 本地时区的 '10.21' */
export function formatMonthDay(value: string | null): string {
  if (!value) return '';
  const date = parseUtc(value);
  if (!date) return value.split(' ')[0] ?? '';

  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

/** 本地时区的星期缩写，用于列表左侧的日期栏 */
export function formatWeekday(value: string | null): string {
  if (!value) return '';
  const date = parseUtc(value);
  if (!date) return '';

  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()] ?? '';
}

/** 文章编号：id 42 → '0042'。刊物式的编号，比裸 id 更容易被引用 */
export function articleNo(id: number): string {
  return String(id).padStart(4, '0');
}
