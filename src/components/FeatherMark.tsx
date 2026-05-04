interface Props {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Pensive brand mark — warm red-orange feather with brown spine.
 */
export function FeatherMark({ size = 24, className, title = 'Pensive' }: Props) {
  const gid = 'fm' + Math.random().toString(36).slice(2, 8);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={`${gid}-body`} x1="14" y1="6" x2="50" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e85a3c" />
          <stop offset="55%" stopColor="#c63d24" />
          <stop offset="100%" stopColor="#7a2d1a" />
        </linearGradient>
        <linearGradient id={`${gid}-spine`} x1="20" y1="8" x2="44" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5c2818" />
          <stop offset="100%" stopColor="#2b1208" />
        </linearGradient>
      </defs>
      <path
        d="M50 8 C 56 22 52 40 38 50 L 18 56 L 22 44 C 24 30 30 18 50 8 Z"
        fill={`url(#${gid}-body)`}
        stroke={`url(#${gid}-spine)`}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <g stroke={`url(#${gid}-spine)`} strokeWidth={1.6} strokeLinecap="round" opacity={0.6}>
        <line x1="44" y1="14" x2="33" y2="20" />
        <line x1="46" y1="20" x2="31" y2="27" />
        <line x1="46" y1="27" x2="29" y2="34" />
        <line x1="44" y1="34" x2="27" y2="41" />
        <line x1="40" y1="41" x2="25" y2="47" />
      </g>
      <path
        d="M50 8 C 36 22 26 36 22 50"
        stroke={`url(#${gid}-spine)`}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
      <path d="M22 50 L 14 60" stroke={`url(#${gid}-spine)`} strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  );
}
