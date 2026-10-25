import React, { useState, useRef, useEffect } from 'react';
import { useFinance } from '../hooks/useFinance';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../context/NotificationContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { STORAGE_VERSION, validateBackupData } from '../utils/storage';
import { formatDate } from '../utils/formatters';
import { LocalStorageMigrationModal } from '../components/settings/LocalStorageMigrationModal';
import { FinancialAccountsSection } from '../components/aa/FinancialAccountsSection';
import {
  Settings,
  Database,
  Download,
  Upload,
  UploadCloud,
  Trash2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  HardDrive,
  FileJson,
  UserCheck,
  Sparkles,
  Lock,
  EyeOff,
  User,
  Coins,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Info,
  ServerOff,
  Network,
  Bell,
  BellOff,
  Volume2
} from 'lucide-react';

export function SettingsPage() {
  const {
    browserSettings,
    browserPermission,
    requestBrowserPermission,
    toggleBrowserNotifications,
    showToast,
    clearAllNotifications,
    notifications
  } = useNotifications();

  const {
    activeMode,
    isSampleMode,
    switchToSampleMode,
    switchToPersonalMode,
    resetDemoData,
    clearPersonalData,
    exportDataJSON,
    importDataJSON,
    transactions,
    userTransactions,
    userBudgets,
    userGoals,
    budgets,
    goals,
    settings,
    updateSettings,
    updateDisplayName,
    activeMonth,
    setActiveMonth,
    setCurrentPage
  } = useFinance();
  const { user, profile, updateProfileName, isConfigured } = useAuth();

  // 1. User Preferences State — compute active resolved name with profile & auth metadata priority
  const activeResolvedName = profile?.full_name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    (user?.email ? user.email.split('@')[0] : '') ||
    settings?.displayName ||
    '';

  const [displayNameInput, setDisplayNameInput] = useState(activeResolvedName || 'Sai');
  const [prefSuccessMessage, setPrefSuccessMessage] = useState('');

  useEffect(() => {
    if (activeResolvedName) {
      setDisplayNameInput(activeResolvedName);
    }
  }, [activeResolvedName]);

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    const cleanName = displayNameInput.trim();
    if (!cleanName) return;

    if (user && isConfigured && updateProfileName) {
      await updateProfileName(cleanName);
    }
    updateDisplayName(cleanName);
    setPrefSuccessMessage(`Preferences updated! Your display name is now set to "${cleanName}".`);
    setTimeout(() => setPrefSuccessMessage(''), 4000);
  };

  // 2. Backup Restore & Preview State
  const [pendingBackupPreview, setPendingBackupPreview] = useState(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [rawBackupData, setRawBackupData] = useState(null);
  const [restoreStatus, setRestoreStatus] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        const parsed = JSON.parse(text);

        // Validate backup structure before touching state
        const validation = validateBackupData(parsed);
        if (!validation.valid) {
          setRestoreStatus({
            type: 'error',
            message: `Invalid Backup File: ${validation.error}`
          });
          return;
        }

        // Valid backup: Store for preview and open confirmation modal
        setRawBackupData(parsed);
        setPendingBackupPreview(validation.preview);
        setIsRestoreModalOpen(true);
        setRestoreStatus(null);
      } catch (err) {
        setRestoreStatus({
          type: 'error',
          message: 'Failed to read JSON file. Please ensure the file contains valid JSON formatting.'
        });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input so same file can be chosen again
  };

  const confirmRestoreBackup = () => {
    if (!rawBackupData) return;

    const result = importDataJSON(rawBackupData);
    setIsRestoreModalOpen(false);

    if (result.success) {
      setRestoreStatus({
        type: 'success',
        message: `Backup restored successfully! Loaded ${result.preview.transactionCount} transactions, ${result.preview.budgetCount} budgets, and ${result.preview.goalCount} goals into your Personal Workspace.`
      });
      setRawBackupData(null);
      setPendingBackupPreview(null);
    } else {
      setRestoreStatus({
        type: 'error',
        message: `Restore failed: ${result.error}`
      });
    }
  };

  // 3. Destructive Wipe Confirmation Modal State
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');

  // 3b. LocalStorage Cloud Migration Modal State (Phase 5)
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);

  const executeWipe = () => {
    if (wipeConfirmText.trim().toLowerCase() === 'delete') {
      clearPersonalData();
      setIsWipeModalOpen(false);
      setWipeConfirmText('');
      setRestoreStatus({
        type: 'success',
        message: 'Personal workspace cleared. All personal transactions, budgets, and goals were permanently removed.'
      });
    }
  };

  // 4. Sample Demo Reset Handler
  const handleResetDemo = () => {
    if (window.confirm('Reset sample demo dataset back to original defaults? Your personal records will remain safe.')) {
      resetDemoData();
      setRestoreStatus({
        type: 'success',
        message: 'Demo dataset has been reset to default realistic October 2026 records.'
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Page Header */}
      <div>
        <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: '4px' }}>
          Data &amp; Application Settings
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
          Manage your client-side data, user preferences, portable JSON backups, and privacy controls.
        </p>
      </div>

      {/* Global Status Banner */}
      {restoreStatus && (
        <div
          className={`alert-card alert-card-${restoreStatus.type === 'success' ? 'success' : 'danger'}`}
          style={{ padding: 'var(--space-3) var(--space-4)' }}
        >
          <div className="flex items-center gap-2">
            {restoreStatus.type === 'success' ? (
              <CheckCircle2 size={16} style={{ color: 'var(--emerald-600)' }} />
            ) : (
              <AlertCircle size={16} style={{ color: 'var(--expense-rose)' }} />
            )}
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
              {restoreStatus.message}
            </span>
          </div>
        </div>
      )}

      {/* 2. User Preferences Panel */}
      <Card
        title="User Preferences & Display"
        subtitle="Personalize your greeting and simulation defaults"
      >
        <form onSubmit={handleSavePreferences} className="flex flex-col gap-4">
          <div className="grid grid-cols-3" style={{ gap: 'var(--space-4)' }}>
            {/* Display Name Input */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="pref-name">
                Preferred Display Name
              </label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">
                  <User size={14} style={{ color: 'var(--text-muted)' }} />
                </span>
                <input
                  id="pref-name"
                  type="text"
                  placeholder="e.g. Sai, Alex, Priya"
                  className="form-input with-prefix"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  required
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                Used in dashboard greetings and personal summaries.
              </span>
            </div>

            {/* Locked Currency Display */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Active Currency</label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}
              >
                <Coins size={15} style={{ color: 'var(--primary-indigo)' }} />
                <span>INR (₹) — Indian Rupee</span>
                <Badge variant="indigo" style={{ marginLeft: 'auto', fontSize: '10px' }}>
                  MVP Standard
                </Badge>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                Fixed to INR for this hackathon release.
              </span>
            </div>

            {/* Active Simulation Month */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Default Simulation Month</label>
              <select
                className="form-select"
                value={activeMonth}
                onChange={(e) => setActiveMonth(e.target.value)}
              >
                <option value="2026-10">October 2026 (Active Simulation)</option>
                <option value="2026-09">September 2026</option>
                <option value="2026-08">August 2026</option>
                <option value="2026-11">November 2026</option>
                <option value="2026-12">December 2026</option>
              </select>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                Controls active filtering across Budgets and Simulator.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {prefSuccessMessage ? (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--emerald-600)', fontWeight: 600 }}>
                {prefSuccessMessage}
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Changes are saved immediately to browser storage.
              </span>
            )}

            <Button variant="primary" size="sm" type="submit">
              Save Preferences
            </Button>
          </div>
        </form>
      </Card>

      {/* 3. Real-Time In-App & Browser Notifications */}
      <Card
        title="In-App & Browser Notifications"
        subtitle="Real-time visible pop-up alerts and threshold warnings when spending approaches or exceeds budget limits"
        action={
          <Badge
            variant={
              browserPermission === 'granted' && browserSettings.browserEnabled
                ? 'emerald'
                : browserPermission === 'denied'
                ? 'rose'
                : 'neutral'
            }
            icon={Bell}
          >
            {browserPermission === 'granted' && browserSettings.browserEnabled
              ? 'Browser Alerts Active'
              : browserPermission === 'denied'
              ? 'Browser Alerts Blocked'
              : 'In-App Alerts Active'}
          </Badge>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Thresholds Information Grid */}
          <div className="grid grid-cols-4" style={{ gap: 'var(--space-3)' }}>
            <div className="card" style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="flex items-center gap-1">
                <span className="notification-unread-pill">75% Usage</span>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                Budget Heads-Up
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Informational toast &amp; notification when 75% limit is crossed.
              </span>
            </div>

            <div className="card" style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="flex items-center gap-1">
                <span className="notification-unread-pill" style={{ backgroundColor: 'var(--soft-amber-bg)', color: 'var(--warning-amber)' }}>
                  90% Usage
                </span>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--warning-amber)', marginTop: 4 }}>
                Strong Warning
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Urgent warning showing exact remaining rupee balance.
              </span>
            </div>

            <div className="card" style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="flex items-center gap-1">
                <span className="notification-unread-pill" style={{ backgroundColor: 'var(--soft-amber-bg)', color: 'var(--warning-amber)' }}>
                  100% Usage
                </span>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--warning-amber)', marginTop: 4 }}>
                Budget Reached
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Alert when 100% of category allocation has been spent.
              </span>
            </div>

            <div className="card" style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="flex items-center gap-1">
                <span className="notification-unread-pill" style={{ backgroundColor: 'var(--soft-rose-bg)', color: 'var(--expense-rose)' }}>
                  &gt;100% Usage
                </span>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--expense-rose)', marginTop: 4 }}>
                Overspending Error
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Immediate danger alert detailing exact overage in ₹.
              </span>
            </div>
          </div>

          {/* Browser Desktop Notifications Row */}
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-3)'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '500px' }}>
              <div className="flex items-center gap-2">
                <Volume2 size={16} style={{ color: 'var(--primary-indigo)' }} />
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                  Browser Desktop Notifications
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Receive visible system alerts on your desktop when FinTrack detects budget limit crossings.
                Notifications operate strictly while this application is open in a browser tab.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {browserPermission === 'default' && (
                <Button variant="primary" size="sm" icon={Bell} onClick={requestBrowserPermission}>
                  Enable Browser Alerts
                </Button>
              )}

              {browserPermission === 'granted' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant={browserSettings.browserEnabled ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => toggleBrowserNotifications(!browserSettings.browserEnabled)}
                  >
                    {browserSettings.browserEnabled ? 'Disable Browser Alerts' : 'Enable Browser Alerts'}
                  </Button>
                  <Button
                    variant="outline-indigo"
                    size="sm"
                    onClick={() => {
                      showToast({
                        type: 'info',
                        title: 'Test Notification',
                        message: 'This is a test notification from FinTrack.'
                      });
                      if (browserSettings.browserEnabled && typeof window !== 'undefined' && 'Notification' in window) {
                        try {
                          new Notification('FinTrack Test Alert', {
                            body: 'Browser notifications are working properly while your tab is open!',
                            icon: '/favicon.svg'
                          });
                        } catch (e) {
                          console.warn(e);
                        }
                      }
                    }}
                  >
                    Send Test Alert
                  </Button>
                </div>
              )}

              {browserPermission === 'denied' && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--expense-rose)', fontWeight: 600 }}>
                  Blocked in browser settings
                </span>
              )}
            </div>
          </div>

          {/* Test Toast & Clear History Actions */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  showToast({
                    type: 'success',
                    title: 'Sample Success Toast',
                    message: 'Transaction added successfully.'
                  })
                }
              >
                Test Success Toast
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  showToast({
                    type: 'warning',
                    title: 'Sample Warning Toast',
                    message: "You've used 89% of your monthly budget. ₹60 remains."
                  })
                }
              >
                Test Budget Toast
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  showToast({
                    type: 'danger',
                    title: 'Sample Overspending Toast',
                    message: 'Budget exceeded by ₹40.'
                  })
                }
              >
                Test Error Toast
              </Button>
            </div>

            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                onClick={clearAllNotifications}
                style={{ color: 'var(--expense-rose)' }}
              >
                Clear History ({notifications.length})
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 4. Storage Diagnostics & Workspace Separation */}
      <Card
        title="Client-Side Storage Diagnostics & Modes"
        subtitle="FinTrack persists all data locally using schema-versioned localStorage"
        action={
          <Badge variant="emerald" icon={ShieldCheck}>
            100% Client-Side Privacy
          </Badge>
        }
      >
        <div className="grid grid-cols-4" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Active Workspace</span>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {isSampleMode ? 'Demo Mode' : 'Personal Mode'}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {isSampleMode ? 'Sample dataset' : 'Your private data'}
            </span>
          </div>

          <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Personal User Records</span>
            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--primary-indigo)' }}>
              {userTransactions.length}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              Strictly isolated
            </span>
          </div>

          <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Budgets &amp; Goals</span>
            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {budgets.length + goals.length}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {budgets.length} caps, {goals.length} goals
            </span>
          </div>

          <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Storage Architecture</span>
            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {STORAGE_VERSION}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              localStorage verified
            </span>
          </div>
        </div>

        {/* Workspace Mode Switcher */}
        <div
          style={{
            backgroundColor: 'var(--bg-subtle)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)'
          }}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                Current Workspace:
              </span>
              <Badge variant={isSampleMode ? 'amber' : 'emerald'}>
                {isSampleMode ? 'Demo Sample Mode' : 'Personal Workspace'}
              </Badge>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, maxWidth: 540, lineHeight: 1.5 }}>
              {isSampleMode
                ? 'Viewing pre-loaded sample October 2026 transactions from Indian merchants (Infosys, Blinkit, Bescom) for testing. Your personal data is safely segregated.'
                : 'Viewing your own private transaction ledger. Demo data is hidden.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isSampleMode ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={RefreshCw}
                  onClick={handleResetDemo}
                >
                  Reset Demo Data
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={UserCheck}
                  onClick={switchToPersonalMode}
                >
                  Switch to My Personal Data ({userTransactions.length})
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Sparkles}
                  onClick={switchToSampleMode}
                >
                  Explore Demo Data
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Trash2}
                  onClick={() => setIsWipeModalOpen(true)}
                >
                  Clear Personal Data
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* 3b. Supabase Cloud Migration (Phase 5) */}
      <Card
        title="Supabase Cloud Ledger Migration"
        subtitle="Migrate existing browser localStorage transactions into your secure Supabase account"
        action={
          <Badge variant="indigo" icon={UploadCloud}>
            Phase 5 Migration
          </Badge>
        }
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-4)'
          }}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                Browser Stored Transactions:
              </span>
              <Badge variant={userTransactions.length > 0 ? 'indigo' : 'neutral'}>
                {userTransactions.length} local records
              </Badge>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, maxWidth: 540, lineHeight: 1.5 }}>
              Preview eligible records, detect duplicates, and safely upload local transactions to PostgreSQL with Row Level Security. Local browser data is preserved intact.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={UploadCloud}
            onClick={() => setIsMigrationModalOpen(true)}
          >
            Review &amp; Migrate to Cloud ({userTransactions.length})
          </Button>
        </div>
      </Card>

      {/* 4. Data Backup & Restore Center */}
      <div className="grid grid-cols-2">
        {/* Export JSON Backup */}
        <Card
          title="Export Data Snapshot (.json)"
          subtitle="Download a portable, offline backup of your personal financial records"
        >
          <div className="flex flex-col gap-4">
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Export an offline JSON file containing your personal transactions, category budgets, savings goals, and display preferences. You can restore this snapshot at any time on another browser or machine.
            </p>

            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                lineHeight: 1.5
              }}
            >
              <strong>Included in Export:</strong> {userTransactions.length} personal transactions, {userBudgets.length} budgets, {userGoals.length} savings goals, and user preferences.
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                onClick={exportDataJSON}
              >
                Download Backup (.json)
              </Button>
            </div>
          </div>
        </Card>

        {/* Restore from JSON Backup */}
        <Card
          title="Restore from Snapshot (.json)"
          subtitle="Upload and validate a previously exported FinTrack JSON archive"
        >
          <div className="flex flex-col gap-4">
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Select a valid FinTrack backup file. FinTrack will validate the schema, show you a confirmation preview, and safely replace personal records upon approval.
            </p>

            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={Upload}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload &amp; Preview Backup
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* 5. Privacy, Transparency & Security Advisory */}
      <Card
        title="Privacy, Storage &amp; Security Transparency"
        subtitle="Clear, honest details regarding data privacy, browser storage, and handling"
      >
        <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)'
            }}
          >
            <div className="flex items-center gap-2" style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
              <HardDrive size={15} style={{ color: 'var(--primary-indigo)' }} />
              <span>100% Client-Side Local Storage</span>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
              All financial transactions, category budgets, and savings goals exist exclusively within your current browser&apos;s <code>localStorage</code>. No remote database or third-party cloud server receives your figures.
            </p>
          </div>

          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)'
            }}
          >
            <div className="flex items-center gap-2" style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
              <ServerOff size={15} style={{ color: 'var(--warning-amber)' }} />
              <span>No Automatic Cross-Device Sync</span>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
              Because data is kept on the client, closing your incognito session or switching browsers/devices will not automatically sync your data. Use the <strong>Export Snapshot</strong> tool to manually transfer backups.
            </p>
          </div>

          <div
            className="col-span-2-responsive"
            style={{
              padding: 'var(--space-4)',
              backgroundColor: '#fffbeb',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #fde68a',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)'
            }}
          >
            <div className="flex items-center gap-2" style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--warning-amber)' }}>
              <AlertTriangle size={15} />
              <span>Sensitive Financial Information Advisory</span>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: '#92400e', margin: 0, lineHeight: 1.55 }}>
              <strong>Important Security Notice:</strong> FinTrack is an educational prototype and hackathon project. Browser <code>localStorage</code> is unencrypted. We do not claim military-grade encryption or automated bank synchronization. <strong>Do not enter real bank account passwords, debit/credit card CVVs, or government identity numbers (PAN/Aadhaar) into this application.</strong> Always use pseudonymized or demo narrations.
            </p>
          </div>
        </div>
      </Card>

      {/* 6. Account Aggregator Financial Connections (Phase B) */}
      <FinancialAccountsSection />

      {/* 7. Destructive Zone: Clear Personal Data */}
      <div
        className="card"
        style={{
          padding: 'var(--space-6)',
          border: '1px solid var(--rose-200)',
          backgroundColor: 'var(--rose-50)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-start gap-3">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--rose-100)',
                color: 'var(--rose-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--text-base)', color: 'var(--rose-700)', marginBottom: 2 }}>
                Destructive Zone: Erase Personal Workspace
              </h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--rose-700)', margin: 0, opacity: 0.9 }}>
                Permanently wipes all personal transactions, category budgets, and savings goals from your browser&apos;s localStorage. Sample demo records will remain safe.
              </p>
            </div>
          </div>

          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            onClick={() => setIsWipeModalOpen(true)}
          >
            Clear Personal Data
          </Button>
        </div>
      </div>

      {/* Modal: Preview & Confirm Backup Restore */}
      <Modal
        isOpen={isRestoreModalOpen}
        onClose={() => {
          setIsRestoreModalOpen(false);
          setPendingBackupPreview(null);
          setRawBackupData(null);
        }}
        title="Confirm Backup Snapshot Restore"
        subtitle="Review the contents of this backup before replacing personal records"
        maxWidth="480px"
        footer={
          <div className="flex items-center justify-end gap-3" style={{ width: '100%' }}>
            <Button
              variant="secondary"
              onClick={() => {
                setIsRestoreModalOpen(false);
                setPendingBackupPreview(null);
                setRawBackupData(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmRestoreBackup}>
              Confirm &amp; Restore Snapshot
            </Button>
          </div>
        }
      >
        {pendingBackupPreview && (
          <div className="flex flex-col gap-4">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              A valid FinTrack backup file was verified. Restoring it will replace your current personal records:
            </p>

            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-xs)'
              }}
            >
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Backup Version:</span>
                <strong>{pendingBackupPreview.version} ({pendingBackupPreview.app})</strong>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Exported At:</span>
                <span>{pendingBackupPreview.exportedAt ? formatDate(pendingBackupPreview.exportedAt.split('T')[0]) : 'Recent'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Display Name:</span>
                <strong>{pendingBackupPreview.displayName}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Transactions to Import:</span>
                <strong style={{ color: 'var(--primary-indigo)' }}>{pendingBackupPreview.transactionCount} records</strong>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Category Budgets to Import:</span>
                <strong>{pendingBackupPreview.budgetCount} caps</strong>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Savings Goals to Import:</span>
                <strong>{pendingBackupPreview.goalCount} goals</strong>
              </div>
            </div>

            <div
              style={{
                fontSize: '11px',
                color: 'var(--rose-700)',
                backgroundColor: 'var(--rose-50)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--rose-200)',
                lineHeight: 1.4
              }}
            >
              <strong>Notice:</strong> Your active workspace will automatically switch to Personal Mode. Your demo sample data will remain intact.
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Confirm Personal Data Wipe */}
      <Modal
        isOpen={isWipeModalOpen}
        onClose={() => {
          setIsWipeModalOpen(false);
          setWipeConfirmText('');
        }}
        title="Confirm Irreversible Data Wipe"
        subtitle="This action will permanently delete all personal FinTrack records"
        maxWidth="460px"
        footer={
          <div className="flex items-center justify-end gap-3" style={{ width: '100%' }}>
            <Button
              variant="secondary"
              onClick={() => {
                setIsWipeModalOpen(false);
                setWipeConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={wipeConfirmText.trim().toLowerCase() !== 'delete'}
              onClick={executeWipe}
            >
              Permanently Delete Personal Data
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Are you sure you want to proceed? All <strong>{userTransactions.length} personal transactions</strong>,{' '}
            <strong>{userBudgets.length} budgets</strong>, and <strong>{userGoals.length} savings goals</strong> will be permanently wiped from localStorage. Demo data will remain safe.
          </p>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Type <strong style={{ color: 'var(--rose-600)' }}>delete</strong> to confirm:
            </label>
            <input
              type="text"
              placeholder="delete"
              className="form-input"
              value={wipeConfirmText}
              onChange={(e) => setWipeConfirmText(e.target.value)}
              autoFocus
            />
          </div>
        </div>
      </Modal>

      {/* Modal: Safe LocalStorage to Cloud Migration (Phase 5) */}
      <LocalStorageMigrationModal
        isOpen={isMigrationModalOpen}
        onClose={() => setIsMigrationModalOpen(false)}
      />
    </div>
  );
}
