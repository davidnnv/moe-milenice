// Paw-and-heart mark + wordmark.
export function Paw({ size = 40, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g fill="currentColor">
        <ellipse cx="32" cy="40" rx="11" ry="9" />
        <ellipse cx="18.5" cy="28" rx="4.6" ry="6" />
        <ellipse cx="27" cy="20.5" rx="4.6" ry="6" />
        <ellipse cx="37" cy="20.5" rx="4.6" ry="6" />
        <ellipse cx="45.5" cy="28" rx="4.6" ry="6" />
      </g>
      <path d="M32 46.5c-3.6-2.4-6-4.4-6-7a3.3 3.3 0 0 1 6-1.9 3.3 3.3 0 0 1 6 1.9c0 2.6-2.4 4.6-6 7z" fill="var(--peach)" />
    </svg>
  );
}

export function Brand({ lang = 'mk', small = false }) {
  return (
    <span className={`brand${small ? ' brand--small' : ''}`}>
      <span className="brand__mark">
        <Paw size={small ? 26 : 30} />
      </span>
      <span className="brand__text">
        <span className="brand__name">{lang === 'en' ? 'Moe Milenice' : 'Мое Милениче'}</span>
        <span className="brand__sub">grooming salon</span>
      </span>
    </span>
  );
}

export function Stars({ value = 5 }) {
  return (
    <span className="stars" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" width="16" height="16" className={i < Math.round(value) ? 'on' : ''}>
          <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" />
        </svg>
      ))}
    </span>
  );
}
