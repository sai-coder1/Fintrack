import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const ICON_MAP = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  info: Info
};

export function ToastContainer() {
  const { toasts, dismissToast } = useNotifications();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="toast-container"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const IconComponent = ICON_MAP[toast.type] || Info;
        const isAlert = toast.type === 'danger';

        return (
          <div
            key={toast.id}
            className={`toast-item toast-${toast.type || 'info'}`}
            role={isAlert ? 'alert' : 'status'}
            aria-atomic="true"
          >
            <div className="toast-icon-wrapper">
              <IconComponent size={18} className="toast-icon" />
            </div>

            <div className="toast-content">
              {toast.title && <div className="toast-title">{toast.title}</div>}
              <div className="toast-message">{toast.message}</div>
            </div>

            <button
              type="button"
              className="toast-close-btn"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
