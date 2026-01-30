/**
 * Cross-browser compatibility layer
 * Firefox uses 'browser' namespace, Chrome uses 'chrome'
 * This makes the code work on both
 */

// If we're in Firefox, 'browser' is already defined
// If we're in Chrome, create an alias
if (typeof browser === 'undefined') {
    globalThis.browser = chrome;
}
