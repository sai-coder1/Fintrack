import React from 'react';

/**
 * Metric KPI card for financial figures (balance, income, expenses, etc.)
 */
export function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  variant = 'neutral', // 'teal' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'neutral'
  badgeText,
  badgeVariant,
  className = ''
}) {
  const iconBgMap = {
    indigo: 'var(--soft-indigo-bg)',
    emerald: 'var(--soft-emerald-bg)',
    amber: 'var(--soft-amber-bg)',
    rose: 'var(--soft-rose-bg)',
    teal: 'var(--soft-indigo-bg)',
    neutral: 'var(--bg-subtle)'
  };

  const iconColorMap = {
    indigo: 'var(--primary-indigo)',
    emerald: 'var(--emerald-600)',
    amber: 'var(--amber-600)',
    rose: 'var(--expense-rose)',
    teal: 'var(--primary-indigo)',
    neutral: 'var(--text-secondary)'
  };

  return (
    <div className={`stat-card ${className}`.trim()}>
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        {Icon && (
          <div
            className="stat-card-icon"
            style={{
              backgroundColor: iconBgMap[variant] || iconBgMap.neutral,
              color: iconColorMap[variant] || iconColorMap.neutral
            }}
          >
            <Icon size={18} />
          </div>
        )}
      </div>

      <div className="stat-card-value">{value}</div>

      {(subtext || badgeText) && (
        <div className="stat-card-footer">
          {badgeText && (
            <span className={`badge badge-${badgeVariant || variant}`}>
              {badgeText}
            </span>
          )}
          {subtext && <span>{subtext}</span>}
        </div>
      )}
    </div>
  );
}
