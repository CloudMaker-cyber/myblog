/** '2026-10-21 09:46:08' → '2026.10.21 09:46' */
export function formatDateTime(value: string | null): string {
  if (!value) return '';
  const [date, time = ''] = value.split(' ');
  const [hour = '', minute = ''] = time.split(':');
  return `${date.replaceAll('-', '.')} ${hour}:${minute}`.trim();
}

/** '2026-10-21 09:46:08' → '10.21' */
export function formatMonthDay(value: string | null): string {
  if (!value) return '';
  const date = value.split(' ')[0] ?? '';
  const parts = date.split('-');
  return parts.length === 3 ? `${parts[1]}.${parts[2]}` : date;
}

/** 文章编号：id 42 → '0042'。刊物式的编号，比裸 id 更容易被引用 */
export function articleNo(id: number): string {
  return String(id).padStart(4, '0');
}
