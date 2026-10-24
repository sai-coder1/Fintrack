import React, { useState, useRef } from 'react';
import { useFinance } from '../hooks/useFinance';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { STORAGE_VERSION } from '../utils/storage';
import {
  Settings,
  Database,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  HardDrive,
  FileJson,
  UserCheck,
  Sparkles
} from 'lucide-react';

export function SettingsPage() {
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
    budgets,
    goals
  } = useFinance();

  // Destructive wipe confirmation modal
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [restoreStatus, setRestoreStatus] = useState(null);

  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result);
        const res = importDataJSON(parsed);
        if (res.success) {
          setRestoreStatus({
            type: 'success',
            message: 'Backup restored successfully! Your personal data has been loaded into localStorage.'
          });
        } else {
          setRestoreStatus({
            type: 'error',
            message: `Restore failed: ${res.error}`
          });
        }
      } catch (err) {
        setRestoreStatus({
          type: 'error',
          message: 'Failed to parse JSON file. Please ensure it is a valid SpendSense backup file.'
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const executeWipe = () => {
    if (wipeConfirmText.trim().toLowerCase() === 'delete') {
      clearPersonalData();
      setIsWipeModalOpen(false);
      setWipeConfirmText('');
      setRestoreStatus({
        type: 'success',
        message: 'Personal ledger and custom configurations have been completely cleared.'
      });
    }
  };

  const handleResetDemo = () => {
    if (window.confirm('Reset sample demo dataset back to defaults?')) {
      resetDemoData();
      setRestoreStatus({
        type: 'success',
        message: 'Demo dataset has been reset to default October 2026 transactions.'
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header */}
      <div>
        <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: '4px' }}>
          Data Layer &amp; Storage Architecture
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
          Manage your client-side data, separation of demo and personal records, backups, and privacy.
        </p>
      </div>

      {/* 2. Storage Information */}
      <Card
        title="Local Storage Diagnostics"
        subtitle="SpendSense persists your records safely using versioned browser localStorage"
        action={
          <Badge variant="emerald" icon={ShieldCheck}>
            100% Client-Side Privacy
          </Badge>
        }
      >
        <div className="grid grid-cols-4">
          <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Active Ledger Entries</span>
            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {transactions.length}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {isSampleMode ? 'Sample records' : 'Personal entries'}
            </span>
          </div>

          <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Personal User Records</span>
            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--primary-indigo)' }}>
              {userTransactions.length}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Safely isolated</span>
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
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Schema validated</span>
          </div>
        </div>
      </Card>

      {/* 3. Sample-Data Separation Controls */}
      <Card
        title="Workspace Mode Selection"
        subtitle="Clean separation between demo testing data and your personal ledger"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                Active Mode:
              </span>
              <Badge variant={isSampleMode ? 'amber' : 'emerald'}>
                {isSampleMode ? 'Demo Sample Mode' : 'Personal Workspace'}
              </Badge>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, maxWidth: 520, lineHeight: 1.5 }}>
              {isSampleMode
                ? 'You are viewing pre-loaded October 2026 transactions from Indian merchants (Swiggy, Blinkit, Infosys, etc.) for demonstration purposes. Your personal data remains untouched.'
                : 'You are viewing your own private ledger. No demo data is mixed with your records.'}
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

      {/* 4. Export & Restore Sections */}
      <div className="grid grid-cols-2">
        {/* Export JSON Backup */}
        <Card
          title="Export Data Snapshot"
          subtitle="Download a portable JSON archive of your personal financial records"
        >
          <div className="flex flex-col gap-4">
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Export an offline backup containing your transactions, category budgets, savings goals, and preferences. You can restore this file at any time on another browser or machine.
            </p>
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
          title="Restore from Snapshot"
          subtitle="Upload and deserialize a previously exported SpendSense JSON archive"
        >
          <div className="flex flex-col gap-4">
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Select a valid SpendSense JSON backup file from your device. Restoring will import your personal transactions and switch to personal workspace.
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
                Upload &amp; Restore Backup
              </Button>
            </div>

            {restoreStatus && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-xs)',
                  backgroundColor: restoreStatus.type === 'success' ? 'var(--emerald-50)' : 'var(--rose-50)',
                  color: restoreStatus.type === 'success' ? 'var(--emerald-700)' : 'var(--rose-700)',
                  border: `1px solid ${restoreStatus.type === 'success' ? 'var(--emerald-200)' : 'var(--rose-200)'}`
                }}
              >
                {restoreStatus.message}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 5. Destructive-Action Confirmation Section */}
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
                Permanently deletes all personal transactions, category budgets, and savings goals from your browser&apos;s localStorage.
              </p>
            </div>
          </div>

          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            onClick={() => setIsWipeModalOpen(true)}
          >
            Erase Personal Data
          </Button>
        </div>
      </div>

      {/* Destructive Action Confirmation Modal */}
      <Modal
        isOpen={isWipeModalOpen}
        onClose={() => {
          setIsWipeModalOpen(false);
          setWipeConfirmText('');
        }}
        title="Confirm Irreversible Data Wipe"
        subtitle="This action will permanently delete all personal SpendSense records"
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
            <strong>{budgets.length} budgets</strong>, and <strong>{goals.length} savings goals</strong> will be permanently removed.
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
    </div>
  );
}
