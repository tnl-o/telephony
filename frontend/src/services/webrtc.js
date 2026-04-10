import JsSIP from 'jssip';

class WebRTCService {
  constructor() {
    this.ua = null;
    this.session = null;
    this.onCallStateChange = null;
    this.onNewRTCSession = null;
  }

  connect(user) {
    const socket = new JsSIP.WebSocketInterface(`wss://${window.location.hostname}:7443`);
    
    const configuration = {
      sockets: [socket],
      uri: `sip:${user.extension}@100.64.0.10`,
      password: user.sipPassword,
      display_name: user.displayName,
      register: true,
      session_timers: false,
      connection_recovery_min_interval: 2,
      connection_recovery_max_interval: 30,
    };

    this.ua = new JsSIP.UA(configuration);

    this.ua.on('connected', () => {
      console.log('Connected to FreeSWITCH');
    });

    this.ua.on('disconnected', () => {
      console.log('Disconnected from FreeSWITCH');
    });

    this.ua.on('registered', () => {
      console.log('Registered as', user.extension);
    });

    this.ua.on('unregistered', () => {
      console.log('Unregistered');
    });

    this.ua.on('newRTCSession', (data) => {
      const session = data.session;
      
      if (this.onNewRTCSession) {
        this.onNewRTCSession(session);
      }

      session.on('accepted', () => {
        console.log('Call accepted');
        if (this.onCallStateChange) this.onCallStateChange('active', session);
      });

      session.on('ended', () => {
        console.log('Call ended');
        if (this.onCallStateChange) this.onCallStateChange('ended', null);
        this.session = null;
      });

      session.on('failed', (reason) => {
        console.log('Call failed:', reason);
        if (this.onCallStateChange) this.onCallStateChange('failed', null);
        this.session = null;
      });

      session.on('progress', () => {
        console.log('Call in progress (ringing)');
        if (this.onCallStateChange) this.onCallStateChange('ringing', session);
      });

      // Auto-answer incoming calls if needed, or show UI
      if (!session.direction || session.direction === 'incoming') {
        // Incoming call - wait for user action or auto-answer
        console.log('Incoming call from', session.remote_identity.display_name || session.remote_identity.uri.user);
      }
    });

    this.ua.start();
    return this.ua;
  }

  call(extension) {
    if (!this.ua || !this.ua.isReady()) {
      throw new Error('WebRTC not connected');
    }

    const eventHandlers = {
      'progress': (e) => console.log('Ringing'),
      'failed': (e) => console.log('Call failed:', e),
      'confirmed': (e) => console.log('Call confirmed'),
    };

    const options = {
      eventHandlers: eventHandlers,
      mediaConstraints: { audio: true, video: false },
      rtcOfferConstraints: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      },
    };

    this.ua.call(`sip:${extension}@100.64.0.10`, options);
  }

  answer() {
    if (this.session) {
      this.session.answer({
        mediaConstraints: { audio: true, video: false },
      });
    }
  }

  hangup() {
    if (this.session) {
      this.session.terminate();
      this.session = null;
    }
  }

  mute(muted) {
    if (this.session && this.session.connection) {
      const track = this.session.connection.getLocalTracks().find(t => t.kind === 'audio');
      if (track) {
        track.enabled = !muted;
      }
    }
  }

  setOnCallStateChange(callback) {
    this.onCallStateChange = callback;
  }

  setOnNewRTCSession(callback) {
    this.onNewRTCSession = callback;
  }

  disconnect() {
    if (this.ua) {
      this.ua.stop();
      this.ua = null;
    }
  }
}

export default new WebRTCService();
