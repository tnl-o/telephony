import { useState, useEffect, useRef, useCallback } from 'react';
import JsSIP from 'jssip';

const MAX_HISTORY = 20;
const BACKOFF_BASE_MS = 2000;
const BACKOFF_MAX_MS = 30000;

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function ensureRemoteAudioEl(audioRef) {
  if (typeof document === 'undefined') return null;
  if (audioRef.current) return audioRef.current;
  let el = document.getElementById('remote-audio');
  if (!el) {
    el = document.createElement('audio');
    el.id = 'remote-audio';
    el.setAttribute('playsinline', '');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  audioRef.current = el;
  return el;
}

function bindRemoteAudio(peerconnection, audioEl) {
  if (!audioEl || !peerconnection) return;

  const playStream = (stream) => {
    if (!stream?.getAudioTracks?.().length) return;
    audioEl.srcObject = stream;
    void audioEl.play().catch(() => {});
  };

  peerconnection.addEventListener('track', (ev) => {
    if (ev.track.kind === 'audio') {
      playStream(ev.streams[0] ?? new MediaStream([ev.track]));
    }
  });

  peerconnection.addEventListener('addstream', (ev) => {
    playStream(ev.stream);
  });

  try {
    peerconnection.getReceivers?.()?.forEach?.((receiver) => {
      if (receiver.track?.kind === 'audio' && receiver.track.readyState === 'live') {
        playStream(new MediaStream([receiver.track]));
      }
    });
  } catch {
    /* ignore */
  }
}

/**
 * SIP/WebRTC hook — direct connection to PBX WebSocket. No backend.
 *
 * @param {{ extension: string, sipPassword: string, pbxWssUrl: string } | null} config
 */
export default function usePhone(config) {
  const [status, setStatus] = useState('idle');
  const [currentCall, setCurrentCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const uaRef = useRef(null);
  const retryTimerRef = useRef(null);
  const retryCountRef = useRef(0);
  const sipDomainRef = useRef('');
  const callStartTimeRef = useRef(null);
  const durationTimerRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => () => {
    const el = remoteAudioRef.current;
    if (el?.parentNode) el.parentNode.removeChild(el);
    remoteAudioRef.current = null;
  }, []);

  useEffect(() => {
    if (currentCall && callStartTimeRef.current) {
      durationTimerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
      }, 1000);
    }
    return () => {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
      setCallDuration(0);
    };
  }, [currentCall]);

  const pushHistory = useCallback((entry) => {
    const entryWithId = {
      ...entry,
      id: crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2),
    };
    setCallHistory((prev) => [entryWithId, ...prev].slice(0, MAX_HISTORY));
  }, []);

  const getBackoffDelay = useCallback(() => {
    const delay = Math.min(BACKOFF_BASE_MS * 2 ** retryCountRef.current, BACKOFF_MAX_MS);
    retryCountRef.current += 1;
    return delay;
  }, []);

  const endCall = useCallback((session, type, wasAnswered) => {
    clearInterval(durationTimerRef.current);
    durationTimerRef.current = null;
    const durationSec = callStartTimeRef.current
      ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
      : 0;

    pushHistory({
      type: type === 'incoming' && !wasAnswered ? 'missed' : type,
      number: session.remote_identity?.uri?.user ?? 'Unknown',
      duration: formatDuration(durationSec),
      timestamp: new Date().toISOString(),
    });

    callStartTimeRef.current = null;
    setCurrentCall(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsOnHold(false);
  }, [pushHistory]);

  useEffect(() => {
    if (!config?.extension || !config?.sipPassword || !config?.pbxWssUrl) {
      setStatus('idle');
      sipDomainRef.current = '';
      return;
    }

    JsSIP.debug.disable('JsSIP:*');

    let hostname;
    try {
      hostname = new URL(config.pbxWssUrl).hostname;
    } catch {
      setStatus('failed');
      return;
    }

    sipDomainRef.current = hostname;

    const socket = new JsSIP.WebSocketInterface(config.pbxWssUrl);

    const ua = new JsSIP.UA({
      sockets: [socket],
      uri: `sip:${config.extension}@${hostname}`,
      password: config.sipPassword,
      display_name: config.extension,
      register: true,
      register_expires: 300,
      session_timers: false,
      no_answer_timeout: 60,
    });

    uaRef.current = ua;
    setStatus('connecting');

    ua.on('connected', () => setStatus('connecting'));

    ua.on('disconnected', () => {
      setStatus('failed');
      clearTimeout(retryTimerRef.current);
      const delay = getBackoffDelay();
      retryTimerRef.current = setTimeout(() => {
        const u = uaRef.current;
        if (u && !u.isStopped()) u.start();
      }, delay);
    });

    ua.on('registered', () => {
      setStatus('registered');
      retryCountRef.current = 0;
      clearTimeout(retryTimerRef.current);
    });

    ua.on('unregistered', () => {
      setStatus((prev) => (prev === 'failed' ? 'failed' : 'idle'));
    });

    ua.on('registrationFailed', (data) => {
      setStatus('failed');
      clearTimeout(retryTimerRef.current);
      const code = data.response?.status_code;
      const noRetry = code === 401 || code === 403 || code === 404;
      if (noRetry) return;
      const delay = getBackoffDelay();
      retryTimerRef.current = setTimeout(() => {
        const u = uaRef.current;
        if (u && !u.isStopped()) {
          setStatus('connecting');
          u.register();
        }
      }, delay);
    });

    ua.on('newRTCSession', ({ session, originator }) => {
      const callType = originator === 'remote' ? 'incoming' : 'outgoing';
      let answered = false;

      session.on('peerconnection', ({ peerconnection }) => {
        bindRemoteAudio(peerconnection, ensureRemoteAudioEl(remoteAudioRef));
      });

      if (callType === 'incoming') {
        setIncomingCall(session);
      } else {
        callStartTimeRef.current = Date.now();
        setCurrentCall(session);
      }

      session.on('accepted', () => {
        answered = true;
        callStartTimeRef.current = Date.now();
        if (callType === 'incoming') {
          setIncomingCall(null);
          setCurrentCall(session);
        }
      });

      session.on('confirmed', () => {
        answered = true;
        if (!callStartTimeRef.current) callStartTimeRef.current = Date.now();
      });

      session.on('ended', () => endCall(session, callType, answered));
      session.on('failed', () => endCall(session, callType, answered));
      session.on('hold', () => setIsOnHold(true));
      session.on('unhold', () => setIsOnHold(false));
      session.on('muted', () => setIsMuted(true));
      session.on('unmuted', () => setIsMuted(false));
    });

    ua.start();

    return () => {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      try {
        ua.stop();
      } catch {
        /* ignore */
      }
      uaRef.current = null;
      sipDomainRef.current = '';
      setStatus('idle');
      setCurrentCall(null);
      setIncomingCall(null);
    };
  }, [config?.extension, config?.sipPassword, config?.pbxWssUrl, endCall, getBackoffDelay]);

  const makeCall = useCallback(
    (number) => {
      if (!uaRef.current || status !== 'registered') return;
      const host = sipDomainRef.current;
      if (!host) return;
      uaRef.current.call(`sip:${number}@${host}`, {
        mediaConstraints: { audio: true, video: false },
        rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
      });
    },
    [status],
  );

  const answerCall = useCallback(() => {
    if (!incomingCall) return;
    incomingCall.answer({
      mediaConstraints: { audio: true, video: false },
    });
  }, [incomingCall]);

  const rejectCall = useCallback(() => {
    if (!incomingCall) return;
    incomingCall.terminate({ status_code: 486, reason_phrase: 'Busy Here' });
    setIncomingCall(null);
  }, [incomingCall]);

  const hangup = useCallback(() => {
    if (!currentCall) return;
    try {
      currentCall.terminate();
    } catch {
      setCurrentCall(null);
    }
  }, [currentCall]);

  const sendDTMF = useCallback((tone) => {
    if (!currentCall) return;
    try {
      currentCall.sendDTMF(tone, { duration: 100, interToneGap: 70 });
    } catch {
      /* ignore */
    }
  }, [currentCall]);

  const toggleMute = useCallback(() => {
    if (!currentCall) return;
    if (isMuted) currentCall.unmute({ audio: true });
    else currentCall.mute({ audio: true });
  }, [currentCall, isMuted]);

  const toggleHold = useCallback(() => {
    if (!currentCall) return;
    if (isOnHold) currentCall.unhold();
    else currentCall.hold();
  }, [currentCall, isOnHold]);

  return {
    status,
    currentCall,
    incomingCall,
    isMuted,
    isOnHold,
    callHistory,
    callDuration,
    makeCall,
    answerCall,
    rejectCall,
    hangup,
    sendDTMF,
    toggleMute,
    toggleHold,
  };
}
