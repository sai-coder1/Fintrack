import React from 'react';

/**
 * Surface card container with optional header, title, subtitle, and footer
 */
export function Card({
  title,
  subtitle,
  action,
  children,
  footer,
  className = '',
  bodyClassName = '',
  ...props
}) {
  const hasHeader = Boolean(title || subtitle || action);

  return (
    <div className={`card ${className}`.trim()} {...props}>
      {hasHeader && (
        <div className="card-header">
          <div className="card-title-group">
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {action && <div className="card-header-action">{action}</div>}
        </div>
      )}
      <div className={`card-body ${bodyClassName}`.trim()}>
        {children}
      </div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}
