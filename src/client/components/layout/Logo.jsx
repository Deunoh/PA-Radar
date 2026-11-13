/**
 * Logo PAradar « Balise » : une facture au coin replié qui émet un signal.
 * Le fond suit la couleur d'accent (plus claire en mode sombre) ; le signal est ambre.
 */
export function Logo({ className = 'size-8' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="11" className="fill-accent-700 dark:fill-accent-500" />
      <path d="M15 13h12l6 6v16H15z" fill="#fff" />
      <path d="M27 13v6h6" fill="#cfe0e6" />
      <path d="M19 24h10M19 28.5h7" strokeWidth="2.2" strokeLinecap="round" className="stroke-accent-700 dark:stroke-accent-500" />
      <path d="M33 9.5a7 7 0 0 1 5.5 5.5M33 5.5a11 11 0 0 1 9.5 9.5" stroke="#f2b33d" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
