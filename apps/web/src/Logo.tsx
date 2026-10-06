/** 8plus % mark (geometry from 8plus design system), with the large dot in brand orange. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" role="img" aria-label="PrivacyLens">
      <g fill="#fff">
        <circle cx="32" cy="29" r="18" />
        <path d="M53 9H68L36 91H21L53 9Z" />
      </g>
      <circle cx="70" cy="64" r="28" fill="#FE5000" />
    </svg>
  );
}
