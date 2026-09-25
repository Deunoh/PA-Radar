import { CheckCircle2, CircleDashed, AlertTriangle } from 'lucide-react';
import { cx } from '../../utils/format.js';
import { CopyButton } from './primitives.jsx';

/** Liste des identifiants Peppol testés (0225 / 0002 / 0009) et leur statut. */
export function CandidatesList({ candidates }) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
      {candidates.map((c) => {
        const status = c.exists ? 'found' : c.exists === false ? 'missing' : 'error';
        const Icon = { found: CheckCircle2, missing: CircleDashed, error: AlertTriangle }[status];
        return (
          <li key={c.shortId} className="flex items-center gap-3 px-4 py-2.5">
            <Icon
              className={cx(
                'size-4 shrink-0',
                status === 'found' && 'text-emerald-500',
                status === 'missing' && 'text-slate-300 dark:text-slate-600',
                status === 'error' && 'text-amber-500',
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[13px]">{c.shortId}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {c.label}
                {c.smpHostUri && <> · SMP <span className="font-mono">{new URL(c.smpHostUri).hostname}</span></>}
                {c.popId && <> · <span className="font-mono">{c.popId}</span></>}
                {c.error && <span className="text-amber-600 dark:text-amber-400"> · {c.error}</span>}
              </p>
            </div>
            <span
              className={cx(
                'shrink-0 text-xs font-medium',
                status === 'found' && 'text-emerald-600 dark:text-emerald-400',
                status === 'missing' && 'text-slate-400',
                status === 'error' && 'text-amber-600 dark:text-amber-400',
              )}
            >
              {{ found: 'Trouvé', missing: 'Non trouvé', error: 'Erreur' }[status]}
            </span>
            <CopyButton value={c.participantId} label="Copier l'identifiant complet" message="Identifiant copié" />
          </li>
        );
      })}
    </ul>
  );
}
