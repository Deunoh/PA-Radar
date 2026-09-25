import { useEffect, useRef, useState } from 'react';
import { Radar, Moon, Sun, Settings2, Check } from 'lucide-react';
import { cx } from '../../utils/format.js';

const SML_OPTIONS = [
  { value: 'peppolprod', label: 'Production', hint: 'peppolprod' },
  { value: 'peppoltest', label: 'Test', hint: 'peppoltest' },
];

/**
 * En-tête : logo, onglets, réglages (SML) et bascule du thème.
 */
export function Header({ tabs, activeTab, onTabChange, isDark, onToggleTheme, sml, onSmlChange }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-slate-50/80 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 sm:px-6">
        <a href="#" onClick={(e) => { e.preventDefault(); onTabChange('search'); }} className="flex shrink-0 items-center gap-2 py-3">
          <span className="relative grid size-8 place-items-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-sm shadow-accent-600/30">
            <Radar className="size-[18px]" strokeWidth={2.2} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            PA<span className="text-accent-600 dark:text-accent-400">radar</span>
          </span>
        </a>

        <nav className="-mb-px ml-2 flex min-w-0 flex-1 gap-1 self-stretch overflow-x-auto sm:ml-6" aria-label="Sections">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={active ? 'page' : undefined}
                title={tab.label}
                className={cx(
                  'flex shrink-0 items-center gap-1.5 border-b-2 px-3 sm:px-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-accent-600 text-slate-900 dark:border-accent-400 dark:text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                <Icon className="size-4" />
                {/* Sur mobile, icônes seules (libellé lu par les lecteurs d'écran) */}
                <span className="sr-only sm:not-sr-only">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          {sml !== 'peppolprod' && (
            <span className="hidden rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 sm:inline dark:bg-amber-500/15 dark:text-amber-300">
              SML test
            </span>
          )}
          <SettingsMenu sml={sml} onSmlChange={onSmlChange} />
          <button
            type="button"
            onClick={onToggleTheme}
            className="btn-ghost size-9 !p-0"
            title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
            aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}

/** Petit menu de réglages : choix du SML (réseau Peppol de production ou de test). */
function SettingsMenu({ sml, onSmlChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost size-9 !p-0"
        title="Réglages"
        aria-label="Réglages"
        aria-expanded={open}
      >
        <Settings2 className="size-4" />
      </button>
      {open && (
        <div className="popover animate-enter absolute right-0 mt-2 w-60 p-1.5">
          <p className="label px-2.5 pt-1.5 pb-2">Réseau Peppol (SML)</p>
          {SML_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onSmlChange(opt.value);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span>
                {opt.label} <span className="font-mono text-xs text-slate-400">{opt.hint}</span>
              </span>
              {sml === opt.value && <Check className="size-4 text-accent-600 dark:text-accent-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
