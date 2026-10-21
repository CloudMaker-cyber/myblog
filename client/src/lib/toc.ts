export type TocItem = {
  level: 2 | 3;
  text: string;
};

/** 去掉标题里的行内 Markdown 记号，只留纯文本 */
function stripInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 从 Markdown 正文里提取二级、三级标题，生成目录。
 *
 * 两个必须处理的情况：
 * 1. 代码块里的 `## 注释` 不是标题，要跳过，否则目录会混进代码内容；
 * 2. 标题里可能带粗体、行内代码，展示前要清理干净。
 */
export function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const lines = markdown.split(/\r?\n/);
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;

    const text = stripInline(match[2] ?? '');
    if (!text) continue;

    items.push({ level: match[1]!.length === 2 ? 2 : 3, text });
  }

  return items;
}
