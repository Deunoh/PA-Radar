import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, CircleDashed, AlertTriangle, XCircle, Flag, ArrowUpRight } from 'lucide-react';
import { formatIdentifier } from '../../../shared/identifiers.js';
import { cx } from '../../utils/format.js';

const COLUMNS = [
  { key: 'id', label: 'SIRET / SIREN', get: (i) => i.id },
  { key: 'companyName', label: 'Nom', get: (i) => i.companyName || '' },
  { key: 'peppol', label: 'Peppol', get: (i) => (i.status === 'found' ? 0 : 1) },
  { key: 'frenchReform', label: 'Réforme FR', get: (i) => (i.frenchReform ? 0 : 1) },
  { key: 'pa', label: 'PA', get: (i) => i.pa || '￿' },
  { key: 'popId', label: 'ID POP', get: (i) => i.popId || '￿' },
  { key: 'status', label: 'Statut', get: (i) => i.status },
];

const STATUS = {
  found: { label: 'Trouvé', icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400' },
  not_found: { label: 'Non inscrit', icon: CircleDashed, cls: 'text-slate-400' },
  error: { label: 'Erreur', icon: AlertTriangle, cls: 'text-amber-600 dark:text-amber-400' },
  invalid: { label: 'Invalide', icon: XCircle, cls: 'text-red-600 dark:text-red-400' },
};

export const NOT_FOUND_FILTER = '__not_found__';

/**
 * Tableau de résultats du lot : tri par colonne, filtre par PA.
 */
export function BatchTable({ items, paFilter, onPaFilterChange, onOpen }) {
  const [sort, setSort] = useState({ key: null, dir: 1 });

  const paOptions = useMemo(() => [...new Set(items.filter((i) => i.pa).map((i) => i.pa))].sort(), [items]);

  const rows = useMemo(() => {
    let list = items;
    if (paFilter === NOT_FOUND_FILTER) list = list.filter((i) => i.status !== 'found');
    else if (paFilter) list = list.filter((i) => i.pa === paFilter);
    if (sort.key) {
      const col = COLUMNS.find((c) => c.key === sort.key);
      list = [...list].sort((a, b) => {
        const va = col.get(a);
        const vb = col.get(b);
        return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'fr')) * sort.dir;
      });
    }
    return list;
  }, [items, paFilter, sort]);

  const toggleSort = (key) =>
    setSort((s) => (s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : { key: null, dir: 1 }));

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {rows.length} ligne{rows.length > 1 ? 's' : ''}
          {rows.length !== items.length && ` sur ${items.length}`}
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          Filtrer par PA
          <select
            value={paFilter}
            onChange={(e) => onPaFilterChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="">Toutes</option>
            {paOptions.map((pa) => (
              <option key={pa} value={pa}>{pa}</option>
            ))}
            <option value={NOT_FOUND_FILTER}>Non inscrits / erreurs</option>
          </select>
        </label>
      </div>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              {COLUMNS.map((c) => {
                const Icon = sort.key !== c.key ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
                return (
                  <th key={c.key} scope="col" className="px-3 py-2.5 font-medium whitespace-nowrap" aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cx('inline-flex items-center gap-1 text-xs tracking-wide uppercase hover:text-slate-900 dark:hover:text-white', sort.key === c.key ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400')}
                    >
                      {c.label}
                      <Icon className={cx('size-3', sort.key !== c.key && 'opacity-40')} />
                    </button>
                  </th>
                );
              })}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((i) => {
              const st = STATUS[i.status] || STATUS.error;
              const StIcon = st.icon;
              const openable = i.status !== 'invalid';
              return (
                <tr
                  key={i.id}
                  onClick={openable ? () => onOpen(i.id) : undefined}
                  className={cx('animate-fade', openable && 'group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40')}
                >
                  <td className="px-3 py-2.5 font-mono text-[13px] whitespace-nowrap">{/^\d+$/.test(i.id) ? formatIdentifier(i.id) : i.id}</td>
                  <td className="max-w-[14rem] truncate px-3 py-2.5" title={i.companyName || ''}>{i.companyName || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                  <td className="px-3 py-2.5">
                    {i.status === 'found' ? <span className="text-emerald-600 dark:text-emerald-400">Oui</span> : i.status === 'not_found' ? <span className="text-slate-400">Non</span> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {i.frenchReform ? (
                      <span className="inline-flex items-center gap-1 text-accent-700 dark:text-accent-300"><Flag className="size-3" /> Oui</span>
                    ) : i.status === 'found' ? (
                      <span className="text-slate-400">Non</span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                    {i.pa || <span className="font-normal text-slate-300 dark:text-slate-600">—</span>}
                    {i.pa && !i.paKnown && <span className="ml-1.5 text-xs font-normal text-slate-400" title="Nom issu du certificat (ID POP absent de la table)">O=</span>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[13px]">{i.popId || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={cx('inline-flex items-center gap-1.5', st.cls)} title={i.error || undefined}>
                      <StIcon className="size-3.5" /> {st.label}
                    </span>
                  </td>
                  <td className="pr-3">{openable && <ArrowUpRight className="size-4 text-slate-300 group-hover:text-accent-500 dark:text-slate-600" />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
