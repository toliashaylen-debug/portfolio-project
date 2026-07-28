export default function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" className="desk-brand-mark" aria-hidden="true">
      <rect x="0" y="0" width="30" height="30" rx="7" fill="#144B87" />
      <path d="M7 19 L12.5 12.5 L16.5 16.5 L23 8" stroke="#FFFFFF" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23" cy="8" r="1.8" fill="#FFFFFF" />
    </svg>
  );
}
