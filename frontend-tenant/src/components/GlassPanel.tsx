import React from 'react';

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ header, footer, children, className = '', ...rest }) => {
  const baseStyle: React.CSSProperties = {
    backdropFilter: 'blur(10px) saturate(140%)',
    WebkitBackdropFilter: 'blur(10px) saturate(140%)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 8px 24px rgba(6,10,22,0.45), 0 1px 0 rgba(255,255,255,0.03) inset',
  };

  return (
    <div {...rest} className={`relative ${className}`} style={{ ...baseStyle, ...(rest.style as React.CSSProperties) }}>
      {header && (
        <div className="px-4 pt-3 pb-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.02)' }}>
          {header}
        </div>
      )}

      <div className="p-4">{children}</div>

      {footer && (
        <div className="px-4 pt-2 pb-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.02)' }}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default GlassPanel;
