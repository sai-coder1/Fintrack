/**
 * FinTrack — Notification Storage & Isolation Utility
 *
 * Scopes all persisted notifications and budget threshold alert states
 * strictly to the currently authenticated user (or 'demo' in demo mode).
 * Zero cross-user data bleeding.
 */

const STORAGE_PREFIX = 'fintrack_notif_';
const TIERS_PREFIX = 'fintrack_budget_tiers_';
const SETTINGS_PREFIX = 'fintrack_notif_settings_';

/**
 * Normalizes a user ID into a safe storage key segment
 * @param {string|null} userId
 * @returns {string}
 */
export function getScopedUserKey(userId) {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return 'anonymous';
  }
  return userId.trim();
}

/**
 * Loads persisted notifications for the given user.
 * @param {string} userId
 * @returns {Array<object>}
 */
export function loadUserNotifications(userId) {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const key = `${STORAGE_PREFIX}${getScopedUserKey(userId)}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[FinTrack Notifications] Failed to load notifications:', err);
    return [];
  }
}

/**
 * Saves notifications list for the given user.
 * @param {string} userId
 * @param {Array<object>} notifications
 */
export function saveUserNotifications(userId, notifications) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const key = `${STORAGE_PREFIX}${getScopedUserKey(userId)}`;
  try {
    const safeList = Array.isArray(notifications) ? notifications.slice(0, 100) : []; // Cap at 100 items
    window.localStorage.setItem(key, JSON.stringify(safeList));
  } catch (err) {
    console.error('[FinTrack Notifications] Failed to save notifications:', err);
  }
}

/**
 * Adds a new notification for the given user.
 * @param {string} userId
 * @param {object} notifData
 * @returns {object} The created notification object
 */
export function addUserNotification(userId, notifData) {
  const current = loadUserNotifications(userId);
  const newNotif = {
    id: notifData.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type: notifData.type || 'info', // 'success' | 'info' | 'warning' | 'danger'
    title: notifData.title || '',
    message: notifData.message || '',
    category: notifData.category || null,
    timestamp: notifData.timestamp || Date.now(),
    read: Boolean(notifData.read),
    metadata: notifData.metadata || null
  };

  const updated = [newNotif, ...current];
  saveUserNotifications(userId, updated);
  return newNotif;
}

/**
 * Marks a specific notification as read.
 * @param {string} userId
 * @param {string} notifId
 * @returns {Array<object>} Updated list
 */
export function markNotificationAsRead(userId, notifId) {
  const current = loadUserNotifications(userId);
  const updated = current.map((n) => (n.id === notifId ? { ...n, read: true } : n));
  saveUserNotifications(userId, updated);
  return updated;
}

/**
 * Marks all notifications for a user as read.
 * @param {string} userId
 * @returns {Array<object>} Updated list
 */
export function markAllNotificationsAsRead(userId) {
  const current = loadUserNotifications(userId);
  const updated = current.map((n) => ({ ...n, read: true }));
  saveUserNotifications(userId, updated);
  return updated;
}

/**
 * Deletes a single notification for a user.
 * @param {string} userId
 * @param {string} notifId
 * @returns {Array<object>} Updated list
 */
export function deleteUserNotification(userId, notifId) {
  const current = loadUserNotifications(userId);
  const updated = current.filter((n) => n.id !== notifId);
  saveUserNotifications(userId, updated);
  return updated;
}

/**
 * Clears all notifications for a user.
 * @param {string} userId
 */
export function clearAllUserNotifications(userId) {
  saveUserNotifications(userId, []);
}

/**
 * Loads previously recorded budget threshold tiers for a user and month.
 * e.g. { "Food & Dining Out": "warning_90", "Groceries": "safe" }
 * @param {string} userId
 * @param {string} month
 * @returns {Record<string, string>}
 */
export function loadAlertedBudgetTiers(userId, month) {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  const key = `${TIERS_PREFIX}${getScopedUserKey(userId)}_${month || 'current'}`;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves recorded budget threshold tiers for a user and month.
 * @param {string} userId
 * @param {string} month
 * @param {Record<string, string>} tiers
 */
export function saveAlertedBudgetTiers(userId, month, tiers) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const key = `${TIERS_PREFIX}${getScopedUserKey(userId)}_${month || 'current'}`;
  try {
    window.localStorage.setItem(key, JSON.stringify(tiers || {}));
  } catch (err) {
    console.error('[FinTrack Notifications] Failed to save alerted tiers:', err);
  }
}

/**
 * Loads notification preferences for a user.
 * @param {string} userId
 * @returns {object}
 */
export function loadNotificationSettings(userId) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { browserEnabled: false };
  }
  const key = `${SETTINGS_PREFIX}${getScopedUserKey(userId)}`;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : { browserEnabled: false };
  } catch {
    return { browserEnabled: false };
  }
}

/**
 * Saves notification preferences for a user.
 * @param {string} userId
 * @param {object} settings
 */
export function saveNotificationSettings(userId, settings) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const key = `${SETTINGS_PREFIX}${getScopedUserKey(userId)}`;
  try {
    window.localStorage.setItem(key, JSON.stringify(settings || {}));
  } catch (err) {
    console.error('[FinTrack Notifications] Failed to save settings:', err);
  }
}
