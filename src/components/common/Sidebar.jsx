import React from 'react';
import { useFinance } from '../../hooks/useFinance';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard,
  Receipt,
  FileSpreadsheet,
  TrendingUp,
  PiggyBank,
  Sparkles,
  Settings,
  ShieldCheck,
  LogOut,
  X
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'import', label: 'CSV Import', icon: FileSpreadsheet },
  { id: 'analytics', label: 'Analytics & Forecasts', icon: TrendingUp },
  { id: 'budgets', label: 'Budgets & Goals', icon: PiggyBank },
  { id: 'simulator', label: 'Affordability Simulator', icon: Sparkles },
  { id: 'settings', label: 'Data & Settings', icon: Settings }
];

export function Sidebar({ isOpen, onClose }) {
  const { currentPage, setCurrentPage } = useFinance();
  const { user, profile, signOut } = useAuth();

  const displayName = profile?.full_name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    (user?.email ? user.email.split('@')[0] : 'User');
  const avatarLetter = (displayName.charAt(0) || 'U').toUpperCase();

  const handleNavClick = (pageId) => {
    setCurrentPage(pageId);
    if (onClose) {
      onClose();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setCurrentPage('landing');
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      <div
        className={`sidebar-backdrop ${isOpen ? 'active' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-link">
            <div className="brand-logo-icon">
              <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>₹</span>
            </div>
            <div>
              <span className="brand-title">FinTrack</span>
              <span className="brand-subtitle-badge">Fintech Assistant</span>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              className="btn btn-ghost btn-sm mobile-menu-btn"
              onClick={onClose}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav-container">
          <span className="nav-section-label">Main Menu</span>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                <Icon className="nav-item-icon" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div
              style={{
                marginBottom: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0, overflow: 'hidden' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--soft-indigo-bg)',
                    color: 'var(--primary-indigo)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700
                  }}
                >
                  {avatarLetter}
                </div>
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {displayName}
                  </div>
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {user.email}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon-only"
                onClick={handleSignOut}
                title="Sign Out"
                aria-label="Sign out of FinTrack"
                style={{ color: 'var(--expense-rose)', flexShrink: 0 }}
              >
                <LogOut size={15} />
              </button>
            </div>
          )}

          <div className="sidebar-card-helper">
            <div className="flex items-center gap-2" style={{ color: 'var(--primary-indigo)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>
              <ShieldCheck size={14} />
              <span>100% Private &amp; Local</span>
            </div>
            <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              Your bank statements never leave your browser. Zero cloud tracking.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
