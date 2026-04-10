import { useState } from 'react';
import { authAPI } from '../services/auth';

function Login({ onLoginSuccess }) {
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPass] = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Введите имя пользователя'); return; }
    if (!password)        { setError('Введите пароль');           return; }
    setLoading(true);
    try {
      const result = await authAPI.login(username.trim(), password);
      onLoginSuccess({
        ...result.user,
        sipPassword: result.sipCredentials?.password,
        wssUrl:      result.sipCredentials?.wssUrl
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error   ||
        'Неверные имя пользователя или пароль'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="connect-screen">
      {/* Background orbs */}
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />

      <div className="connect-card">
        {/* Logo */}
        <div className="connect-logo">
          <div className="logo-ring">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
        </div>

        {/* Header */}
        <div className="connect-header">
          <h1 className="connect-title">Корпоративная телефония</h1>
          <p className="connect-subtitle">Войдите с помощью аккаунта Active Directory</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="connect-form">

          {/* Username */}
          <div className="form-group">
            <label className="form-label">Имя пользователя</label>
            <div className="input-wrapper input-icon-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="input-icon">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="john.doe"
                className="form-input"
                autoFocus
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Пароль</label>
            <div className="input-wrapper input-icon-right">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="form-input"
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPassword)}
                className="input-toggle"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243 4.243m4.242-4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="form-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading} className="btn-connect">
            {loading ? (
              <>
                <span className="btn-spinner" />
                Вход…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" />
                </svg>
                Войти
              </>
            )}
          </button>
        </form>

        <p className="connect-footer">Powered by FreeSWITCH &amp; Active Directory</p>
      </div>
    </div>
  );
}

export default Login;
