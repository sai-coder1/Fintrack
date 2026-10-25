import {
  FileSpreadsheet,
  Building2,
  User,
  Sparkles
} from 'lucide-react';

/**
 * Resolves standard metadata for a transaction origin/source.
 * Distinguishes between Manual Entry, CSV Import, Account Aggregator, and Demo Sample.
 *
 * @param {string} source - Transaction source string
 * @returns {{ id: string, label: string, shortLabel: string, variant: string, Icon: any, tooltip: string }}
 */
export function getTransactionSourceInfo(source) {
  const norm = (source || '').toLowerCase().trim();

  switch (norm) {
    case 'aa':
    case 'account_aggregator':
    case 'bank_sync':
    case 'fip':
      return {
        id: 'aa',
        label: 'Account Aggregator',
        shortLabel: 'AA Sync',
        variant: 'emerald',
        Icon: Building2,
        tooltip: 'Synced automatically via RBI-regulated Account Aggregator'
      };

    case 'csv':
    case 'csv_import':
    case 'statement_import':
      return {
        id: 'csv',
        label: 'CSV Import',
        shortLabel: 'CSV',
        variant: 'indigo',
        Icon: FileSpreadsheet,
        tooltip: 'Imported from bank statement CSV spreadsheet'
      };

    case 'sample':
    case 'demo':
      return {
        id: 'sample',
        label: 'Demo Sample',
        shortLabel: 'Demo',
        variant: 'amber',
        Icon: Sparkles,
        tooltip: 'Pre-loaded realistic mock transaction'
      };

    case 'manual':
    case 'supabase':
    default:
      return {
        id: 'manual',
        label: 'Manual',
        shortLabel: 'Manual',
        variant: 'neutral',
        Icon: User,
        tooltip: 'Manually entered transaction'
      };
  }
}
