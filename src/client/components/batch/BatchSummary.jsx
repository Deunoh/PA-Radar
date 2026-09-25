import { useMemo } from 'react';
import { cx } from '../../utils/format.js';

const MAX_BARS = 6;

/**
 * Regroupe les résultats d'un lot par plateforme agréée.
 * @param {Array<any>} items
 */
export function summarize(items) {
  const byPa = new Map();
  let notFound = 0;
  let errors = 0;
  let invalid = 0;
  for (const it of items) {
    if (it.status === 'found') byPa.set(it.pa || 'PA inconnue', (byPa.get(it.pa || 'PA inconnue') || 0) + 1);
    else if (it.status === 'not_found') notFound++;
    else if (it.status === 'invalid') invalid++;
    else errors++;
  }
  const pas = [...byPa.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { pas, notFound, errors, invalid, found: pas.reduce((s, p) => s + p.count, 0) };
}

/**
 * Récapitulatif : phrase de synthèse + mini graphique en barres horizontales.
 * Une seule série (effectifs) : une teinte pour les PA, gris neutre pour « non inscrits »,
 * ambre (statut) pour les erreurs. Les valeurs sont écrites en toutes lettres (pas de couleur seule).
 */
export function BatchSummary({ items, reference, onReferenceChange }) {
  const s = useMemo(() => summarize(items), [items]);
  const ref = reference && s.pas.some((p) => p.name === reference) ? reference : s.pas[0]?.name;
  const atRef = s.pas.find((p) => p.name === ref)?.count || 0;
  const elsewhere = s.found - atRef;

  const shown = s.pas.slice(0, MAX_BARS);
  const others = s.pas.slice(MAX_BARS).reduce((sum, p) => sum + p.count, 0);
  const rows = [
    ...shown.map((p) => ({ key: p.name, label: p.name, count: p.count, kind: p.name === ref ? 'ref' : 'pa' })),
    ...(others ? [{ key: '__others', label: `Autres PA (${s.pas.length - MAX_BARS})`, count: others, kind: 'pa' }] : []),
    ...(s.notFound ? [{ key: '__nf', label: 'Non inscrits', count: s.notFound, kind: 'none' }] : []),
    ...(s.errors ? [{ key: '__err', label: 'Erreurs', count: s.errors, kind: 'error' }] : []),
  ];
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = items.filter((i) => i.status !== 'invalid').length;

  if (!rows.length) return null;

  return (
    <div className="card animate-enter p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          {ref ? (
            <>
              <strong className="font-semibold">{atRef}</strong> chez {ref}
              {', '}
              <strong className="font-semibold">{elsewhere}</strong> ailleurs
            </>
          ) : (
            <>
              <strong className="font-semibold">0</strong> inscrit
            </>
          )}
          {', '}
          <strong className="font-semibold">{s.notFound}</strong> non inscrit{s.notFound > 1 ? 's' : ''}
          {s.errors > 0 && (
            <>
              {', '}
              <strong className="font-semibold">{s.errors}</strong> en erreur
            </>
          )}
        </p>
        {s.pas.length > 1 && (
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            Référence
            <select
              value={ref}
              onChange={(e) => onReferenceChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {s.pas.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <ul className="mt-4 space-y-2" aria-label="Répartition par plateforme agréée">
        {rows.map((r) => (
          <li
            key={r.key}
            className="group grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3 text-xs sm:grid-cols-[minmax(0,12rem)_1fr_3rem]"
            title={`${r.label} : ${r.count} (${Math.round((r.count / Math.max(total, 1)) * 100)} %)`}
          >
            <span className="truncate text-slate-600 dark:text-slate-300">{r.label}</span>
            <span className="h-2.5 rounded-r-[4px] bg-slate-100 dark:bg-slate-800">
              <span
                className={cx(
                  'block h-full rounded-r-[4px] transition-[width] duration-500 ease-out group-hover:brightness-110',
                  r.kind === 'ref' && 'bg-accent-600 dark:bg-accent-400',
                  r.kind === 'pa' && 'bg-accent-300 dark:bg-accent-700',
                  r.kind === 'none' && 'bg-slate-300 dark:bg-slate-600',
                  r.kind === 'error' && 'bg-amber-400 dark:bg-amber-500',
                )}
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </span>
            <span className="text-right font-mono text-slate-700 tabular-nums dark:text-slate-200">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
