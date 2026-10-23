import { Link } from 'react-router-dom';

import {
  ARTICLE_TYPE_LABEL,
  type ArticleSummary,
} from '../../features/article/article.api';
import { articleNo, formatMonthDay, formatWeekday } from '../../lib/format';

/** 去掉 Markdown 记号，把正文变成一句能直接显示的导语 */
function toPlainExcerpt(text: string): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return plain.length > 90 ? `${plain.slice(0, 90)}…` : plain;
}

export function ArticleRow({ article }: { article: ArticleSummary }) {
  const published = article.published_at ?? article.created_at;

  return (
    <article className="post">
      <div className="post-date">
        {formatMonthDay(published)}
        <small>{formatWeekday(published)}</small>
      </div>

      <div className="post-main">
        <div className="kicker">
          {ARTICLE_TYPE_LABEL[article.type]} · {article.category.name}
          <span className="no"> · No. {articleNo(article.id)}</span>
        </div>
        <h3>
          <Link to={`/articles/${article.id}`}>{article.title}</Link>
        </h3>
        {article.excerpt && <p className="dek">{toPlainExcerpt(article.excerpt)}</p>}
        {article.tags.length > 0 && (
          <p className="tag-line">
            {article.tags.map((tag) => (
              <Link key={tag} to={`/?tag=${encodeURIComponent(tag)}`} className="tag-link">
                #{tag}
              </Link>
            ))}
          </p>
        )}
      </div>

      <div className="post-meta">
        <Link to={`/users/${article.author.id}`}>{article.author.username}</Link>
        <span>{article.view_count} 次阅读</span>
      </div>
    </article>
  );
}
