import { useState } from 'react';
import { authAPI } from '../services/auth';

function Login({ onLoginSuccess }) {
  const [fullName, setFullName] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const name = fullName.trim().replace(/\s+/g, ' ');
    if (!name) { setError('Введите ФИО'); return; }
    setLoading(true);
    try {
      const result = await authAPI.login(name, '');
      onLoginSuccess({
        ...result.user,
        sipPassword: result.sipCredentials?.password,
        wssUrl:      result.sipCredentials?.wssUrl,
        sipDomain:   result.sipCredentials?.domain
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error   ||
        'Ошибка входа. Попробуйте ещё раз.'
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
          <p className="connect-subtitle">Введите ваше ФИО для входа</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="connect-form">

          {/* Full name */}
          <div className="form-group">
            <label className="form-label">ФИО</label>
            <div className="input-wrapper input-icon-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="input-icon">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                className="form-input"
                autoFocus
                autoComplete="name"
                disabled={loading}
              />
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

        <p className="connect-footer">Powered by FreeSWITCH</p>
      </div>
    </div>
  );
}

export default Login;
