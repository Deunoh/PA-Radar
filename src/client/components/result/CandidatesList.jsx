import { CheckCircle2, CircleDashed, AlertTriangle } from 'lucide-react';
import { cx } from '../../utils/format.js';
import { CopyButton } from './primitives.jsx';

/** Liste des identifiants Peppol testés (0225 / 0002 / 0009) et leur statut. */
export function CandidatesList({ candidates, directory }) {
  return (
    <>
    {directory && !directory.ok && (
      <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
        L'annuaire Peppol n'a pas pu être consulté : les inscriptions par établissement ou code de routage ont pu être manquées.
      </p>
    )}
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
              <p className="flex flex-wrap items-center gap-x-2 font-mono text-[13px]">
                <span className="break-all">{c.shortId}</span>
                {c.origin === 'directory' && (
                  <span className="rounded-md bg-accent-50 px-1.5 py-px font-sans text-[11px] font-medium text-accent-700 dark:bg-accent-500/10 dark:text-accent-300" title="Inscription découverte en interrogeant l'annuaire Peppol avec le SIREN">
                    via l'annuaire Peppol
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {c.label}
                {c.name && <> · {c.name}</>}
                {c.smpHostUri && <> · SMP <span className="font-mono">{new URL(c.smpHostUri).hostname}</span></>}
                {c.popId && <> · <span className="font-mono">{c.popId}</span></>}
                {c.error && <span className="text-amber-600 dark:text-amber-400"> · {c.error}</span>}
                {c.detailsSkipped && <span> · point d'accès non lu (seules les 3 premières inscriptions sont détaillées)</span>}
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
    </>
  );
}
