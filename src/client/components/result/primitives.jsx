/**
 * Petits composants réutilisables : bouton copier, badge, section repliable.
 */
import { useState } from 'react';
import { Check, Copy, ChevronRight } from 'lucide-react';
import { useCopy } from '../../hooks/useCopy.js';
import { cx } from '../../utils/format.js';

export function CopyButton({ value, label = 'Copier', message, className }) {
  const copy = useCopy();
  const [done, setDone] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={async (e) => {
        e.stopPropagation();
        if (await copy(String(value), message)) {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        }
      }}
      className={cx(
        'grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200',
        className,
      )}
    >
      {done ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </button>
  );
}

const BADGE_TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  blue: 'bg-accent-50 text-accent-700 ring-accent-600/15 dark:bg-accent-500/10 dark:text-accent-300 dark:ring-accent-400/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  red: 'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/15',
};

export function Badge({ tone = 'slate', icon: Icon, children, className }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', BADGE_TONES[tone], className)}>
      {Icon && <Icon className="size-3.5" />}
      {children}
    </span>
  );
}

/** Section repliable (bordure supérieure, en-tête cliquable). */
export function Collapsible({ title, icon: Icon, count, defaultOpen = false, actions, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-2 px-5 sm:px-7">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 py-3.5 text-left text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <ChevronRight className={cx('size-4 text-slate-400 transition-transform duration-200', open && 'rotate-90')} />
          {Icon && <Icon className="size-4 text-slate-400" />}
          {title}
          {count != null && <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">{count}</span>}
        </button>
        {open && actions}
      </div>
      <div className={cx('grid transition-[grid-template-rows] duration-300 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="px-5 pb-5 sm:px-7">{children}</div>
        </div>
      </div>
    </section>
  );
}
