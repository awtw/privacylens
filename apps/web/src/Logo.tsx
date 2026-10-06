/** PrivacyLens mark: scan frame, text lines, one line redacted by a slanted orange bar (slant echoes 8plus "%"). */
export function Logo({ size = 28, ink = '#fff' }: { size?: number; ink?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" role="img" aria-label="PrivacyLens">
      <path d="M14 34V14H34M66 14H86V34M86 66V86H66M34 86H14V66" stroke={ink} strokeWidth="7" strokeLinecap="square" />
      <rect x="28" y="30" width="44" height="7" rx="3.5" fill={ink} />
      <path d="M30 44H78L74 57H26Z" fill="#FE5000" />
      <rect x="28" y="64" width="30" height="7" rx="3.5" fill={ink} />
    </svg>
  );
}
