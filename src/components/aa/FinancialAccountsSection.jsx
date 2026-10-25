import React, { useState, useMemo } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { AccountAggregatorModal } from './AccountAggregatorModal';
import { useFinance } from '../../hooks/useFinance';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Lock,
  ArrowRight,
  ExternalLink,
  Info,
  Clock,
  Check,
  Ban,
  RefreshCw,
  Landmark,
  FileCheck2,
  EyeOff,
  Download
} from 'lucide-react';

/**
 * FinTrack — Financial Accounts Connection Section
 *
 * Implements the responsive "Connect financial accounts" UI within Settings,
 * providing comprehensive explanations of the RBI Account Aggregator ecosystem,
 * data sharing disclosures, consent privacy information, and an interactive
 * state explorer supporting all 6 connection states:
 * - not_connected
 * - connecting
 * - awaiting_consent
 * - connected
 * - failed
 * - consent_revoked
 *
 * Now connected to the Simulated AA Demo statement import workflow!
 */
export function FinancialAccountsSection() {
  const { transactions, setCurrentPage } = useFinance();
  const [activeState, setActiveState] = useState('not_connected');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Count transactions originating from Account Aggregator in the active ledger
  const aaTransactionsCount = useMemo(() => {
    return (transactions || []).filter(
      (t) => t.source === 'aa' || t.source === 'account_aggregator' || t.source === 'bank_sync'
    ).length;
  }, [transactions]);

  const getStateBadge = (state) => {
    switch (state) {
      case 'connected':
        return <Badge variant="emerald" icon={CheckCircle2}>Connected (Demo)</Badge>;
      case 'connecting':
        return <Badge variant="indigo" icon={RefreshCw}>Connecting...</Badge>;
      case 'awaiting_consent':
        return <Badge variant="amber" icon={Clock}>Awaiting Consent</Badge>;
      case 'failed':
        return <Badge variant="rose" icon={AlertCircle}>Connection Failed</Badge>;
      case 'consent_revoked':
        return <Badge variant="neutral" icon={Ban}>Consent Revoked</Badge>;
      case 'not_connected':
      default:
        return <Badge variant="neutral">Not Connected</Badge>;
    }
  };

  return (
    <Card
      title="Connect Financial Accounts (Account Aggregator)"
      subtitle="Simulated AA Demo • Consent-based statement import using fictional banking data"
      action={
        <Badge variant="indigo" icon={ShieldCheck}>
          RBI Regulated (NBFC-AA)
        </Badge>
      }
    >
      <div className="flex flex-col gap-5">
        {/* 1. Header Overview & Connection State Bar */}
        <div
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)'
          }}
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                color: 'var(--primary-indigo)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Landmark size={22} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                  Bank Connection Status:
                </span>
                {getStateBadge(activeState)}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {activeState === 'connected'
                  ? `HDFC Bank Salary Account (•••• 4821) linked via Simulated AA Demo (${aaTransactionsCount} AA transaction(s) in active ledger).`
                  : activeState === 'awaiting_consent'
                    ? 'Consent request pending approval in your AA mobile app.'
                    : activeState === 'connecting'
                      ? 'Establishing handshake with Account Aggregator gateway...'
                      : activeState === 'failed'
                        ? 'Last connection attempt failed due to server timeout.'
                        : activeState === 'consent_revoked'
                          ? 'Consent artifact revoked. Statement syncing is stopped.'
                          : 'No external bank accounts currently linked to FinTrack.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={Building2}
              onClick={() => setIsModalOpen(true)}
            >
              {activeState === 'connected' ? 'Manage & Import Statement' : 'Connect Financial Account (Demo)'}
            </Button>
          </div>
        </div>

        {/* 2. Interactive State Explorer (Demo / Sandbox Control) */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)'
          }}
        >
          <div className="flex items-center gap-2">
            <Badge variant="amber" icon={AlertTriangle} style={{ fontSize: '10px' }}>
              Evaluation Controls
            </Badge>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Simulate Connection States:
            </span>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {[
              { id: 'not_connected', label: '1. Not Connected' },
              { id: 'connecting', label: '2. Connecting' },
              { id: 'awaiting_consent', label: '3. Awaiting Consent' },
              { id: 'connected', label: '4. Connected (Demo)' },
              { id: 'failed', label: '5. Failed' },
              { id: 'consent_revoked', label: '6. Revoked' }
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${activeState === st.id ? 'var(--primary-indigo)' : 'var(--border-subtle)'}`,
                  backgroundColor: activeState === st.id ? 'var(--primary-indigo)' : 'var(--bg-subtle)',
                  color: activeState === st.id ? '#fff' : 'var(--text-secondary)',
                  fontWeight: activeState === st.id ? 700 : 500,
                  cursor: 'pointer'
                }}
                onClick={() => setActiveState(st.id)}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Active State Card View */}
        {activeState === 'connected' && (
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--emerald-50, #ecfdf5)',
              border: '1px solid var(--emerald-200, #a7f3d0)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)'
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--emerald-600)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  <Building2 size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--emerald-900, #064e3b)' }}>
                      HDFC Bank Ltd. — Corporate Salary Account
                    </strong>
                    <Badge variant="emerald" style={{ fontSize: '9px' }}>
                      Active Demo Consent
                    </Badge>
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--emerald-700, #047857)' }}>
                    Account: •••• 4821 | Active AA transactions in ledger: <strong>{aaTransactionsCount}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={Download}
                  onClick={() => setIsModalOpen(true)}
                >
                  Import Sample Transactions
                </Button>
                {aaTransactionsCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={ExternalLink}
                    onClick={() => setCurrentPage('transactions')}
                  >
                    View ({aaTransactionsCount}) in Ledger
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setActiveState('consent_revoked')}
                >
                  Revoke Consent
                </Button>
              </div>
            </div>

            <div
              style={{
                fontSize: '11px',
                color: '#92400e',
                backgroundColor: '#fffbeb',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #fde68a',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)'
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>
                <strong>Simulated AA Demo:</strong> Uses fictional test transactions. Records are normalized via <code>aaTransactionAdapter</code> and saved using the standard authenticated pipeline.
              </span>
            </div>
          </div>
        )}

        {activeState === 'awaiting_consent' && (
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-3)'
            }}
          >
            <div className="flex items-start gap-3">
              <Clock size={20} style={{ color: '#d97706', marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: '#92400e' }}>
                  Awaiting Consent Approval (CR-20261025-SPND-8942)
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: '#b45309', lineHeight: 1.5 }}>
                  A consent request has been generated for your bank. Open your preferred Account Aggregator app (Setu, Finvu, OneMoney) to approve statement sharing.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setActiveState('connected')}
              >
                Approve (Demo)
              </Button>
            </div>
          </div>
        )}

        {activeState === 'failed' && (
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--rose-50, #fff1f2)',
              border: '1px solid var(--rose-200, #fecdd3)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-3)'
            }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle size={20} style={{ color: 'var(--expense-rose)', marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--rose-900, #881337)' }}>
                  Bank Connection Failed (FIP_TIMEOUT)
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--rose-700, #be123c)', lineHeight: 1.5 }}>
                  The bank server did not respond to the consent request. No financial information was accessed.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => setActiveState('connecting')}
            >
              Retry Connection
            </Button>
          </div>
        )}

        {activeState === 'consent_revoked' && (
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-3)'
            }}
          >
            <div className="flex items-start gap-3">
              <Ban size={20} style={{ color: 'var(--text-muted)', marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                  Consent Revoked for HDFC Bank
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  All automated statement fetching has been stopped. Existing records remain safely stored in your ledger.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveState('not_connected')}
            >
              Link New Account
            </Button>
          </div>
        )}

        {/* 4. What Data You Share & Why (Educational Transparency Cards) */}
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
              <FileCheck2 size={16} style={{ color: 'var(--emerald-600)' }} />
              <span>What Financial Data You Share</span>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
              Only read-only statement data is shared: transaction dates, narrations (merchant names), amounts, debit/credit types, and ending balance.
            </p>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-surface)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <strong>Purpose:</strong> Powers automatic transaction categorization, accurate cash-flow forecasts, and monthly savings tracking without manual CSV uploads.
            </div>
          </div>

          <div
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
            <div className="flex items-center gap-2" style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: '#92400e' }}>
              <EyeOff size={16} style={{ color: '#d97706' }} />
              <span>What is NEVER Accessed or Requested</span>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: '#92400e', margin: 0, lineHeight: 1.55 }}>
              FinTrack <strong>never</strong> asks for, handles, or stores your internet banking user ID, netbanking passwords, ATM PINs, OTPs, or debit/credit card CVVs.
            </p>
            <div
              style={{
                fontSize: '11px',
                color: '#b45309',
                backgroundColor: 'rgba(255, 255, 255, 0.6)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #fde68a'
              }}
            >
              <strong>Zero Payment Ability:</strong> Account Aggregator consent is strictly read-only. It cannot initiate transfers or debit funds from your account.
            </div>
          </div>
        </div>

        {/* 5. Consent & Privacy Principles Section */}
        <div
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--bg-surface-hover)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)'
          }}
        >
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)' }}>
              RBI Account Aggregator Privacy Principles &amp; Guarantees
            </span>
            <Badge variant="indigo" style={{ fontSize: '10px' }}>
              ReBIT Standard Compliant
            </Badge>
          </div>

          <div className="grid grid-cols-3" style={{ gap: 'var(--space-3)' }}>
            <div className="flex flex-col gap-1">
              <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                1. Explicit &amp; Granular
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                You decide which accounts to share and for what duration. No blanket access is granted.
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                2. Asymmetric Encryption
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Financial information is encrypted by your bank and can only be decrypted inside your private workspace.
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                3. Instant Revocation
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                You can revoke consent at any moment with a single click, instantly terminating data flows.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Aggregator Consent & Statement Import Modal */}
      <AccountAggregatorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialState={activeState}
        onStateChange={(newState) => setActiveState(newState)}
      />
    </Card>
  );
}
