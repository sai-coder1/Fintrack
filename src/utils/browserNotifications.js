/**
 * FinTrack — Browser Web Notifications Utility
 *
 * Provides safe, user-permissioned browser notification handling.
 * - Requests permission strictly upon explicit user interaction (never on page load).
 * - Honest disclaimer: only delivers desktop alerts while the app tab is open.
 * - Graceful fallback when the Notification API is unsupported.
 */

/**
 * Checks whether the Web Notifications API is supported in the current environment.
 * @returns {boolean}
 */
export function isBrowserNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Returns current permission status: 'granted' | 'denied' | 'default' | 'unsupported'
 * @returns {string}
 */
export function getBrowserNotificationPermission() {
  if (!isBrowserNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Requests browser notification permission.
 * MUST be invoked in response to a direct user action (e.g. button click).
 * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
 */
export async function requestBrowserNotificationPermission() {
  if (!isBrowserNotificationSupported()) {
    return 'unsupported';
  }

  try {
    const result = await Notification.requestPermission();
    return result;
  } catch (err) {
    console.error('[FinTrack Notifications] Error requesting permission:', err);
    return Notification.permission || 'denied';
  }
}

/**
 * Dispatches an in-browser desktop notification if permission is granted.
 * @param {string} title
 * @param {object} [options]
 * @returns {Notification|null}
 */
export function sendBrowserNotification(title, options = {}) {
  if (!isBrowserNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notif = new Notification(title, {
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      ...options
    });

    notif.onclick = () => {
      if (typeof window !== 'undefined' && window.focus) {
        window.focus();
      }
      notif.close();
    };

    return notif;
  } catch (err) {
    console.warn('[FinTrack Notifications] Failed to create browser notification:', err);
    return null;
  }
}
