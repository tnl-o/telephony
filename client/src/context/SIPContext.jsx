import { createContext, useContext, useState, useCallback } from 'react';

/**
 * SIP Context — credentials in localStorage only (no backend).
 */
const SIPContext = createContext(null);

export function useSIPContext() {
  const ctx = useContext(SIPContext);
  if (!ctx) throw new Error('useSIPContext must be used within SIPProvider');
  return ctx;
}

const STORAGE_KEY = 'webrtc-phone-config';

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    const ok =
      typeof o?.extension === 'string' &&
      typeof o?.sipPassword === 'string' &&
      typeof o?.pbxWssUrl === 'string' &&
      o.extension.length > 0 &&
      o.sipPassword.length > 0 &&
      o.pbxWssUrl.length > 0;
    if (!ok) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return o;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

export function SIPProvider({ children }) {
  const [config, setConfig] = useState(loadConfig);

  const connect = useCallback((extension, sipPassword, pbxWssUrl) => {
    const cfg = { extension, sipPassword, pbxWssUrl };
    saveConfig(cfg);
    setConfig(cfg);
  }, []);

  const disconnect = useCallback(() => {
    clearConfig();
    setConfig(null);
  }, []);

  return (
    <SIPContext.Provider value={{ config, connect, disconnect }}>
      {children}
    </SIPContext.Provider>
  );
}
