import React from 'react';
import { Badge } from './Badge';
import { getTransactionSourceInfo } from '../../utils/transactionSource.js';

export { getTransactionSourceInfo };

/**
 * Reusable visual badge displaying the provenance/origin of a transaction.
 */
export function TransactionSourceBadge({
  source,
  short = false,
  showIcon = true,
  className = ''
}) {
  const info = getTransactionSourceInfo(source);
  const IconComponent = info.Icon;

  return (
    <span title={info.tooltip} style={{ display: 'inline-flex' }}>
      <Badge
        variant={info.variant}
        icon={showIcon ? IconComponent : undefined}
        className={className}
      >
        {short ? info.shortLabel : info.label}
      </Badge>
    </span>
  );
}
