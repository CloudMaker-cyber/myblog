import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="wrap auth-grid">
      <div className="auth-editorial">
        <span className="kicker">404 / NOT FOUND</span>
        <h1>
          这一页
          <br />
          不存在
        </h1>
        <p className="dek">地址可能拼错了，或者这篇文章已经被作者删除。</p>
      </div>

      <div className="auth-form">
        <p className="empty-desc" style={{ marginBottom: '26px' }}>
          回到首页继续浏览。
        </p>
        <Link className="btn-submit" to="/" style={{ display: 'block', textAlign: 'center' }}>
          返回首页
        </Link>
      </div>
    </div>
  );
}
