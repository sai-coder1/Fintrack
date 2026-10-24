import React from 'react';

/**
 * Clean semantic status badge
 */
export function Badge({
  children,
  variant = 'neutral', // 'teal' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'neutral'
  icon: Icon,
  className = ''
}) {
  return (
    <span className={`badge badge-${variant} ${className}`.trim()}>
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}
