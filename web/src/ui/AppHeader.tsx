import type { ReactNode } from 'react';

interface AppHeaderProps {
  /** Right-hand side of the bar (status chips). */
  children?: ReactNode;
}

function LogoMark() {
  return (
    <svg className="brand__mark" viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id="brand-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b7bff" />
          <stop offset="1" stopColor="#3dd6c6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#brand-gradient)" />
      <g stroke="#0a0c11" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M20 17v9M20 26l-5 7M20 26l5 7M20 19l-7-5M20 19l8-7" />
      </g>
      <circle cx="20" cy="11.5" r="3.6" fill="#0a0c11" />
    </svg>
  );
}

export function AppHeader({ children }: AppHeaderProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <LogoMark />
        <div>
          <h1 className="brand__name">EmoteCap</h1>
          <p className="brand__tagline">Act once. Animate anything.</p>
        </div>
      </div>
      {children}
    </header>
  );
}
