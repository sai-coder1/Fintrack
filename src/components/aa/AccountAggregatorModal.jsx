import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useFinance } from '../../hooks/useFinance';
import { batchNormalizeAATransactions } from '../../utils/aaTransactionAdapter';
import { MOCK_AA_ACCOUNTS, MOCK_INVALID_TRANSACTION } from '../../data/mockAAData';
import { formatINR, formatDate } from '../../utils/formatters';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Lock,
  ArrowRight,
  ExternalLink,
  Info,
  Clock,
  Check,
  Ban,
  Download,
  FileCheck2,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight
} from 'lucide-react';

// Common scheduled commercial banks supported in India's AA ecosystem
const SUPPORTED_FIPS = [
  { id: 'hdfc', name: 'HDFC Bank', code: 'HDFC0000', type: 'Private Commercial' },
  { id: 'sbi', name: 'State Bank of India', code: 'SBIN0000', type: 'Public Sector' },
  { id: 'icici', name: 'ICICI Bank', code: 'ICIC0000', type: 'Private Commercial' },
  { id: 'axis', name: 'Axis Bank', code: 'UTIB0000', type: 'Private Commercial' },
  { id: 'kotak', name: 'Kotak Mahindra Bank', code: 'KKBK0000', type: 'Private Commercial' }
];

/**
 * SpendSense — Account Aggregator Consent & Demo Import Modal
 *
 * Implements the interactive consent workflow and simulated statement import
 * for India's RBI Account Aggregator framework.
 *
 * HACKATHON DEMO DISCLOSURE:
 * - 100% simulated test demonstration using fictional banking data.
 * - No real bank connection or banking credentials are requested.
 * - Employs aaTransactionAdapter for strict validation and duplicateDetector for deduplication.
 * - Imports through the unified Supabase / local transaction pipeline with RLS preservation.
 */
