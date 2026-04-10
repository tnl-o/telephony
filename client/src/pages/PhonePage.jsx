import { useState, useEffect } from 'react';

/**
 * Main Phone UI — redesigned with premium glassmorphism style
 */
export default function PhoneScreen({
  status, currentCall, incomingCall, isMuted, isOnHold, callDuration,
  callHistory, makeCall, answerCall, rejectCall, hangup, sendDTMF,
  toggleMute, toggleHold, onDisconnect,
}) {
  const [tab, setTab] = useState('keypad');
  const [dialNumber, setDialNumber] = useState('');
  const isRegistered = status === 'registered';

  const handleCall = () => {
    if (!dialNumber || !isRegistered || currentCall) return;
    const num = dialNumber.startsWith('+') ? '00' + dialNumber.slice(1) : dialNumber;
    makeCall(num);
    setDialNumber('');
  };

  const handleKey = (digit) => {
    if (currentCall) { sendDTMF(digit); } else { setDialNumber((p) => p + digit); }
  };

  return (
    <div className="phone-app">
      {/* ── Background orbs ──────────────────────────────── */}
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />

      {/* ── Header ───────────────────────────────────────── */}
      <header className="phone-header">
        <div className="header-left">
          <div className="app-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
          <div className="app-title">
            <h1>Телефон</h1>
            <StatusBadge status={status} />
          </div>
        </div>
        <button
          type="button"
          onClick={onDisconnect}
          className="btn-logout"
          title="Отключиться"
          aria-label="Отключиться от АТС"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
        </button>
      </header>

      {/* ── Incoming call ────────────────────────────────── */}
      {incomingCall && (
        <div className="incoming-call-banner" key="incoming">
          <div className="incoming-glow" />
          <div className="incoming-content">
            <div className="caller-info">
              <div className="caller-avatar ringing">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div>
                <p className="caller-label">Входящий вызов</p>
                <p className="caller-number">
                  {incomingCall.remote_identity?.uri?.user ?? 'Неизвестный'}
                </p>
              </div>
            </div>
            <div className="call-actions">
              <button type="button" onClick={rejectCall} className="btn-action btn-reject" aria-label="Отклонить вызов">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                </svg>
              </button>
              <button type="button" onClick={answerCall} className="btn-action btn-answer" aria-label="Ответить">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active call ──────────────────────────────────── */}
      {currentCall && (
        <div className="active-call-banner">
          <div className="active-call-info">
            <div className="call-pulse" />
            <div>
              <p className="active-label">Разговор</p>
              <p className="active-duration">{formatDuration(callDuration)}</p>
            </div>
          </div>
          <div className="active-actions">
            <button type="button" onClick={toggleMute} className={`btn-call-ctrl ${isMuted ? 'active danger' : ''}`} aria-label={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}>
              {isMuted ? <MicOffIcon /> : <MicIcon />}
            </button>
            <button type="button" onClick={toggleHold} className={`btn-call-ctrl ${isOnHold ? 'active warning' : ''}`} aria-label={isOnHold ? 'Снять с удержания' : 'Удержать'}>
              <HoldIcon />
            </button>
            <button type="button" onClick={hangup} className="btn-call-ctrl btn-hangup" aria-label="Завершить вызов">
              <HangupIcon />
            </button>
          </div>
        </div>
      )}

      {/* ── Main ─────────────────────────────────────────── */}
      <main className="phone-main">
        {tab === 'keypad' && (
          <Keypad
            number={dialNumber} onNumberChange={setDialNumber} onKey={handleKey}
            onCall={handleCall} canCall={isRegistered && dialNumber.length > 0 && !currentCall}
            isInCall={!!currentCall}
          />
        )}
        {tab === 'contacts' && (
          <Contacts
            onDial={(num) => { setDialNumber(num); setTab('keypad'); }}
            currentCall={currentCall}
          />
        )}
        {tab === 'history' && <History entries={callHistory} />}
      </main>

      {/* ── Tab bar ──────────────────────────────────────── */}
      <nav className="phone-tabs">
        {[
          { id: 'keypad', label: 'Набор', icon: KeypadIcon },
          { id: 'contacts', label: 'Контакты', icon: ContactsIcon },
          { id: 'history', label: 'История', icon: HistoryIcon },
        ].map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <t.icon />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ── Keypad ──────────────────────────────────────────────────── */
function Keypad({ number, onNumberChange, onKey, onCall, canCall, isInCall }) {
  const keys = [
    ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
    ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
    ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
    ['*', ''], ['0', '+'], ['#', ''],
  ];

  return (
    <div className="keypad-layout">
      <div className="number-display">
        <input
          type="tel" value={number}
          onChange={(e) => onNumberChange(e.target.value.replace(/[^0-9*#+]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') onCall(); }}
          placeholder={isInCall ? 'DTMF…' : 'Введите номер…'}
          className="number-input"
        />
        {number && (
          <button type="button" onClick={() => onNumberChange((p) => p.slice(0, -1))} className="btn-backspace" aria-label="Удалить последнюю цифру">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
            </svg>
          </button>
        )}
      </div>

      <div className="dial-grid">
        {keys.map(([digit, sub]) => (
          <button type="button" key={digit} onClick={() => onKey(digit)} className="dial-key" aria-label={sub ? `Клавиша ${digit} ${sub}` : `Клавиша ${digit}`}>
            <span className="dial-digit">{digit}</span>
            {sub && <span className="dial-letters">{sub}</span>}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onCall}
        disabled={!canCall && !isInCall}
        className={`btn-call ${canCall || isInCall ? 'ready' : ''}`}
        aria-label={isInCall ? 'Отправить DTMF' : 'Позвонить'}
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
        </svg>
        <span>{isInCall ? 'DTMF' : 'Вызов'}</span>
      </button>
    </div>
  );
}

/* ── Contacts ────────────────────────────────────────────────── */
function Contacts({ onDial, currentCall }) {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/contacts.json')
      .then((r) => r.json())
      .then((data) => { setContacts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return c.extension.includes(q) || c.name.toLowerCase().includes(q) || c.department.toLowerCase().includes(q);
  });

  const avatarColors = [
    'from-blue-400 to-cyan-500', 'from-purple-400 to-pink-500',
    'from-emerald-400 to-teal-500', 'from-orange-400 to-red-500',
    'from-indigo-400 to-blue-500', 'from-rose-400 to-pink-500',
    'from-amber-400 to-orange-500', 'from-violet-400 to-purple-500',
  ];

  if (loading) return <div className="loading-placeholder"><div className="spinner" /></div>;

  return (
    <div className="contacts-layout">
      <div className="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="search-icon">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск…" className="search-input" />
      </div>

      <div className="contacts-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <p>Никого не найдено</p>
          </div>
        ) : (
          filtered.map((c, i) => (
            <button
              type="button"
              key={c.extension}
              onClick={() => !currentCall && onDial(c.extension)}
              disabled={!!currentCall}
              className="contact-row"
            >
              <div className={`contact-avatar bg-gradient-to-br ${avatarColors[i % avatarColors.length]}`}>
                {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="contact-info">
                <p className="contact-name">{c.name}</p>
                <p className="contact-ext">{c.extension}{c.department ? ` · ${c.department}` : ''}</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="contact-call-icon">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/* ── History ─────────────────────────────────────────────────── */
function History({ entries }) {
  if (!entries.length) {
    return (
      <div className="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>Нет звонков</p>
      </div>
    );
  }

  const typeConfig = {
    missed:    { icon: '↙', color: 'text-red-500',    label: 'Пропущенный' },
    incoming:  { icon: '↙', color: 'text-emerald-500', label: 'Входящий' },
    outgoing:  { icon: '↗', color: 'text-blue-500',    label: 'Исходящий' },
  };

  return (
    <div className="history-list">
      {entries.map((call) => {
        const t = typeConfig[call.type] || typeConfig.outgoing;
        return (
          <div key={call.id} className="history-row">
            <div className={`history-icon ${t.color}`}>{t.icon}</div>
            <div className="history-info">
              <p className="history-number">{call.number}</p>
              <p className="history-type">{t.label}</p>
            </div>
            <div className="history-meta">
              <p className="history-duration">{call.duration}</p>
              <p className="history-time">
                {new Date(call.timestamp).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Icons ───────────────────────────────────────────────────── */
function KeypadIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>; }
function ContactsIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>; }
function HistoryIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; }
function MicIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>; }
function MicOffIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728A9 9 0 015.636 5.636M12 3v2m0 13.182v3.182m-6.182-3H9m6.182 0h3.182M9 3.75a3 3 0 016 0v3.182" /></svg>; }
function HoldIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>; }
function HangupIcon() { return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" /></svg>; }

/* ── Helpers ───────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    registered: { dot: 'bg-emerald-500', label: 'На линии' },
    connecting: { dot: 'bg-amber-400 animate-pulse', label: 'Подключение' },
    failed:     { dot: 'bg-red-500', label: 'Ошибка' },
    idle:       { dot: 'bg-slate-400', label: 'Отключён' },
  };
  const s = map[status] || map.idle;
  return (
    <div className="status-badge">
      <span className={`status-dot ${s.dot}`} />
      <span className="status-label">{s.label}</span>
    </div>
  );
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
