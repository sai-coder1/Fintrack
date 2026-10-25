import React from 'react';
import { useFinance } from '../../hooks/useFinance';
import { useAuth } from '../../hooks/useAuth';
import { Menu, Calendar, Coins, Sparkles, Plus, AlertTriangle, User as UserIcon } from 'lucide-react';
import { Badge } from './Badge';
import { Button } from './Button';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatMonthLabel(monthStr) {
  if (!monthStr || typeof monthStr !== 'string') return 'October 2026';
  const [year, month] = monthStr.split('-');
  const monthIdx = parseInt(month, 10) - 1;
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${MONTH_NAMES[monthIdx]} ${year}`;
  }
  return monthStr;
}

const PAGE_METADATA = {
  dashboard: {
    title: 'Financial Overview',
    subtitle: 'Daily cashflow, month-end projection, and budget pace'
  },
  transactions: {
    title: 'Transactions Ledger',
    subtitle: 'Track, categorize, search, and manage financial activity'
  },
  import: {
    title: 'CSV Bank Import',
    subtitle: 'Upload statements, map columns, and auto-detect duplicates'
  },
  analytics: {
    title: 'Analytics & Forecasts',
    subtitle: 'Spending trends, needs vs wants, and month-end trajectory'
  },
  budgets: {
    title: 'Budgets & Savings Goals',
    subtitle: 'Manage monthly spending caps and monitor goal pacing'
  },
  simulator: {
    title: 'Purchase Affordability Simulator',
    subtitle: 'Simulate financial impact before making purchasing decisions'
  },
  settings: {
    title: 'Data & Settings',
    subtitle: 'Export backup, restore data, and manage local storage'
  }
};

export function Navbar({ onOpenMobileMenu }) {
  const { currentPage, isSampleMode, openAddTxnModal, activeMonth, alerts = [], setCurrentPage } = useFinance();
  const { user, profile } = useAuth();
  const currentMeta = PAGE_METADATA[currentPage] || {
    title: 'FinTrack',
    subtitle: 'Everyday Money Decision Assistant'
  };

  const criticalAlertsCount = alerts.filter((a) => a.severity === 'danger' || a.severity === 'warning').length;

  return (
    <header className="app-navbar">
      <div className="navbar-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        <div className="navbar-page-title-group">
          <h1 className="navbar-page-title">{currentMeta.title}</h1>
          <span className="navbar-page-subtext">{currentMeta.subtitle}</span>
        </div>
      </div>

      <div className="navbar-right">
        {/* Month Indicator */}
        <Badge variant="neutral" icon={Calendar} className="hide-on-mobile">
          {formatMonthLabel(activeMonth)}
        </Badge>

        {/* Actionable Alerts Quick Pill */}
        {criticalAlertsCount > 0 && (
          <button
            type="button"
            onClick={() => setCurrentPage('budgets')}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            title="View actionable alerts in Budgets & Goals"
          >
            <Badge variant="rose" icon={AlertTriangle}>
              {criticalAlertsCount} Alert{criticalAlertsCount > 1 ? 's' : ''}
            </Badge>
          </button>
        )}

        {/* Currency Tag */}
        <Badge variant="indigo" icon={Coins} className="hide-on-mobile">
          INR (₹)
        </Badge>

        {/* Authenticated User Badge */}
        {user && (
          <Badge variant="neutral" icon={UserIcon} className="hide-on-mobile">
            {profile?.full_name?.split(' ')[0] || user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
          </Badge>
        )}

        {/* Sample Mode Indicator */}
        {isSampleMode && (
          <Badge variant="amber" icon={Sparkles} className="hide-on-mobile">
            Demo Mode
          </Badge>
        )}

        {/* Primary Add Transaction Action */}
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => openAddTxnModal()}
        >
          <span>Add Transaction</span>
        </Button>
      </div>
    </header>
  );
}