export function AccountAggregatorModal({
  isOpen,
  onClose,
  initialState = 'not_connected',
  onStateChange
}) {
  const { transactions, addTransactionsBatch, setCurrentPage, isSampleMode } = useFinance();

  const [selectedFip, setSelectedFip] = useState('hdfc');
  const [connectionState, setConnectionState] = useState(initialState);
  const [activeTab, setActiveTab] = useState('connect'); // 'connect' | 'details' | 'privacy'

  // Selected mock account for the demo statement import
  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    return MOCK_AA_ACCOUNTS[0].id;
  });

  // Demo test options
  const [includeInvalidRecord, setIncludeInvalidRecord] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Sync internal state with external initialState prop
  useEffect(() => {
    setConnectionState(initialState);
  }, [initialState]);

  // When bank changes, select the best matching mock account
  useEffect(() => {
    const match = MOCK_AA_ACCOUNTS.find((acc) => acc.bankId === selectedFip);
    if (match) {
      setSelectedAccountId(match.id);
    } else {
      setSelectedAccountId(MOCK_AA_ACCOUNTS[0].id);
    }
    setImportResult(null);
  }, [selectedFip]);

  const selectedBank = SUPPORTED_FIPS.find((b) => b.id === selectedFip) || SUPPORTED_FIPS[0];
  const selectedAccount = MOCK_AA_ACCOUNTS.find((acc) => acc.id === selectedAccountId) || MOCK_AA_ACCOUNTS[0];

  const handleStateTransition = (nextState) => {
    setConnectionState(nextState);
    if (onStateChange) {
      onStateChange(nextState);
    }
  };

  const handleStartConnecting = () => {
    handleStateTransition('connecting');
    setTimeout(() => {
      handleStateTransition('awaiting_consent');
    }, 1000);
  };

  const handleSimulateApproval = () => {
    handleStateTransition('connecting');
    setTimeout(() => {
      handleStateTransition('connected');
    }, 900);
  };

  const handleSimulateFailure = () => {
    handleStateTransition('failed');
  };

  const handleRevokeConsent = () => {
    handleStateTransition('consent_revoked');
    setImportResult(null);
  };

  const handleReset = () => {
    handleStateTransition('not_connected');
    setImportResult(null);
  };

  // Execute Simulated AA Statement Import using aaTransactionAdapter & FinanceContext
  const handleExecuteImport = async () => {
    setIsImporting(true);
    setImportResult(null);

    try {
      // 1. Gather raw candidate records from mock account
      const rawCandidates = [...selectedAccount.transactions];
      if (includeInvalidRecord) {
        rawCandidates.push(MOCK_INVALID_TRANSACTION);
      }

      // 2. Normalize and deduplicate using aaTransactionAdapter
      // Existing ledger transactions are passed for cross-batch deduplication
      const batchResult = batchNormalizeAATransactions(rawCandidates, transactions);

      let importedCount = 0;
      let databaseFailCount = 0;
      const databaseErrors = [];

      // 3. Import valid non-duplicate transactions via existing transaction pipeline
      if (batchResult.validTransactions.length > 0) {
        const insertRes = await addTransactionsBatch(batchResult.validTransactions);
        if (insertRes.success) {
          importedCount = insertRes.imported ?? insertRes.count ?? batchResult.validTransactions.length;
          databaseFailCount = insertRes.failed ?? 0;
          if (Array.isArray(insertRes.errors) && insertRes.errors.length > 0) {
            databaseErrors.push(...insertRes.errors.map((e) => e.error || e.message || String(e)));
          }
        } else {
          databaseFailCount = batchResult.validTransactions.length;
          databaseErrors.push(insertRes.error || 'Failed to insert transactions into ledger');
        }
      }

      // 4. Update structured summary state
      const summary = {
        total: rawCandidates.length,
        imported: importedCount,
        duplicates: batchResult.duplicateCount,
        invalid: batchResult.invalidCount,
        failed: databaseFailCount,
        invalidErrors: batchResult.invalidTransactions.map((item) => {
          return `Row ${item.batchIndex + 1}: ${item.errors.join(', ')}`;
        }),
        databaseErrors
      };

      setImportResult(summary);
    } catch (err) {
      console.error('[AccountAggregatorModal] Demo import error:', err);
      setImportResult({
        total: 0,
        imported: 0,
        duplicates: 0,
        invalid: 0,
        failed: 1,
        invalidErrors: [],
        databaseErrors: [err.message || 'Unexpected error during import']
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleNavigateToTransactions = () => {
    if (onClose) onClose();
    if (setCurrentPage) setCurrentPage('transactions');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Financial Account via Account Aggregator"
      subtitle="Simulated AA Demo • Consent-based statement import using fictional data"
      maxWidth="720px"
      footer={
        <div className="flex items-center justify-between flex-wrap gap-2" style={{ width: '100%' }}>
          <div className="flex items-center gap-2">
            <Badge variant="amber" icon={AlertTriangle} style={{ fontSize: '10px' }}>
              Simulated AA Demo
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
            {connectionState === 'not_connected' && (
              <Button
                variant="primary"
                size="sm"
                icon={Building2}
                onClick={handleStartConnecting}
              >
                Initiate Consent Request (Demo)
              </Button>
            )}
            {connectionState === 'awaiting_consent' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSimulateFailure}
                >
                  Simulate Timeout
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={CheckCircle2}
                  onClick={handleSimulateApproval}
                >
                  Approve Demo Consent
                </Button>
              </>
            )}
            {connectionState === 'connected' && (
              <>
                {importResult && importResult.imported > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={ExternalLink}
                    onClick={handleNavigateToTransactions}
                  >
                    View in Transactions Page
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  icon={Ban}
                  onClick={handleRevokeConsent}
                >
                  Revoke Consent
                </Button>
              </>
            )}
            {(connectionState === 'failed' || connectionState === 'consent_revoked') && (
              <Button
                variant="primary"
                size="sm"
                icon={RefreshCw}
                onClick={handleReset}
              >
                Start Over
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* 1. Architecture Demonstration Advisory Banner */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: '#fffbeb',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #fde68a',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)'
          }}
        >
          <Info size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 'var(--text-xs)', color: '#92400e', lineHeight: 1.5 }}>
            <strong>Simulated AA Demo Notice:</strong> This is an interactive hackathon demonstration of India&apos;s Account Aggregator framework using <strong>fictional test data only</strong>. <strong>No real bank is connected, no credentials are requested, and real consent was not obtained.</strong>
          </div>
        </div>

        {/* 2. Navigation Tabs inside Modal */}
        <div className="flex items-center gap-2 border-b" style={{ borderColor: 'var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>
          <button
            type="button"
            className="btn-ghost"
            style={{
              padding: '4px 10px',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: activeTab === 'connect' ? 'var(--primary-indigo)' : 'var(--text-muted)',
              borderBottom: activeTab === 'connect' ? '2px solid var(--primary-indigo)' : '2px solid transparent',
              borderRadius: 0
            }}
            onClick={() => setActiveTab('connect')}
          >
            Connection &amp; Statement Import Demo
          </button>
          <button
            type="button"
            className="btn-ghost"
            style={{
              padding: '4px 10px',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: activeTab === 'details' ? 'var(--primary-indigo)' : 'var(--text-muted)',
              borderBottom: activeTab === 'details' ? '2px solid var(--primary-indigo)' : '2px solid transparent',
              borderRadius: 0
            }}
            onClick={() => setActiveTab('details')}
          >
            Data Shared &amp; Purpose
          </button>
          <button
            type="button"
            className="btn-ghost"
            style={{
              padding: '4px 10px',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: activeTab === 'privacy' ? 'var(--primary-indigo)' : 'var(--text-muted)',
              borderBottom: activeTab === 'privacy' ? '2px solid var(--primary-indigo)' : '2px solid transparent',
              borderRadius: 0
            }}
            onClick={() => setActiveTab('privacy')}
          >
            Consent &amp; Privacy Safeguards
          </button>
        </div>

        {/* TAB 1: CONNECT & WORKFLOW STATES */}
        {activeTab === 'connect' && (
          <div className="flex flex-col gap-4">
            {/* Quick State Switcher for Reviewers */}
            <div
              style={{
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-2)'
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Demo Connection State:
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { id: 'not_connected', label: '1. Not Connected' },
                  { id: 'connecting', label: '2. Connecting' },
                  { id: 'awaiting_consent', label: '3. Awaiting Consent' },
                  { id: 'connected', label: '4. Connected (Demo)' },
                  { id: 'failed', label: '5. Failed' },
                  { id: 'consent_revoked', label: '6. Consent Revoked' }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: connectionState === s.id ? 'var(--primary-indigo)' : 'transparent',
                      color: connectionState === s.id ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: connectionState === s.id ? 700 : 500
                    }}
                    onClick={() => handleStateTransition(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* STATE 1: NOT CONNECTED */}
            {connectionState === 'not_connected' && (
              <div className="flex flex-col gap-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>
                    Step 1: Select Financial Institution (FIP)
                  </label>
                  <div className="grid grid-cols-2" style={{ gap: 'var(--space-2)' }}>
                    {SUPPORTED_FIPS.map((fip) => (
                      <div
                        key={fip.id}
                        onClick={() => setSelectedFip(fip.id)}
                        style={{
                          padding: 'var(--space-3)',
                          borderRadius: 'var(--radius-md)',
                          border: `1.5px solid ${selectedFip === fip.id ? 'var(--primary-indigo)' : 'var(--border-subtle)'}`,
                          backgroundColor: selectedFip === fip.id ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-surface)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-3)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--bg-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary-indigo)'
                          }}
                        >
                          <Building2 size={16} />
                        </div>
                        <div className="flex flex-col">
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {fip.name}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {fip.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

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
                  <strong>How the demo works:</strong> Clicking &ldquo;Initiate Consent Request (Demo)&rdquo; simulates generating an encrypted consent artifact. In Step 2, you will approve the demo consent to unlock the mock account statement.
                </div>
              </div>
            )}

            {/* STATE 2: CONNECTING (LOADING) */}
            {connectionState === 'connecting' && (
              <div
                className="flex flex-col items-center justify-center gap-3"
                style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center' }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    border: '3px solid var(--border-subtle)',
                    borderTopColor: 'var(--primary-indigo)',
                    animation: 'spin 0.9s linear infinite'
                  }}
                />
                <style>
                  {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
                </style>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                    Contacting Account Aggregator Gateway (Simulated)...
                  </h4>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Establishing secure encrypted session with {selectedBank.name} via NBFC-AA protocol.
                  </p>
                </div>
              </div>
            )}

            {/* STATE 3: AWAITING CONSENT */}
            {connectionState === 'awaiting_consent' && (
              <div className="flex flex-col gap-3">
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
                  <Clock size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <h4 style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', color: '#92400e' }}>
                      Step 2: Consent Request Dispatched (Demo)
                    </h4>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: '#b45309', lineHeight: 1.5 }}>
                      A consent request has been generated for <strong>{selectedBank.name}</strong>. In production, you approve via an SMS OTP or your registered AA app (Setu, OneMoney, Finvu).
                    </p>
                  </div>
                </div>

                {/* Consent Request Artifact Preview */}
                <div
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--text-xs)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Consent Artifact ID:</span>
                    <strong style={{ fontFamily: 'monospace' }}>CR-20261025-SPND-8942</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Financial Entity (FIP):</span>
                    <strong>{selectedBank.name}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Purpose Code:</span>
                    <span>Personal Finance Management (PFM)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Requested Scope:</span>
                    <span>Deposit Account Transactions &amp; Summary</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Consent Duration:</span>
                    <span>1 Year (Explicitly Revocable Anytime)</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSimulateFailure}
                  >
                    Simulate Timeout (Error)
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={CheckCircle2}
                    onClick={handleSimulateApproval}
                  >
                    Approve Demo Consent &rarr;
                  </Button>
                </div>
              </div>
            )}

            {/* STATE 4: CONNECTED — SIMULATED STATEMENT IMPORT WORKFLOW */}
            {connectionState === 'connected' && (
              <div className="flex flex-col gap-4">
                {/* Active Connection Badge Card */}
                <div
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: 'var(--emerald-50, #ecfdf5)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--emerald-200, #a7f3d0)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 'var(--space-2)'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} style={{ color: 'var(--emerald-600)' }} />
                    <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--emerald-900)' }}>
                      Active Simulated Consent: {selectedBank.name}
                    </strong>
                    <Badge variant="emerald" style={{ fontSize: '9px' }}>
                      Consent Verified
                    </Badge>
                  </div>
                  <Badge variant="amber" style={{ fontSize: '9px' }}>
                    Fictional Test Data
                  </Badge>
                </div>

                {/* Step 3: Select Mock Account */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Step 3: Select Linked Mock Account</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>
                      {MOCK_AA_ACCOUNTS.length} mock accounts available
                    </span>
                  </label>
                  <div className="grid grid-cols-3" style={{ gap: 'var(--space-2)' }}>
                    {MOCK_AA_ACCOUNTS.map((acc) => {
                      const isSelected = selectedAccountId === acc.id;
                      return (
                        <div
                          key={acc.id}
                          onClick={() => {
                            setSelectedAccountId(acc.id);
                            setSelectedFip(acc.bankId);
                            setImportResult(null);
                          }}
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            border: `1.5px solid ${isSelected ? 'var(--primary-indigo)' : 'var(--border-subtle)'}`,
                            backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-surface)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {acc.bankName}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {acc.accountNumberMasked} • {acc.accountType}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary-indigo)', marginTop: 2 }}>
                            {formatINR(acc.balance)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Step 4: Statement Preview */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    padding: 'var(--space-3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Statement Preview: {selectedAccount.accountName} ({selectedAccount.accountNumberMasked})
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {selectedAccount.transactions.length} records • {selectedAccount.statementPeriod}
                    </span>
                  </div>

                  {/* Transactions Preview Table */}
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '6px 8px' }}>Date</th>
                          <th style={{ padding: '6px 8px' }}>Narration</th>
                          <th style={{ padding: '6px 8px' }}>Direction</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                          <th style={{ padding: '6px 8px' }}>Mode &amp; Ref</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAccount.transactions.map((t, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                              {formatDate(t.date)}
                            </td>
                            <td style={{ padding: '6px 8px', fontWeight: 500, color: 'var(--text-primary)' }}>
                              {t.narration}
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <Badge variant={t.direction === 'CREDIT' ? 'emerald' : 'neutral'} style={{ fontSize: '9px', padding: '1px 6px' }}>
                                {t.direction}
                              </Badge>
                            </td>
                            <td
                              style={{
                                padding: '6px 8px',
                                textAlign: 'right',
                                fontWeight: 700,
                                color: t.direction === 'CREDIT' ? 'var(--income-emerald)' : 'var(--text-primary)',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {t.direction === 'CREDIT' ? '+' : '-'}{formatINR(t.amount)}
                            </td>
                            <td style={{ padding: '6px 8px', fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {t.paymentMode} • {t.providerTransactionId}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Testing Option: Malformed Record Checkbox */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      marginTop: '4px'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={includeInvalidRecord}
                      onChange={(e) => setIncludeInvalidRecord(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>
                      Include 1 deliberate invalid record (to demonstrate structured validation error reporting)
                    </span>
                  </label>
                </div>

                {/* Import Action Button */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Normalization via <code>aaTransactionAdapter</code> • Deduplication via composite hash
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={isImporting ? RefreshCw : Download}
                    onClick={handleExecuteImport}
                    disabled={isImporting}
                  >
                    {isImporting ? 'Normalizing & Importing...' : 'Import Sample Transactions to Ledger'}
                  </Button>
                </div>

                {/* Import Result Panel */}
                {importResult && (
                  <div
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      backgroundColor: importResult.imported > 0 ? 'var(--emerald-50, #ecfdf5)' : 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${importResult.imported > 0 ? 'var(--emerald-200, #a7f3d0)' : 'var(--border-subtle)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-3)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {importResult.imported > 0 ? (
                          <CheckCircle2 size={16} style={{ color: 'var(--emerald-600)' }} />
                        ) : (
                          <Info size={16} style={{ color: 'var(--primary-indigo)' }} />
                        )}
                        <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                          Simulated AA Import Complete
                        </strong>
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Total Processed: {importResult.total}
                      </span>
                    </div>

                    {/* Accurate Counters Grid */}
                    <div className="grid grid-cols-4" style={{ gap: 'var(--space-2)' }}>
                      <div
                        style={{
                          padding: 'var(--space-2)',
                          backgroundColor: '#fff',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Imported</span>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--emerald-600)' }}>
                          {importResult.imported}
                        </span>
                      </div>

                      <div
                        style={{
                          padding: 'var(--space-2)',
                          backgroundColor: '#fff',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Duplicates Skipped</span>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: importResult.duplicates > 0 ? '#d97706' : 'var(--text-secondary)' }}>
                          {importResult.duplicates}
                        </span>
                      </div>

                      <div
                        style={{
                          padding: 'var(--space-2)',
                          backgroundColor: '#fff',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Invalid Records</span>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: importResult.invalid > 0 ? 'var(--expense-rose)' : 'var(--text-secondary)' }}>
                          {importResult.invalid}
                        </span>
                      </div>

                      <div
                        style={{
                          padding: 'var(--space-2)',
                          backgroundColor: '#fff',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Failed Inserts</span>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: importResult.failed > 0 ? 'var(--expense-rose)' : 'var(--text-secondary)' }}>
                          {importResult.failed}
                        </span>
                      </div>
                    </div>

                    {/* Explanatory notes on deduplication & errors */}
                    {importResult.duplicates > 0 && (
                      <p style={{ margin: 0, fontSize: '11px', color: '#92400e', lineHeight: 1.4 }}>
                        <strong>Deduplication active:</strong> {importResult.duplicates} transaction(s) already existed in your ledger with identical date, amount, description, and direction, and were safely skipped.
                      </p>
                    )}

                    {importResult.invalidErrors.length > 0 && (
                      <div style={{ backgroundColor: 'var(--rose-50, #fff1f2)', border: '1px solid var(--rose-200, #fecdd3)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2)' }}>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--rose-800)' }}>
                          Validation Errors Reported:
                        </span>
                        <ul style={{ margin: '4px 0 0', paddingLeft: '1.2rem', fontSize: '10px', color: 'var(--rose-700)' }}>
                          {importResult.invalidErrors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Navigation shortcut */}
                    {importResult.imported > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span style={{ fontSize: '11px', color: 'var(--emerald-800)' }}>
                          Imported transactions are tagged with <strong>Account Aggregator</strong> source.
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={ArrowRight}
                          onClick={handleNavigateToTransactions}
                        >
                          View in Transactions
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STATE 5: FAILED */}
            {connectionState === 'failed' && (
              <div className="flex flex-col gap-3">
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--rose-50, #fff1f2)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--rose-200, #fecdd3)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-3)'
                  }}
                >
                  <AlertCircle size={22} style={{ color: 'var(--expense-rose)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <h4 style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', color: 'var(--rose-800, #9f1239)' }}>
                      Account Connection Failed (Simulated)
                    </h4>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--rose-700, #be123c)', lineHeight: 1.5 }}>
                      The consent authorization session expired or was rejected by the bank server (Reason: FIP_TIMEOUT). No financial information was accessed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* STATE 6: CONSENT REVOKED */}
            {connectionState === 'consent_revoked' && (
              <div className="flex flex-col gap-3">
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
                  <Ban size={22} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <h4 style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      Consent Successfully Revoked
                    </h4>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      As per RBI regulations, your consent artifact has been marked REVOKED. SpendSense will perform no further statement fetches from <strong>{selectedBank.name}</strong>. Historic records in your ledger remain preserved.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DATA SHARED & PURPOSE */}
        {activeTab === 'details' && (
          <div className="flex flex-col gap-3">
            <h4 style={{ fontSize: 'var(--text-sm)', margin: '0 0 4px', color: 'var(--text-primary)' }}>
              Transparency Notice: What Data is Shared &amp; Why
            </h4>
            <div className="grid grid-cols-2" style={{ gap: 'var(--space-3)' }}>
              <div
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Check size={14} style={{ color: 'var(--emerald-600)' }} />
                  <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                    What You Share (Read-Only)
                  </strong>
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <li>Masked bank account number (last 4 digits)</li>
                  <li>Transaction dates, timestamps, and narrations</li>
                  <li>Debit and credit transaction amounts</li>
                  <li>Running account balance</li>
                </ul>
              </div>

              <div
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: '#fef2f2',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #fecdd3'
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Lock size={14} style={{ color: 'var(--expense-rose)' }} />
                  <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--rose-800)' }}>
                    What is NEVER Accessed or Stored
                  </strong>
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '11px', color: 'var(--rose-700)', lineHeight: 1.6 }}>
                  <li>Internet banking login IDs or passwords</li>
                  <li>Debit or credit card PINs or CVVs</li>
                  <li>One-Time Passwords (OTPs)</li>
                  <li>Ability to initiate fund transfers or payments</li>
                </ul>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5
              }}
            >
              <strong>Why This Data is Needed:</strong> SpendSense uses read-only statement data to automatically organize your income and expense categories, calculate monthly savings rates, flag overspending alerts, and power the purchase affordability simulator without requiring manual spreadsheet imports.
            </div>
          </div>
        )}

        {/* TAB 3: CONSENT & PRIVACY SAFEGUARDS */}
        {activeTab === 'privacy' && (
          <div className="flex flex-col gap-3">
            <h4 style={{ fontSize: 'var(--text-sm)', margin: '0 0 4px', color: 'var(--text-primary)' }}>
              RBI Master Direction &amp; Consent Principles
            </h4>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                lineHeight: 1.55
              }}
            >
              <div className="flex items-start gap-2">
                <ShieldCheck size={15} style={{ color: 'var(--emerald-600)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Explicit Consent:</strong> Data is never retrieved without your proactive, digital authorization via your chosen Account Aggregator app.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Clock size={15} style={{ color: 'var(--primary-indigo)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Time-Bound Validity:</strong> Consent is limited to a pre-defined validity window (e.g. 1 year). Expired consents require re-authorization.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Ban size={15} style={{ color: 'var(--expense-rose)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Unconditional Right to Revoke:</strong> You can revoke consent at any moment directly from SpendSense or your AA app. Revocation immediately halts all data requests.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Lock size={15} style={{ color: 'var(--warning-amber)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>End-to-End Encryption:</strong> Financial data is encrypted by your bank (FIP) using asymmetric keys and can only be decrypted by the certified Financial Information User (FIU).
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
