interface Props {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Pensive brand mark — the 🪶 feather emoji, system-rendered.
 * Matches the feather emoji used in the welcome note + sample content.
 */
export function FeatherMark({ size = 24, className, title = 'Pensive' }: Props) {
  return (
    <span
      role="img"
      aria-label={title}
      className={className}
      style={{
        fontSize: size,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
      }}
    >
      🪶
    </span>
  );
}
