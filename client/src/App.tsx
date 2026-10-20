import { useState } from 'react';

type Health = {
  status: string;
  db: string;
  time: string;
};

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkHealth() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`接口返回 HTTP ${res.status}`);
      }
      setHealth((await res.json()) as Health);
    } catch (err) {
      setHealth(null);
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">MyBlog</h1>
        <p className="mt-2 text-slate-600">
          M0 骨架就位。下面这个按钮会经 Vite 代理请求后端的健康检查接口，并让它真实查一次数据库。
        </p>

        <button
          type="button"
          onClick={checkHealth}
          disabled={loading}
          className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? '检测中…' : '检测后端与数据库'}
        </button>

        {health && (
          <pre className="mt-4 overflow-x-auto rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {JSON.stringify(health, null, 2)}
          </pre>
        )}

        {error && (
          <pre className="mt-4 overflow-x-auto rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </pre>
        )}
      </div>
    </div>
  );
}
