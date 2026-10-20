import { Link } from 'react-router-dom';

import { getResume } from '../lib/reading';

export function HomePage() {
  const resume = getResume();
  const percent = resume ? Math.round(resume.progress * 100) : 0;

  return (
    <div className="wrap listing">
      {resume && (
        <div className="resume">
          <span className="resume-kicker">继续阅读</span>
          <span className="resume-title">{resume.title}</span>
          <span className="resume-meta">{percent}%</span>
          <Link to={`/articles/${resume.articleId}`} className="resume-link">
            接着读
          </Link>
          <div className="resume-bar">
            <i style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      <div className="list-head">
        <h2>最新发布</h2>
        <span>按发布时间倒序</span>
      </div>

      <div className="empty-state">
        <p className="empty-title">还没有文章</p>
        <p className="empty-desc">第一篇文章发布后，会按时间倒序出现在这里。</p>
      </div>
    </div>
  );
}
