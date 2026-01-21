/**
 * Logger utility for Service Worker context
 * Note: This runs in both content scripts AND service worker,
 * so we must avoid window/document references
 */
const X4Logger = {
  debugMode: true,

  log(...args) {
    if (this.debugMode) {
      console.log('[X4-Send]', ...args);
    }
  },

  error(...args) {
    console.error('[X4-Send ERROR]', ...args);
  },

  warn(...args) {
    console.warn('[X4-Send WARN]', ...args);
  },

  info(...args) {
    console.info('[X4-Send]', ...args);
  },

  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log('[X4-Send] Debug mode:', enabled ? 'ON' : 'OFF');
  }
};

// Log initialization - check if we're in content script or service worker
try {
  if (typeof window !== 'undefined') {
    console.log('[X4-Send] ✅ Content script loaded on:', window.location.href);
  } else {
    console.log('[X4-Send] ✅ Logger loaded in service worker context');
  }
} catch (e) {
  console.log('[X4-Send] ✅ Logger loaded');
}
