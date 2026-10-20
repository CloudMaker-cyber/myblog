import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthContext';
import { parseFormError, type FieldErrors } from '../lib/form-errors';

type LocationState = {
  from?: string;
};

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setPending(true);

    try {
      await signIn({ identifier, password });
      const state = location.state as LocationState | null;
      navigate(state?.from ?? '/', { replace: true });
    } catch (err) {
      const parsed = parseFormError(err);
      setFieldErrors(parsed.fields);
      setError(parsed.message);
    } finally {
      setPending(false);
    }
  }

  function clearField(field: keyof FieldErrors): void {
    if (!fieldErrors[field]) return;
    const next = { ...fieldErrors };
    delete next[field];
    setFieldErrors(next);
  }

  return (
    <div className="wrap auth-grid">
      <div className="auth-editorial">
        <span className="kicker">账户 / ACCOUNT</span>
        <h1>
          回到
          <br />
          写作台
        </h1>
        <p className="dek">登录后继续编辑草稿，或者写下今天的想法。</p>
      </div>

      <div className="auth-form">
        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="field">
            <label className="field-label" htmlFor="login-identifier">
              用户名或邮箱
            </label>
            <input
              id="login-identifier"
              className="field-input"
              type="text"
              autoComplete="username"
              placeholder="name@example.com"
              value={identifier}
              aria-invalid={Boolean(fieldErrors.identifier)}
              aria-describedby="login-identifier-msg"
              onChange={(event) => {
                setIdentifier(event.target.value);
                clearField('identifier');
              }}
              required
            />
            {fieldErrors.identifier ? (
              <p className="field-error" id="login-identifier-msg">
                {fieldErrors.identifier}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="login-password">
              密码
            </label>
            <input
              id="login-password"
              className="field-input"
              type="password"
              autoComplete="current-password"
              placeholder="请输入密码"
              value={password}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby="login-password-msg"
              onChange={(event) => {
                setPassword(event.target.value);
                clearField('password');
              }}
              required
            />
            {fieldErrors.password ? (
              <p className="field-error" id="login-password-msg">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          <button className="btn-submit" type="submit" disabled={pending}>
            {pending ? '登录中…' : '登录'}
          </button>

          <p className="form-foot">
            还没有账号？<Link to="/register">注册一个</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
