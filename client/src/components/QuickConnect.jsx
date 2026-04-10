import { useState } from 'react';

/**
 * Quick Connect — elegant glassmorphism login screen
 */
export default function QuickConnect({ onConnect }) {
  const [extension, setExtension] = useState('');
  const [password, setPassword] = useState('');
  const [pbxUrl, setPbxUrl] = useState(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.hostname}:8088/ws`;
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!extension.trim()) { setError('Введите номер телефона'); return; }
    if (!password.trim()) { setError('Введите SIP пароль'); return; }
    if (!pbxUrl.trim() || !/^wss?:\/\//i.test(pbxUrl)) { setError('Неверный формат URL'); return; }
    setLoading(true);
    try {
      await onConnect(extension.trim(), password, pbxUrl.trim());
    } catch (err) {
      setError(err.message || 'Ошибка подключения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="connect-screen">
      {/* ── Background orbs ──────────────────────────────── */}
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />

      <div className="connect-card">
        {/* ── Logo ─────────────────────────────────────── */}
        <div className="connect-logo">
          <div className="logo-ring">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
        </div>

        <div className="connect-header">
          <h1 className="connect-title">Телефон</h1>
          <p className="connect-subtitle">Подключитесь к вашей АТС</p>
        </div>

        {/* ── Form ─────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="connect-form">
          {/* Extension */}
          <div className="form-group">
            <label className="form-label">Номер телефона</label>
            <div className="input-wrapper input-icon-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="input-icon">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              <input
                type="text" value={extension}
                onChange={(e) => setExtension(e.target.value.replace(/[^0-9*#]/g, ''))}
                placeholder="1001" className="form-input font-mono" autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">SIP пароль</label>
            <div className="input-wrapper input-icon-right">
              <input
                type={showPassword ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" className="form-input"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="input-toggle">
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243 4.243m4.242-4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* PBX URL */}
          <div className="form-group">
            <label className="form-label">Адрес АТС</label>
            <div className="input-wrapper">
              <input
                type="text" value={pbxUrl} onChange={(e) => setPbxUrl(e.target.value)}
                placeholder="ws://192.168.1.100:8088/ws" className="form-input font-mono text-sm"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="form-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" strokeLinecap="round" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading}
            className={`btn-connect ${loading ? 'loading' : ''}`}>
            {loading ? (
              <>
                <span className="btn-spinner" />
                Подключение…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                Подключиться
              </>
            )}
          </button>
        </form>

        {/* ── Footer ───────────────────────────────────── */}
        <p className="connect-footer">Данные сохраняются локально в браузере</p>
      </div>
    </div>
  );
}
