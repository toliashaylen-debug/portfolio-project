// Original geometric mark — deliberately not a reproduction of any real
// institution's logo. Three ascending columns (a classical banking motif) rising
// out of a navy tile, with the tallest picked out in gold.
export default function BrandMark({ size = 30, variant = 'tile' }: { size?: number; variant?: 'tile' | 'light' }) {
  const bg = variant === 'light' ? '#FFFFFF' : '#0E2C4F';
  const bar = variant === 'light' ? '#0E2C4F' : '#FFFFFF';
  const accent = '#B4924C';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="brand-mark" aria-hidden="true">
      <rect x="0" y="0" width="32" height="32" rx="8" fill={bg} />
      <rect x="8" y="18" width="3.6" height="7" rx="1" fill={bar} opacity="0.75" />
      <rect x="14.2" y="14" width="3.6" height="11" rx="1" fill={bar} opacity="0.88" />
      <rect x="20.4" y="8" width="3.6" height="17" rx="1" fill={accent} />
    </svg>
  );
}

/** Mark plus wordmark, for headers and gates. */
export function BrandLockup({ size = 32, variant = 'dark', subtitle = 'Private Investment Desk' }: {
  size?: number;
  variant?: 'dark' | 'light';
  subtitle?: string | null;
}) {
  const light = variant === 'light';
  return (
    <div className="brand-lockup">
      <BrandMark size={size} variant={light ? 'light' : 'tile'} />
      <div className="brand-lockup-text">
        <div className="brand-wordmark" style={{ color: light ? '#FFFFFF' : 'var(--navy)' }}>Safra</div>
        {subtitle ? (
          <div className="brand-subtitle" style={{ color: light ? 'rgba(255,255,255,0.62)' : 'var(--text-faint)' }}>
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
