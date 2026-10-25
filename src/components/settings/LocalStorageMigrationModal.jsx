import React, { useState, useMemo } from 'react';
import { useFinance } from '../../hooks/useFinance';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { formatINR, formatDate } from '../../utils/formatters';
import { analyzeLocalTransactionsForMigration } from '../../utils/migrationService';
import { STORAGE_KEYS, safeGet } from '../../utils/storage';
import {
  UploadCloud,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Filter,
  ArrowRight,
  Lock,
  UserCheck,
  RefreshCw,
  FileSpreadsheet,
  Check,
  Info
} from 'lucide-react';

/**
 * SpendSense — LocalStorage to Supabase Migration Modal (Phase 5)
 *
 * Provides a read-only preview, validation, deduplication analysis,
 * and explicit confirmation flow for migrating existing browser
 * localStorage transactions into the authenticated user's Supabase account.
 *
 * CRITICAL SAFETY:
 * - Read-only preview: NEVER modifies, clears, or deletes localStorage.
 * - Explicit user confirmation required before any network upload.
 * - Segregates demo/sample data (cannot be migrated).
 * - Full failure isolation and error reporting.
 */
export function LocalStorageMigrationModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const {
    activeMode,
    isSampleMode,
    cloudTransactions,
    migrateLocalStorageTransactions,
    setCurrentPage
  } = useFinance();

  // Active step: 'preview' | 'migrating' | 'results'
  const [step, setStep] = useState('preview');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'eligible' | 'duplicates' | 'invalid'
  const [selectionOverrides, setSelectionOverrides] = useState({}); // { [index]: boolean }
  const [migrationResult, setMigrationResult] = useState(null);
  const [migrationError, setMigrationError] = useState(null);

  // Read local transactions directly from the authoritative localStorage key (read-only)
  const localTransactions = useMemo(() => {
    if (!isOpen) return [];
    const raw = safeGet(STORAGE_KEYS.USER_TRANSACTIONS, []);
    return Array.isArray(raw) ? raw : [];
  }, [isOpen]);

  // Run read-only validation and deduplication analysis
  const analysis = useMemo(() => {
    return analyzeLocalTransactionsForMigration({
      localTransactions,
      cloudTransactions
    });
  }, [localTransactions, cloudTransactions]);

  // Merge default selection with user overrides
  const selectedIndices = useMemo(() => {
    const map = new Set();
    analysis.analyzedRows.forEach((row, idx) => {
      // Invalid rows can NEVER be selected
      if (!row.isValid) return;

      if (selectionOverrides[idx] !== undefined) {
        if (selectionOverrides[idx]) map.add(idx);
      } else if (row.selected) {
        map.add(idx);
      }
    });
    return map;
  }, [analysis.analyzedRows, selectionOverrides]);

  const handleToggleRow = (idx) => {
    const row = analysis.analyzedRows[idx];
    if (!row || !row.isValid) return;

    setSelectionOverrides((prev) => {
      const currentlySelected = selectedIndices.has(idx);
      return {
        ...prev,
        [idx]: !currentlySelected
      };
    });
  };

  const handleSelectAllEligible = () => {
    const newOverrides = {};
    analysis.analyzedRows.forEach((row, idx) => {
      if (row.isValid) {
        newOverrides[idx] = true;
      }
    });
    setSelectionOverrides(newOverrides);
  };

  const handleDeselectAll = () => {
    const newOverrides = {};
    analysis.analyzedRows.forEach((row, idx) => {
      newOverrides[idx] = false;
    });
    setSelectionOverrides(newOverrides);
  };

  // Filtered rows for the preview table
  const displayedRows = useMemo(() => {
    if (activeFilter === 'eligible') {
      return analysis.analyzedRows.filter((r) => r.isValid && !r.isDuplicate);
    }
    if (activeFilter === 'duplicates') {
      return analysis.analyzedRows.filter((r) => r.isValid && r.isDuplicate);
    }
    if (activeFilter === 'invalid') {
      return analysis.analyzedRows.filter((r) => !r.isValid);
    }
    return analysis.analyzedRows;
  }, [analysis.analyzedRows, activeFilter]);

  // Explicit confirmation upload handler
  const handleExecuteMigration = async () => {
    if (selectedIndices.size === 0) return;

    const candidateTxns = analysis.analyzedRows
      .filter((_, idx) => selectedIndices.has(idx))
      .map((row) => {
        // Pass clean transaction object for adapter conversion
        return {
          id: row.id,
          date: row.date,
          description: row.description,
          amount: row.amount,
          type: row.type,
          category: row.category,
          nature: row.nature,
          paymentMethod: row.paymentMethod,
          notes: row.notes,
          createdAt: row.createdAt
        };
      });

    setStep('migrating');
    setMigrationError(null);

    try {
      const res = await migrateLocalStorageTransactions(candidateTxns);

      setMigrationResult({
        ...res,
        totalLocalFound: analysis.totalFound,
        invalidCount: analysis.invalidCount,
        skippedDuplicates: analysis.duplicateCount - (candidateTxns.length - (analysis.eligibleCount - (analysis.analyzedRows.filter(r => r.isValid && !r.isDuplicate && !selectedIndices.has(r.batchIndex)).length)))
      });
      setStep('results');
    } catch (err) {
      console.error('[SpendSense Migration UI] Migration failed:', err);
      setMigrationError(err.message || 'Unexpected network error during transaction migration.');
      setStep('preview');
    }
  };

  const handleResetAndClose = () => {
    setStep('preview');
    setActiveFilter('all');
    setSelectionOverrides({});
    setMigrationResult(null);
    setMigrationError(null);
    onClose();
  };

  // 1. Guard: Signed-out user
  if (!user) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleResetAndClose}
        title="Supabase Cloud Migration"
        subtitle="Safe LocalStorage to Cloud Sync"
        maxWidth="540px"
        footer={
          <div className="flex items-center justify-end gap-2" style={{ width: '100%' }}>
            <Button variant="secondary" onClick={handleResetAndClose}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                handleResetAndClose();
                setCurrentPage('signin');
              }}
            >
              Sign In to SpendSense
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-3)'
            }}
          >
            <Lock size={20} style={{ color: 'var(--warning-amber)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)' }}>
                Authentication Required
              </h4>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Cloud migration requires an active, authenticated SpendSense account. Please sign in to securely link your local records with Row Level Security.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  // 2. Guard: Demo / Sample Mode
  if (isSampleMode) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleResetAndClose}
        title="Cloud Migration Not Available in Demo Mode"
        subtitle="Sample datasets cannot be uploaded to personal cloud accounts"
        maxWidth="540px"
        footer={
          <div className="flex items-center justify-end gap-2" style={{ width: '100%' }}>
            <Button variant="secondary" onClick={handleResetAndClose}>
              Close
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: '#fffbeb',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-3)'
            }}
          >
            <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)', color: '#92400e' }}>
                Active Workspace: Demo Mode
              </h4>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: '#b45309', lineHeight: 1.5 }}>
                You are currently viewing sample mock transactions. To prevent contaminating your cloud ledger, demo data cannot be migrated. Please switch to <strong>Personal Mode</strong> in Settings to migrate your private transactions.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={step === 'migrating' ? undefined : handleResetAndClose}
      title="Migrate Local Transactions to Supabase Cloud"
      subtitle="Safely upload existing browser transactions to your personal cloud ledger"
      maxWidth="780px"
      footer={
        step === 'results' ? (
          <div className="flex items-center justify-between" style={{ width: '100%' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Source localStorage records were preserved intact.
            </span>
            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={handleResetAndClose}>
                Done &amp; View Ledger
              </Button>
            </div>
          </div>
        ) : step === 'migrating' ? (
          <div className="flex items-center justify-center" style={{ width: '100%', padding: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Uploading transactions securely to Supabase... Please do not close this window.
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-3" style={{ width: '100%' }}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-link"
                style={{ fontSize: '11px', color: 'var(--primary-indigo)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                onClick={handleSelectAllEligible}
              >
                Select All Valid
              </button>
              <span style={{ color: 'var(--border-subtle)', fontSize: '11px' }}>|</span>
              <button
                type="button"
                className="btn-link"
                style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                onClick={handleDeselectAll}
              >
                Deselect All
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleResetAndClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={UploadCloud}
                disabled={selectedIndices.size === 0}
                onClick={handleExecuteMigration}
              >
                Confirm &amp; Migrate {selectedIndices.size} Transaction{selectedIndices.size === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        )
      }
    >
      {/* STEP 1: PREVIEW & REVIEW */}
      {step === 'preview' && (
        <div className="flex flex-col gap-4">
          {migrationError && (
            <div
              className="alert-card alert-card-danger"
              style={{ padding: 'var(--space-3) var(--space-4)' }}
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={16} style={{ color: 'var(--expense-rose)' }} />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                  {migrationError}
                </span>
              </div>
            </div>
          )}

          {/* Privacy & Target Destination Banner */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)'
            }}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} style={{ color: 'var(--emerald-600)', flexShrink: 0 }} />
              <div style={{ fontSize: 'var(--text-xs)' }}>
                Target Account: <strong>{user.email}</strong> (UUID: {user.id.substring(0, 8)}...)
              </div>
            </div>
            <Badge variant="indigo" style={{ fontSize: '10px' }}>
              RLS Protected
            </Badge>
          </div>

          {/* Diagnostic Summary Cards */}
          <div className="grid grid-cols-4" style={{ gap: 'var(--space-2)' }}>
            <div
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-subtle)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Local Found</span>
              <strong style={{ fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>
                {analysis.totalFound}
              </strong>
            </div>

            <div
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--emerald-50, #ecfdf5)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--emerald-700, #047857)' }}>Eligible &amp; Unique</span>
              <strong style={{ fontSize: 'var(--text-lg)', color: 'var(--emerald-700, #047857)' }}>
                {analysis.eligibleCount}
              </strong>
            </div>

            <div
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#fffbeb',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <span style={{ fontSize: '10px', color: '#b45309' }}>Duplicates</span>
              <strong style={{ fontSize: 'var(--text-lg)', color: '#b45309' }}>
                {analysis.duplicateCount}
              </strong>
            </div>

            <div
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--rose-50, #fff1f2)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--rose-700, #be123c)' }}>Invalid Records</span>
              <strong style={{ fontSize: 'var(--text-lg)', color: 'var(--rose-700, #be123c)' }}>
                {analysis.invalidCount}
              </strong>
            </div>
          </div>

          {/* Safety Reassurance Notice */}
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-surface-hover)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              lineHeight: 1.4
            }}
          >
            <strong>Preservation Guarantee:</strong> Migration sends selected transactions to your cloud database. Your source browser records in localStorage are <strong>never deleted or modified</strong>.
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: activeFilter === 'all' ? 'var(--primary-indigo)' : 'var(--bg-subtle)',
                color: activeFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 600
              }}
              onClick={() => setActiveFilter('all')}
            >
              All ({analysis.totalFound})
            </button>
            <button
              type="button"
              className={`filter-pill ${activeFilter === 'eligible' ? 'active' : ''}`}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: activeFilter === 'eligible' ? 'var(--emerald-600)' : 'var(--bg-subtle)',
                color: activeFilter === 'eligible' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 600
              }}
              onClick={() => setActiveFilter('eligible')}
            >
              Eligible ({analysis.eligibleCount})
            </button>
            <button
              type="button"
              className={`filter-pill ${activeFilter === 'duplicates' ? 'active' : ''}`}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: activeFilter === 'duplicates' ? '#d97706' : 'var(--bg-subtle)',
                color: activeFilter === 'duplicates' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 600
              }}
              onClick={() => setActiveFilter('duplicates')}
            >
              Duplicates ({analysis.duplicateCount})
            </button>
            <button
              type="button"
              className={`filter-pill ${activeFilter === 'invalid' ? 'active' : ''}`}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: activeFilter === 'invalid' ? 'var(--expense-rose)' : 'var(--bg-subtle)',
                color: activeFilter === 'invalid' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 600
              }}
              onClick={() => setActiveFilter('invalid')}
            >
              Invalid ({analysis.invalidCount})
            </button>
          </div>

          {/* Table Container */}
          <div
            style={{
              maxHeight: 280,
              overflowY: 'auto',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            {displayedRows.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                No records match this filter.
              </div>
            ) : (
              <table className="w-full" style={{ fontSize: '11px', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <tr>
                    <th style={{ width: 36, padding: '8px 10px', textAlign: 'center' }}>#</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Category</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((row) => {
                    const isSelected = selectedIndices.has(row.batchIndex);
                    return (
                      <tr
                        key={row.batchIndex}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          backgroundColor: !row.isValid
                            ? 'rgba(254, 242, 242, 0.5)'
                            : row.isDuplicate
                              ? 'rgba(255, 251, 235, 0.4)'
                              : isSelected
                                ? 'rgba(238, 242, 255, 0.3)'
                                : 'transparent'
                        }}
                      >
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!row.isValid}
                            onChange={() => handleToggleRow(row.batchIndex)}
                            style={{ cursor: row.isValid ? 'pointer' : 'not-allowed' }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          {row.date || '—'}
                        </td>
                        <td style={{ padding: '8px 10px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span title={row.description || 'Missing title'}>
                            {row.description || <em style={{ color: 'var(--text-muted)' }}>Missing description</em>}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: row.type === 'income' ? 'var(--emerald-600)' : 'var(--text-primary)' }}>
                          {typeof row.amount === 'number' ? `${row.type === 'income' ? '+' : '-'}₹${row.amount.toFixed(2)}` : 'Invalid'}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                          {row.category || '—'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {!row.isValid ? (
                            <Badge variant="rose" title={row.validationError}>
                              {row.validationError || 'Invalid'}
                            </Badge>
                          ) : row.isDuplicate ? (
                            <Badge variant="amber" title={row.duplicateReason}>
                              {row.duplicateSource === 'existing' ? 'In Cloud' : 'Batch Dup'}
                            </Badge>
                          ) : (
                            <Badge variant="emerald">
                              Eligible
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: IN-FLIGHT MIGRATION PROGRESS */}
      {step === 'migrating' && (
        <div className="flex flex-col items-center justify-center gap-4" style={{ padding: 'var(--space-8) var(--space-4)' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: '4px solid var(--border-subtle)',
              borderTopColor: 'var(--primary-indigo)',
              animation: 'spin 1s linear infinite'
            }}
          />
          <style>
            {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
          </style>
          <div className="text-center">
            <h3 style={{ fontSize: 'var(--text-base)', margin: '0 0 6px' }}>
              Migrating to Supabase Cloud...
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, maxWidth: 380 }}>
              Uploading transactions with Row Level Security and creating verified ledger entries in PostgreSQL.
            </p>
          </div>
        </div>
      )}

      {/* STEP 3: MIGRATION RESULTS REPORT */}
      {step === 'results' && migrationResult && (
        <div className="flex flex-col gap-4">
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: migrationResult.migratedCount > 0 ? 'var(--emerald-50, #ecfdf5)' : 'var(--rose-50, #fff1f2)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${migrationResult.migratedCount > 0 ? 'var(--emerald-200, #a7f3d0)' : 'var(--rose-200, #fecdd3)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)'
            }}
          >
            {migrationResult.migratedCount > 0 ? (
              <CheckCircle2 size={24} style={{ color: 'var(--emerald-600)', flexShrink: 0 }} />
            ) : (
              <AlertCircle size={24} style={{ color: 'var(--expense-rose)', flexShrink: 0 }} />
            )}
            <div>
              <h3 style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', color: migrationResult.migratedCount > 0 ? 'var(--emerald-800, #065f46)' : 'var(--rose-800, #9f1239)' }}>
                {migrationResult.migratedCount > 0
                  ? `Successfully Migrated ${migrationResult.migratedCount} Transaction${migrationResult.migratedCount === 1 ? '' : 's'}!`
                  : 'Migration Incomplete'}
              </h3>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Confirmed cloud transactions are now live in your personal ledger.
              </p>
            </div>
          </div>

          {/* Breakdown Statistics */}
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
              <span style={{ color: 'var(--text-muted)' }}>Source Local Records Found:</span>
              <strong>{migrationResult.totalLocalFound}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Successfully Migrated to Cloud:</span>
              <strong style={{ color: 'var(--emerald-600)' }}>{migrationResult.migratedCount} confirmed</strong>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Skipped Duplicates:</span>
              <strong style={{ color: '#d97706' }}>{analysis.duplicateCount} records</strong>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Invalid Records Excluded:</span>
              <strong style={{ color: 'var(--expense-rose)' }}>{analysis.invalidCount} records</strong>
            </div>
            {migrationResult.failedCount > 0 && (
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--expense-rose)' }}>Failed Database Inserts:</span>
                <strong style={{ color: 'var(--expense-rose)' }}>{migrationResult.failedCount} records</strong>
              </div>
            )}
          </div>

          {/* Failures Breakdown if any */}
          {migrationResult.errors && migrationResult.errors.length > 0 && (
            <div
              style={{
                backgroundColor: 'var(--rose-50)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--rose-200)',
                maxHeight: 120,
                overflowY: 'auto'
              }}
            >
              <strong style={{ fontSize: '11px', color: 'var(--rose-800)' }}>Failure Details:</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '11px', color: 'var(--rose-700)' }}>
                {migrationResult.errors.map((err, i) => (
                  <li key={i}>
                    {err.description ? `${err.description}: ` : ''}{err.error || err.message || 'Insert error'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Local Data Preservation Notice */}
          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--bg-surface-hover)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}
          >
            <strong style={{ color: 'var(--text-primary)' }}>Source Data Preserved:</strong> All original {migrationResult.totalLocalFound} transactions remain intact in your browser's <code>localStorage</code>. No local data was deleted or altered during migration.
          </div>
        </div>
      )}
    </Modal>
  );
}
