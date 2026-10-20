import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthContext';
import { parseFormError, type FieldErrors } from '../lib/form-errors';

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
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
      await signUp({ username, email, password });
      navigate('/', { replace: true });
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
          加入
          <br />
          MyBlog
        </h1>
        <p className="dek">注册后即可发布技术文章与日常思考。</p>
      </div>

      <div className="auth-form">
        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="field">
            <label className="field-label" htmlFor="register-username">
              用户名
            </label>
            <input
              id="register-username"
              className="field-input"
              type="text"
              autoComplete="username"
              placeholder="3–30 个字符"
              value={username}
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby="register-username-msg"
              onChange={(event) => {
                setUsername(event.target.value);
                clearField('username');
              }}
              required
            />
            {fieldErrors.username ? (
              <p className="field-error" id="register-username-msg">
                {fieldErrors.username}
              </p>
            ) : (
              <p className="field-hint" id="register-username-msg">
                用户名注册后不可修改，请一次想好。
              </p>
            )}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="register-email">
              邮箱
            </label>
            <input
              id="register-email"
              className="field-input"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby="register-email-msg"
              onChange={(event) => {
                setEmail(event.target.value);
                clearField('email');
              }}
              required
            />
            {fieldErrors.email ? (
              <p className="field-error" id="register-email-msg">
                {fieldErrors.email}
              </p>
            ) : (
              <p className="field-hint" id="register-email-msg">
                邮箱不会对其他用户公开。
              </p>
            )}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="register-password">
              密码
            </label>
            <input
              id="register-password"
              className="field-input"
              type="password"
              autoComplete="new-password"
              placeholder="至少 8 位，含字母和数字"
              value={password}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby="register-password-msg"
              onChange={(event) => {
                setPassword(event.target.value);
                clearField('password');
              }}
              required
            />
            {fieldErrors.password ? (
              <p className="field-error" id="register-password-msg">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          <button className="btn-submit" type="submit" disabled={pending}>
            {pending ? '创建中…' : '创建账号'}
          </button>

          <p className="form-foot">
            已经有账号？<Link to="/login">直接登录</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
