import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  loadUserNotifications,
  saveUserNotifications,
  addUserNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteUserNotification,
  clearAllUserNotifications,
  loadAlertedBudgetTiers,
  saveAlertedBudgetTiers,
  loadNotificationSettings,
  saveNotificationSettings
} from '../utils/notificationStorage';
import {
  isBrowserNotificationSupported,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  sendBrowserNotification
} from '../utils/browserNotifications';
import { roundINR } from '../utils/calculations';
import { formatINR } from '../utils/formatters';

const NotificationContext = createContext(null);

const TIER_SEVERITY_ORDER = {
  safe: 0,
  warning_75: 1,
  warning_90: 2,
  budget_reached: 3,
  over_budget: 4
};

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id || 'demo';

  // 1. Visible active toasts
  const [toasts, setToasts] = useState([]);
  const recentToastsRef = useRef(new Map()); // Dedup cache: key -> timestamp

  // 2. Persistent notifications for active user
  const [notifications, setNotifications] = useState(() => loadUserNotifications(userId));

  // Reload notifications whenever user changes (User A vs User B isolation)
  useEffect(() => {
    setNotifications(loadUserNotifications(userId));
  }, [userId]);

  // 3. Browser notification settings
  const [browserSettings, setBrowserSettings] = useState(() => loadNotificationSettings(userId));
  const [browserPermission, setBrowserPermission] = useState(() => getBrowserNotificationPermission());

  useEffect(() => {
    setBrowserSettings(loadNotificationSettings(userId));
    setBrowserPermission(getBrowserNotificationPermission());
  }, [userId]);

  // Alerted budget tiers memory: category -> tier name
  const alertedTiersRef = useRef({});
  const hasInitializedTiersRef = useRef(false);

  // Load alerted tiers for this user
  useEffect(() => {
    hasInitializedTiersRef.current = false;
    alertedTiersRef.current = loadAlertedBudgetTiers(userId, '2026-10');
  }, [userId]);

  // Unread count
  const unreadCount = notifications.filter((n) => !n.read).length;

  // ---------------------------------------------------------------------------
  // Toast Operations
  // ---------------------------------------------------------------------------

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(({ type = 'info', title = '', message = '', duration }) => {
    if (!message && !title) return null;

    // Deduplication check: prevent identical toast within 3 seconds
    const dedupKey = `${type}:${title}:${message}`;
    const now = Date.now();
    const lastShown = recentToastsRef.current.get(dedupKey);
    if (lastShown && now - lastShown < 3000) {
      return null; // Suppress duplicate
    }
    recentToastsRef.current.set(dedupKey, now);

    // Clean old dedup keys periodically
    if (recentToastsRef.current.size > 50) {
      for (const [k, ts] of recentToastsRef.current.entries()) {
        if (now - ts > 10000) recentToastsRef.current.delete(k);
      }
    }

    const toastId = `toast_${now}_${Math.random().toString(36).substr(2, 5)}`;
    // Auto-dismiss duration: 4.5s for success/info, 6.5s for warnings/errors
    const autoDismissMs = duration || (type === 'danger' || type === 'warning' ? 6500 : 4500);

    const newToast = {
      id: toastId,
      type,
      title,
      message,
      duration: autoDismissMs,
      createdAt: now
    };

    setToasts((prev) => {
      // Limit to 4 simultaneous toasts on screen to prevent viewport crowding
      const capped = prev.length >= 4 ? prev.slice(prev.length - 3) : prev;
      return [...capped, newToast];
    });

    if (autoDismissMs > 0) {
      setTimeout(() => {
        dismissToast(toastId);
      }, autoDismissMs);
    }

    return toastId;
  }, [dismissToast]);

  // ---------------------------------------------------------------------------
  // Notification Operations
  // ---------------------------------------------------------------------------

  const addNotification = useCallback(({
    type = 'info',
    title = '',
    message = '',
    category = null,
    metadata = null,
    showAsToast = true,
    duration
  }) => {
    const created = addUserNotification(userId, {
      type,
      title,
      message,
      category,
      metadata,
      timestamp: Date.now(),
      read: false
    });

    // Update in-memory notifications
    setNotifications((prev) => [created, ...prev]);

    // Show toast if requested
    if (showAsToast) {
      showToast({ type, title, message, duration });
    }

    // Trigger browser notification if enabled and allowed
    if (browserSettings.browserEnabled && browserPermission === 'granted') {
      sendBrowserNotification(title || 'FinTrack Alert', {
        body: message,
        tag: category ? `budget_${category}` : 'fintrack_alert'
      });
    }

    return created;
  }, [userId, showToast, browserSettings.browserEnabled, browserPermission]);

  const markAsRead = useCallback((notifId) => {
    const updated = markNotificationAsRead(userId, notifId);
    setNotifications(updated);
  }, [userId]);

  const markAllAsRead = useCallback(() => {
    const updated = markAllNotificationsAsRead(userId);
    setNotifications(updated);
  }, [userId]);

  const removeNotification = useCallback((notifId) => {
    const updated = deleteUserNotification(userId, notifId);
    setNotifications(updated);
  }, [userId]);

  const clearAllNotifications = useCallback(() => {
    clearAllUserNotifications(userId);
    setNotifications([]);
  }, [userId]);

  // ---------------------------------------------------------------------------
  // Browser Notifications Management
  // ---------------------------------------------------------------------------

  const requestBrowserPermission = useCallback(async () => {
    const perm = await requestBrowserNotificationPermission();
    setBrowserPermission(perm);
    if (perm === 'granted') {
      const updated = { ...browserSettings, browserEnabled: true };
      setBrowserSettings(updated);
      saveNotificationSettings(userId, updated);
      showToast({
        type: 'success',
        title: 'Browser Notifications Enabled',
        message: 'You will receive instant desktop alerts for budget warnings while FinTrack is open.'
      });
    } else if (perm === 'denied') {
      const updated = { ...browserSettings, browserEnabled: false };
      setBrowserSettings(updated);
      saveNotificationSettings(userId, updated);
      showToast({
        type: 'warning',
        title: 'Notifications Blocked',
        message: 'Browser notifications were blocked. Please enable permissions in your browser address bar settings.'
      });
    }
    return perm;
  }, [userId, browserSettings, showToast]);

  const toggleBrowserNotifications = useCallback((enable) => {
    const updated = { ...browserSettings, browserEnabled: Boolean(enable) };
    setBrowserSettings(updated);
    saveNotificationSettings(userId, updated);
  }, [userId, browserSettings]);

  // ---------------------------------------------------------------------------
  // Budget Threshold Crossings Engine
  // ---------------------------------------------------------------------------

  /**
   * Evaluates current expenses against budgets for activeMonth.
   * Compares with previously recorded tier to detect new threshold crossings.
   *
   * Threshold tiers:
   * - safe (< 75%)
   * - warning_75 (75% to 89.9%) -> Heads-up (info)
   * - warning_90 (90% to 99.9%) -> Strong warning (warning)
   * - budget_reached (100% exact) -> Limit reached (warning)
   * - over_budget (> 100%) -> Overspending (danger)
   */
  const evaluateBudgetThresholdCrossings = useCallback(({
    transactions = [],
    budgets = [],
    activeMonth = '2026-10',
    isInitialLoad = false
  }) => {
    if (!Array.isArray(budgets) || budgets.length === 0) return {};

    // 1. Aggregate actual expense spending for the activeMonth
    // STRICT RULE: Only type === 'expense' counts as spending. Income is never counted.
    const spentByCategory = {};
    (transactions || []).forEach((t) => {
      if (t && t.type === 'expense' && t.date && t.date.startsWith(activeMonth)) {
        const cat = t.category || 'General & Miscellaneous';
        spentByCategory[cat] = (spentByCategory[cat] || 0) + (Math.abs(Number(t.amount)) || 0);
      }
    });

    const currentSavedTiers = alertedTiersRef.current || {};
    const updatedTiers = { ...currentSavedTiers };

    budgets.forEach((b) => {
      if (!b || !b.category) return;
      const limit = Math.max(0, Number(b.allocatedAmount) || 0);
      if (limit <= 0) return;

      const spent = roundINR(spentByCategory[b.category] || 0);
      const ratio = spent / limit;
      const percentUsed = roundINR(ratio * 100);
      const remaining = roundINR(limit - spent);
      const exceededBy = spent > limit ? roundINR(spent - limit) : 0;

      let currentTier = 'safe';
      if (spent > limit) {
        currentTier = 'over_budget';
      } else if (spent === limit) {
        currentTier = 'budget_reached';
      } else if (ratio >= 0.90) {
        currentTier = 'warning_90';
      } else if (ratio >= 0.75) {
        currentTier = 'warning_75';
      }

      const prevTier = currentSavedTiers[b.category] || 'safe';
      const prevRank = TIER_SEVERITY_ORDER[prevTier] ?? 0;
      const currentRank = TIER_SEVERITY_ORDER[currentTier] ?? 0;

      // On initial page load / refresh: NEVER trigger toasts!
      // Simply sync the recorded tier state so page refresh doesn't spam toasts.
      if (isInitialLoad || !hasInitializedTiersRef.current) {
        updatedTiers[b.category] = currentTier;
        return;
      }

      // If spending increased into a higher threshold tier: Trigger alert!
      if (currentRank > prevRank) {
        let alertType = 'warning';
        let alertTitle = `${b.category}: Budget Alert`;
        let alertMessage = '';

        const displayPercent = Math.round(ratio * 100);
        const formatCompact = (val) => formatINR(val, val % 1 !== 0);

        if (currentTier === 'over_budget') {
          alertType = 'danger';
          alertTitle = `${b.category}: Budget Exceeded`;
          alertMessage = `Budget exceeded by ${formatCompact(exceededBy)}.`;
        } else if (currentTier === 'budget_reached') {
          alertType = 'warning';
          alertTitle = `${b.category}: Budget Reached`;
          alertMessage = `Monthly budget of ${formatCompact(limit)} reached (100%).`;
        } else if (currentTier === 'warning_90') {
          alertType = 'warning';
          alertTitle = `${b.category}: Budget Warning`;
          alertMessage = `You've used ${displayPercent}% of your monthly budget. ${formatCompact(remaining)} remains.`;
        } else if (currentTier === 'warning_75') {
          alertType = 'info';
          alertTitle = `${b.category}: Budget Heads-Up`;
          alertMessage = `You've used ${displayPercent}% of your monthly budget. ${formatCompact(remaining)} remains.`;
        }

        addNotification({
          type: alertType,
          title: alertTitle,
          message: alertMessage,
          category: b.category,
          metadata: {
            spent,
            limit,
            percentUsed,
            remaining,
            exceededBy,
            tier: currentTier,
            month: activeMonth
          },
          showAsToast: true
        });

        updatedTiers[b.category] = currentTier;
      } else if (currentRank < prevRank) {
        // If spending decreased (e.g. transaction deleted or edited downward),
        // adjust recorded tier so next time it crosses upward it will alert again.
        updatedTiers[b.category] = currentTier;
      }
    });

    alertedTiersRef.current = updatedTiers;
    saveAlertedBudgetTiers(userId, activeMonth, updatedTiers);
    hasInitializedTiersRef.current = true;
    return updatedTiers;
  }, [userId, addNotification]);

  const value = {
    toasts,
    showToast,
    dismissToast,
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
    browserSettings,
    browserPermission,
    requestBrowserPermission,
    toggleBrowserNotifications,
    evaluateBudgetThresholdCrossings
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
