import type { TocItem } from '../../lib/toc';

/**
 * 文章目录。
 *
 * 没有给标题加 id、也没有用 #anchor 跳转，而是按下标去正文里取第 N 个标题：
 * Markdown 标题文本可能重复（两个"小结"），用文字生成 id 会撞车；
 * 按下标取元素既不会撞，也不用改 Markdown 渲染器。
 */
export function TableOfContents({
  items,
  onJump,
}: {
  items: TocItem[];
  onJump: (index: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <nav className="toc" aria-label="文章目录">
      <p className="toc-title">文章目录</p>
      <ol className="toc-list">
        {items.map((item, index) => (
          <li
            key={`${index}-${item.text}`}
            className={item.level === 3 ? 'toc-item toc-item--sub' : 'toc-item'}
          >
            <button type="button" className="toc-link" onClick={() => onJump(index)}>
              {item.text}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
