import JsSIP from 'jssip';

/** STUN + пул кандидатов: Chrome по умолчанию маскирует host-кандидаты в mDNS (.local), FreeSWITCH их не резолвит. */
function defaultPcConfig() {
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  };
}

class WebRTCService {
  constructor() {
    this.ua = null;
    this.session = null;

    // Callbacks
    this.onCallStateChange    = null;
    this.onNewRTCSession      = null;
    this.onRegistrationChange = null;
  }

  connect(user) {
    if (this.ua) {
      try { this.ua.stop(); } catch (_) { /* ignore */ }
      this.ua = null;
    }
    this.session = null;

    // Always use /sip proxied through nginx (WSS → WS to FreeSWITCH:5080)
    const wsUrl =
      user.wssUrl ||
      `wss://${window.location.host}/sip`;
    const socket = new JsSIP.WebSocketInterface(wsUrl);

    const configuration = {
      sockets:    [socket],
      uri:        `sip:${user.extension}@100.64.1.10`,
      password:   user.sipPassword,
      display_name: user.displayName,
      register:   true,
      session_timers: false,
      connection_recovery_min_interval: 2,
      connection_recovery_max_interval: 30,
    };

    this.ua = new JsSIP.UA(configuration);

    /* ── Transport events ─────────────────────────────────── */
    this.ua.on('connected', () => {
      console.log('[SIP] WebSocket connected');
      this._emitReg('connecting');
    });

    this.ua.on('disconnected', () => {
      console.log('[SIP] WebSocket disconnected');
      this._emitReg('idle');
    });

    /* ── Registration events ──────────────────────────────── */
    this.ua.on('registered', () => {
      console.log('[SIP] Registered as', user.extension);
      this._emitReg('registered');
    });

    this.ua.on('unregistered', () => {
      console.log('[SIP] Unregistered');
      this._emitReg('idle');
    });

    this.ua.on('registrationFailed', (data) => {
      console.warn('[SIP] Registration failed:', data.cause);
      this._emitReg('failed');
    });

    /* ── Session (incoming / outgoing) ───────────────────── */
    this.ua.on('newRTCSession', (data) => {
      const session = data.session;
      const fromRemote = data.originator === 'remote';

      // Store so answer() / hangup() / mute() work without extra wiring
      this.session = session;

      if (this.onNewRTCSession) {
        this.onNewRTCSession(session, data.originator);
      }

      session.on('progress', () => {
        console.log('[SIP] Call progress (ringing)');
        // Для входящего 180/183 не переводить в «исходящий дозвон» — иначе пропадает баннер с «Ответить».
        if (this.onCallStateChange) {
          this.onCallStateChange(fromRemote ? 'incoming' : 'ringing', session);
        }
      });

      session.on('accepted', () => {
        console.log('[SIP] Call accepted');
        if (this.onCallStateChange) this.onCallStateChange('active', session);
      });

      // 'confirmed' fires on 200 OK (outgoing); treat same as accepted
      session.on('confirmed', () => {
        if (this.onCallStateChange) this.onCallStateChange('active', session);
      });

      session.on('ended', () => {
        console.log('[SIP] Call ended');
        if (this.onCallStateChange) this.onCallStateChange('ended', null);
        this.session = null;
      });

      session.on('failed', (reason) => {
        console.warn('[SIP] Call failed:', reason?.cause ?? reason);
        if (this.onCallStateChange) this.onCallStateChange('failed', null);
        this.session = null;
      });

      // Attach remote audio stream automatically
      session.on('peerconnection', (pc) => {
        pc.peerconnection.addEventListener('track', (event) => {
          if (event.track.kind === 'audio') {
            let audio = document.getElementById('__sip_audio__');
            if (!audio) {
              audio = document.createElement('audio');
              audio.id = '__sip_audio__';
              audio.autoplay = true;
              document.body.appendChild(audio);
            }
            audio.srcObject = event.streams[0];
          }
        });
      });
    });

    this.ua.start();
    return this.ua;
  }

  /* ── Outgoing call ──────────────────────────────────────── */
  call(extension) {
    if (!this.ua) {
      throw new Error('Нет подключения к АТС');
    }
    // После регистрации WebSocket уже рабочий; isConnected() иногда false в коротком окне после переподключения.
    const ready =
      typeof this.ua.isRegistered === 'function'
        ? this.ua.isRegistered()
        : this.ua.isConnected();
    if (!ready) {
      throw new Error('SIP не готов — дождитесь статуса «На линии»');
    }

    const options = {
      mediaConstraints: { audio: true, video: false },
      rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
      pcConfig: defaultPcConfig()
    };

    try {
      this.ua.call(`sip:${extension}@100.64.1.10`, options);
    } catch (e) {
      console.error('[SIP] ua.call failed:', e);
      throw e;
    }
  }

  /* ── Answer incoming ────────────────────────────────────── */
  answer() {
    if (this.session) {
      this.session.answer({
        mediaConstraints: { audio: true, video: false },
        pcConfig: defaultPcConfig()
      });
    }
  }

  /* ── Terminate (hangup / reject) ────────────────────────── */
  hangup() {
    if (this.session) {
      try { this.session.terminate(); } catch (_) { /* already ended */ }
      this.session = null;
    }
  }

  /* ── Mute / unmute local audio ──────────────────────────── */
  mute(muted) {
    if (!this.session?.connection) return;
    this.session.connection
      .getSenders()
      .filter((s) => s.track?.kind === 'audio')
      .forEach((s) => { s.track.enabled = !muted; });
  }

  /* ── DTMF ────────────────────────────────────────────────── */
  sendDTMF(digit) {
    if (this.session) {
      try { this.session.sendDTMF(digit); } catch (e) {
        console.warn('[SIP] DTMF error:', e);
      }
    }
  }

  /* ── Stop UA completely ──────────────────────────────────── */
  disconnect() {
    if (this.ua) {
      try { this.ua.stop(); } catch (_) { /* ignore */ }
      this.ua = null;
    }
    this.session = null;
  }

  /* ── Callback setters ────────────────────────────────────── */
  setOnCallStateChange(cb)    { this.onCallStateChange    = cb; }
  setOnNewRTCSession(cb)      { this.onNewRTCSession      = cb; }
  setOnRegistrationChange(cb) { this.onRegistrationChange = cb; }

  /* ── Private ─────────────────────────────────────────────── */
  _emitReg(status) {
    if (this.onRegistrationChange) this.onRegistrationChange(status);
  }
}

export default new WebRTCService();
