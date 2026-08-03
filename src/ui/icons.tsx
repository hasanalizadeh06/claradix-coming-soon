/**
 * Inline SVG only. Four social icons and two glyphs do not justify a 400KB
 * icon package, and inlining means they paint with the first HTML byte instead
 * of waiting on a second request.
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function ArrowRight() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M5 12h13M12 5l7 7-7 7" />
    </svg>
  );
}

export function Spinner() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

export function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M4 12.5l5.5 5.5L20 7" />
    </svg>
  );
}

export function LinkedIn() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.71h.05c.53-.95 1.83-1.96 3.77-1.96 4.03 0 4.78 2.5 4.78 5.76V21h-4v-5.7c0-1.36-.03-3.1-2-3.1-2 0-2.3 1.48-2.3 3v5.8h-4V9Z" />
    </svg>
  );
}

export function Instagram() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Facebook() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.63c-.29-.04-1.27-.13-2.41-.13-2.38 0-4.01 1.45-4.01 4.12V9.9H7.5V13h2.78v8h3.22Z" />
    </svg>
  );
}

