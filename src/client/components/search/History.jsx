import { History as HistoryIcon, Trash2, ArrowUpRight } from 'lucide-react';
import { formatIdentifier } from '../../../shared/identifiers.js';
import { formatRelative, cx } from '../../utils/format.js';

/**
 * Liste des 10 dernières recherches (localStorage). Un clic relance la recherche.
 * @param {{ items: Array<{ id: string, name: string|null, pa: string|null, found: boolean|null, at: string }>, onSelect: Function, onClear: Function }} props
 */
export function History({ items, onSelect, onClear }) {
  if (!items.length) return null;
  return (
    <section className="animate-fade mx-auto w-full max-w-2xl">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="label flex items-center gap-1.5">
          <HistoryIcon className="size-3.5" /> Recherches récentes
        </h2>
        <button type="button" onClick={onClear} className="btn-ghost h-7 px-2 text-xs">
          <Trash2 className="size-3.5" /> Vider
        </button>
      </div>
      <ul className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <span
                className={cx(
                  'size-2 shrink-0 rounded-full',
                  item.found === true && 'bg-emerald-500',
                  item.found === false && 'bg-slate-300 dark:bg-slate-600',
                  item.found == null && 'bg-amber-400',
                )}
                title={item.found ? 'Inscrit sur Peppol' : item.found === false ? 'Non trouvé' : 'Erreur'}
              />
              <span className="w-40 shrink-0 font-mono text-[13px] text-slate-600 dark:text-slate-300">{formatIdentifier(item.id)}</span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {item.name || <span className="text-slate-400">{item.found === false ? 'Non inscrit' : '—'}</span>}
                {item.pa && <span className="text-slate-400"> · {item.pa}</span>}
              </span>
              <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{formatRelative(item.at)}</span>
              <ArrowUpRight className="size-4 shrink-0 text-slate-300 transition group-hover:text-accent-500 dark:text-slate-600" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
