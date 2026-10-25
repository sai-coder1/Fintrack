import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useFinance } from '../../hooks/useFinance';
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  BellOff,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

const ICON_MAP = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  info: Info
};

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Just now';
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (elapsedSeconds < 60) return 'Just now';
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d ago`;
  return new Date(timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
    browserSettings,
    browserPermission,
    requestBrowserPermission
  } = useNotifications();

  const { setCurrentPage } = useFinance();
  const [isOpen, setIsOpen] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'unread'
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  // Close panel on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const displayedNotifications = filterMode === 'unread'
    ? notifications.filter((n) => !n.read)
    : notifications;

  const handleNotificationClick = (notif) => {
    if (!notif.read) {
      markAsRead(notif.id);
    }
    // Navigate to budgets or transactions if category action is relevant
    if (notif.category && notif.category !== 'CSV Import') {
      setCurrentPage('budgets');
      setIsOpen(false);
    } else if (notif.category === 'CSV Import') {
      setCurrentPage('transactions');
      setIsOpen(false);
    }
  };

  return (
    <div className="notification-center-wrapper">
      {/* Bell Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        className={`notification-bell-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notification-badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="notification-panel"
          role="dialog"
          aria-label="Notification center"
        >
          {/* Panel Header */}
          <div className="notification-panel-header">
            <div className="flex items-center gap-2">
              <h3 className="notification-panel-title">Notifications</h3>
              {unreadCount > 0 && (
                <span className="notification-unread-pill">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  aria-label="Mark all notifications as read"
                >
                  <CheckCheck size={14} />
                  <span className="hide-on-mobile">Mark read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-rose"
                  onClick={clearAllNotifications}
                  title="Clear all notifications"
                  aria-label="Clear all notifications"
                >
                  <Trash2 size={13} />
                  <span className="hide-on-mobile">Clear all</span>
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-icon-only"
                onClick={() => setIsOpen(false)}
                aria-label="Close notification panel"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Filter Bar (All vs Unread) */}
          {notifications.length > 0 && (
            <div className="notification-filter-tabs">
              <button
                type="button"
                className={`notification-tab-btn ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                className={`notification-tab-btn ${filterMode === 'unread' ? 'active' : ''}`}
                onClick={() => setFilterMode('unread')}
              >
                Unread ({unreadCount})
              </button>
            </div>
          )}

          {/* Notification List Container */}
          <div className="notification-list">
            {displayedNotifications.length === 0 ? (
              <div className="notification-empty-state">
                <div className="notification-empty-icon">
                  <BellOff size={28} />
                </div>
                <h4 style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)' }}>
                  {filterMode === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </h4>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {filterMode === 'unread'
                    ? "You've read all your notifications!"
                    : "You're all caught up! Real-time alerts for budget thresholds and transactions will appear here."}
                </p>
              </div>
            ) : (
              displayedNotifications.map((notif) => {
                const IconComponent = ICON_MAP[notif.type] || Info;

                return (
                  <div
                    key={notif.id}
                    className={`notification-item ${!notif.read ? 'unread' : ''}`}
                    onClick={() => handleNotificationClick(notif)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNotificationClick(notif);
                      }
                    }}
                  >
                    {!notif.read && <span className="notification-dot" aria-hidden="true" />}

                    <div className={`notification-item-icon notif-icon-${notif.type || 'info'}`}>
                      <IconComponent size={16} />
                    </div>

                    <div className="notification-item-body">
                      <div className="notification-item-top">
                        <span className="notification-item-title">{notif.title}</span>
                        <span className="notification-item-time">
                          {formatRelativeTime(notif.timestamp)}
                        </span>
                      </div>

                      <div className="notification-item-msg">{notif.message}</div>

                      <div className="notification-item-footer">
                        {notif.category && (
                          <span className="notification-item-cat">{notif.category}</span>
                        )}

                        <div className="notification-item-actions" onClick={(e) => e.stopPropagation()}>
                          {!notif.read && (
                            <button
                              type="button"
                              className="notif-action-btn"
                              onClick={() => markAsRead(notif.id)}
                              title="Mark as read"
                            >
                              Mark read
                            </button>
                          )}
                          <button
                            type="button"
                            className="notif-action-btn notif-action-dismiss"
                            onClick={() => removeNotification(notif.id)}
                            title="Dismiss notification"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Panel Footer / Disclosures */}
          <div className="notification-panel-footer">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Stored locally for your account • Zero cloud tracking
                </span>
                {!browserSettings.browserEnabled && browserPermission !== 'denied' && (
                  <button
                    type="button"
                    className="btn-link-action"
                    onClick={requestBrowserPermission}
                    style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary-indigo)' }}
                  >
                    Enable Browser Alerts
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
