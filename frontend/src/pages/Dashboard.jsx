import { useState, useEffect, useRef } from 'react';
import { authAPI, contactsAPI } from '../services/auth';
import webrtcService from '../services/webrtc';
import { useWebSocket } from '../hooks/useWebSocket';

/* ── Avatar colour palette (same as reference) ──────────── */
const AVATAR_COLORS = [
  'from-blue-400 to-cyan-500',    'from-purple-400 to-pink-500',
  'from-emerald-400 to-teal-500', 'from-orange-400 to-red-500',
  'from-indigo-400 to-blue-500',  'from-rose-400 to-pink-500',
  'from-amber-400 to-orange-500', 'from-violet-400 to-purple-500',
];

/* ── Keypad layout ───────────────────────────────────────── */
const DIAL_KEYS = [
  ['1',''],    ['2','ABC'],  ['3','DEF'],
  ['4','GHI'], ['5','JKL'],  ['6','MNO'],
  ['7','PQRS'],['8','TUV'],  ['9','WXYZ'],
  ['*',''],    ['0','+'],    ['#',''],
];

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════ */
function Dashboard({ user, onLogout }) {
  /* contacts & search */
  const [contacts, setContacts]   = useState([]);
  const [search, setSearch]       = useState('');

  /* active / incoming call */
  const [activeCall, setActiveCall] = useState(null);
  const [callState, setCallState]   = useState('idle'); // idle | incoming | ringing | active

  /* in-call controls */
  const [isMuted, setIsMuted]     = useState(false);
  const [callDuration, setDuration] = useState(0);
  const durationRef = useRef(null);

  /* dial */
  const [dialNumber, setDialNumber] = useState('');
  const [tab, setTab]               = useState('keypad');

  /* SIP registration status */
  const [sipStatus, setSipStatus] = useState('connecting');

  const { onlineUsers, isConnected } = useWebSocket();

  /* ── Init ─────────────────────────────────────────────────
     SIP только здесь: cleanup НЕ вызывает disconnect — иначе React Strict Mode
     снимает UA сразу после входа, INVITE до FreeSWITCH не уходит (в логе только REGISTER). */
  useEffect(() => {
    loadContacts();

    let base = user;
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored?.username === user.username) {
          base = { ...user, ...stored };
        }
      }
    } catch (_) {
      /* ignore */
    }

    const sipUser = {
      ...base,
      extension: String(base.extension ?? ''),
      sipPassword: base.sipPassword,
      sipDomain: base.sipDomain || base.domain,
      /* Всегда через nginx /sip (порт 443 по умолчанию даёт пустой location.port — не уходить на :7443 с хоста). */
      wssUrl: base.wssUrl || `wss://${window.location.host}/sip`
    };
    if (!sipUser.extension || !sipUser.sipPassword) {
      setSipStatus('failed');
      console.warn('[SIP] Нет sipPassword в профиле — войдите заново после обновления клиента.');
    }

    webrtcService.setOnRegistrationChange(setSipStatus);

    webrtcService.setOnNewRTCSession((session, originator) => {
      setActiveCall(session);
      const isIncoming =
        originator === 'remote' ||
        session.direction === 'incoming' ||
        session._direction === 'incoming';
      setCallState(isIncoming ? 'incoming' : 'ringing');
    });

    webrtcService.setOnCallStateChange((state, session) => {
      if (state === 'active') {
        setCallState('active');
        setActiveCall(session);
        setIsMuted(false);
        setDuration(0);
        durationRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      } else if (state === 'incoming' || state === 'ringing') {
        if (session) setActiveCall(session);
        setCallState(state);
      } else if (state === 'ended' || state === 'failed') {
        setCallState('idle');
        setActiveCall(null);
        clearInterval(durationRef.current);
        setDuration(0);
      }
    });

    if (sipUser.extension && sipUser.sipPassword) {
      webrtcService.connect(sipUser);
    }

    return () => {
      webrtcService.setOnRegistrationChange(null);
      webrtcService.setOnNewRTCSession(null);
      webrtcService.setOnCallStateChange(null);
      clearInterval(durationRef.current);
    };
  }, [user.username, user.extension, user.sipPassword, user.wssUrl]);

  const loadContacts = async () => {
    try {
      const data = await contactsAPI.getAll();
      setContacts(data.contacts || []);
    } catch (e) {
      console.error('Failed to load contacts:', e);
    }
  };

  /* ── Call actions ───────────────────────────────────────── */
  const handleCall = (extension) => {
    const ext = String(extension ?? '');
    if (!ext) return;
    if (ext === String(user.extension)) { alert('Нельзя позвонить самому себе'); return; }
    try {
      webrtcService.call(ext);
      setCallState('ringing');
    } catch (e) {
      alert('Не удалось совершить вызов: ' + e.message);
    }
  };

  const handleDialCall = () => {
    if (dialNumber) handleCall(dialNumber);
  };

  const handleAnswer = () => webrtcService.answer();

  const endCall = () => {
    webrtcService.hangup();
    setActiveCall(null);
    setCallState('idle');
    clearInterval(durationRef.current);
    setDuration(0);
  };

  const handleMute = () => {
    const next = !isMuted;
    webrtcService.mute(next);
    setIsMuted(next);
  };

  const handleDialKey = (digit) => {
    if (callState === 'active') {
      webrtcService.sendDTMF(digit);
    } else {
      setDialNumber((p) => p + digit);
    }
  };

  const handleLogout = async () => {
    await authAPI.logout();
    webrtcService.disconnect();
    onLogout();
  };

  /* ── Derived ────────────────────────────────────────────── */
  const isCallBusy   = callState !== 'idle';
  const userInitials = (user.displayName || user.username || '?')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const filteredContacts = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      (c.displayName || '').toLowerCase().includes(q) ||
      (c.department  || '').toLowerCase().includes(q) ||
      String(c.extension || '').includes(search)
    );
  });

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="phone-app">
      {/* Background orbs */}
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
            <h1>{user.displayName || user.username}</h1>
            <StatusBadge status={sipStatus} />
          </div>
        </div>

        <div className="header-right">
          {user.extension && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace' }}>
              {user.extension}
            </span>
          )}
          <button type="button" onClick={handleLogout} className="btn-logout" title="Выйти">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Incoming call ─────────────────────────────────── */}
      {callState === 'incoming' && activeCall && (
        <div className="incoming-call-banner">
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
                  {activeCall.remote_identity?.display_name ||
                   activeCall.remote_identity?.uri?.user    ||
                   'Неизвестный'}
                </p>
              </div>
            </div>
            <div className="call-actions">
              <button type="button" onClick={endCall} className="btn-action btn-reject" aria-label="Отклонить">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                </svg>
              </button>
              <button type="button" onClick={handleAnswer} className="btn-action btn-answer" aria-label="Ответить">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active / ringing call ─────────────────────────── */}
      {(callState === 'active' || callState === 'ringing') && (
        <div className="active-call-banner">
          <div className="active-call-info">
            {callState === 'active'
              ? <div className="call-pulse" />
              : <div className="call-ringing-dot" />
            }
            <div>
              <p className="active-label">
                {callState === 'ringing' ? 'Вызов…' : 'Разговор'}
              </p>
              <p className="active-duration">{formatDuration(callDuration)}</p>
            </div>
          </div>
          <div className="active-actions">
            {callState === 'active' && (
              <button
                type="button"
                onClick={handleMute}
                className={`btn-call-ctrl ${isMuted ? 'active danger' : ''}`}
                aria-label={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              >
                {isMuted ? <MicOffIcon /> : <MicIcon />}
              </button>
            )}
            <button type="button" onClick={endCall} className="btn-call-ctrl btn-hangup" aria-label="Завершить вызов">
              <HangupIcon />
            </button>
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────── */}
      <main className="phone-main">
        {tab === 'keypad' && (
          <KeypadPanel
            number={dialNumber}
            onNumberChange={setDialNumber}
            onKey={handleDialKey}
            onCall={handleDialCall}
            canCall={dialNumber.length > 0 && !isCallBusy}
            isInCall={callState === 'active'}
          />
        )}
        {tab === 'contacts' && (
          <ContactsPanel
            contacts={filteredContacts}
            search={search}
            onSearch={setSearch}
            onDial={handleCall}
            isCallBusy={isCallBusy}
            onlineUsers={onlineUsers}
            wsConnected={isConnected}
            currentUserExt={String(user.extension ?? '')}
          />
        )}
      </main>

      {/* ── Tab bar ─────────────────────────────────────── */}
      <nav className="phone-tabs">
        {[
          { id: 'keypad',   label: 'Набор',    Icon: KeypadIcon },
          { id: 'contacts', label: 'Контакты', Icon: ContactsIcon },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`tab-btn ${tab === id ? 'active' : ''}`}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   KEYPAD PANEL
   ════════════════════════════════════════════════════════════ */
function KeypadPanel({ number, onNumberChange, onKey, onCall, canCall, isInCall }) {
  return (
    <div className="keypad-layout">
      {/* Number display */}
      <div className="number-display">
        <input
          type="tel"
          value={number}
          onChange={(e) => onNumberChange(e.target.value.replace(/[^0-9*#+]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') onCall(); }}
          placeholder={isInCall ? 'DTMF…' : 'Введите номер…'}
          className="number-input"
        />
        {number && (
          <button
            type="button"
            onClick={() => onNumberChange((p) => p.slice(0, -1))}
            className="btn-backspace"
            aria-label="Удалить"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
            </svg>
          </button>
        )}
      </div>

      {/* Dial grid */}
      <div className="dial-grid">
        {DIAL_KEYS.map(([digit, sub]) => (
          <button
            key={digit}
            type="button"
            onClick={() => onKey(digit)}
            className="dial-key"
          >
            <span className="dial-digit">{digit}</span>
            {sub && <span className="dial-letters">{sub}</span>}
          </button>
        ))}
      </div>

      {/* Call button */}
      <button
        type="button"
        onClick={onCall}
        disabled={!canCall && !isInCall}
        className={`btn-call ${canCall || isInCall ? 'ready' : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
        </svg>
        <span>{isInCall ? 'DTMF' : 'Вызов'}</span>
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   CONTACTS PANEL
   ════════════════════════════════════════════════════════════ */
function ContactsPanel({ contacts, search, onSearch, onDial, isCallBusy, onlineUsers, wsConnected, currentUserExt }) {
  return (
    <div className="contacts-layout">
      {/* Search */}
      <div className="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="search-icon">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Поиск по имени, отделу или добавочному…"
          className="search-input"
        />
      </div>

      {/* List */}
      <div className="contacts-list">
        {contacts.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <p>Никого не найдено</p>
          </div>
        ) : (
          contacts.map((contact, i) => {
            const initials = (contact.displayName || '?')
              .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
            const isOnline = wsConnected
              ? onlineUsers.has(contact.username)
              : contact.online;
            const isSelf = String(contact.extension ?? '') === currentUserExt;

            return (
              <button
                key={contact.username || contact.extension}
                type="button"
                onClick={() => !isCallBusy && !isSelf && onDial(String(contact.extension))}
                disabled={isCallBusy || isSelf}
                className="contact-row"
              >
                <div className="contact-avatar-wrapper">
                  <div className={`contact-avatar bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                    {initials}
                  </div>
                  <span className={`contact-online-dot ${isOnline ? 'online' : 'offline'}`} />
                </div>
                <div className="contact-info">
                  <p className="contact-name">
                    {contact.displayName}
                    {isSelf && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (вы)</span>}
                  </p>
                  <p className="contact-ext">
                    {contact.extension}
                    {contact.department ? ` · ${contact.department}` : ''}
                  </p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="contact-call-icon">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   STATUS BADGE
   ════════════════════════════════════════════════════════════ */
function StatusBadge({ status }) {
  const map = {
    registered:  { dot: 'bg-emerald-500',            label: 'На линии'    },
    connecting:  { dot: 'bg-amber-400 animate-pulse', label: 'Подключение' },
    failed:      { dot: 'bg-red-500',                 label: 'Ошибка'     },
    idle:        { dot: 'bg-slate-400',               label: 'Отключён'   },
  };
  const s = map[status] || map.idle;
  return (
    <div className="status-badge">
      <span className={`status-dot ${s.dot}`} />
      <span className="status-label">{s.label}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ICONS
   ════════════════════════════════════════════════════════════ */
function KeypadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
    </svg>
  );
}

function ContactsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728A9 9 0 015.636 5.636M12 3v2m0 13.182v3.182m-6.182-3H9m6.182 0h3.182M9 3.75a3 3 0 016 0v3.182" />
    </svg>
  );
}

function HangupIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════ */
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default Dashboard;
