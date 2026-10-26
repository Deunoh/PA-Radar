import { SearchX, BookOpen, AlertTriangle, WifiOff, ServerCrash, Timer, ListChecks, ClipboardCopy } from 'lucide-react';
import { buildTicketSummary } from '../../../shared/summary.js';
import { useCopy } from '../../hooks/useCopy.js';
import { CandidatesList } from './CandidatesList.jsx';
import { VerificationLinks } from './primitives.jsx';

/** Carte « aucune inscription trouvée » : ton neutre, causes possibles, renvoi vers le PPF. */
export function NotFoundCard({ response }) {
  const copy = useCopy();
  return (
    <article className="card animate-enter overflow-hidden">
      <div className="p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <SearchX className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Aucune inscription Peppol trouvée pour cet identifiant</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Cela ne signifie pas que le client ne peut pas recevoir de factures électroniques.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="label mb-2">Causes possibles</h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {[
                "Le client n'est pas encore inscrit auprès d'une plateforme agréée.",
                "Sa plateforme agréée n'utilise pas (encore) le réseau Peppol.",
                "Il est inscrit sous un autre identifiant (autre SIREN du groupe, autre établissement…).",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-slate-400" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-4 flex gap-2 rounded-xl bg-accent-50 px-3.5 py-2.5 text-sm text-accent-900 dark:bg-accent-500/10 dark:text-accent-200">
              <BookOpen className="mt-0.5 size-4 shrink-0" />
              <span>
                Pensez à consulter <strong className="font-medium">l'annuaire du PPF</strong> (Portail Public de Facturation), qui
                reste la source officielle des plateformes agréées.
              </span>
            </p>
          </div>
          <div>
            <h3 className="label mb-2 flex items-center gap-1.5"><ListChecks className="size-3.5" /> Identifiants testés</h3>
            <CandidatesList candidates={response.candidates} directory={response.directory} />
          </div>
        </div>
      </div>
      <div className="border-t border-slate-100 px-6 py-3.5 dark:border-slate-800">
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Vérifier sur</p>
        <div className="flex flex-wrap gap-2">
          <VerificationLinks siren={response.siren} siret={response.siret} />
        </div>
      </div>
      <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/40">
        <button type="button" className="btn-secondary" onClick={() => copy(buildTicketSummary(response), 'Résumé copié pour le ticket')}>
          <ClipboardCopy className="size-4" /> Copier le résumé pour un ticket
        </button>
      </div>
    </article>
  );
}

const ERROR_PRESENTATION = {
  API_UNAVAILABLE: { icon: WifiOff, title: 'API Peppol indisponible' },
  UPSTREAM_RATE_LIMITED: { icon: Timer, title: 'API Peppol momentanément saturée' },
  SMP_UNREACHABLE: { icon: ServerCrash, title: 'Le SMP ne répond pas' },
  RATE_LIMITED: { icon: Timer, title: 'Trop de recherches' },
  INVALID_ID: { icon: AlertTriangle, title: 'Identifiant invalide' },
  NETWORK: { icon: WifiOff, title: 'Serveur injoignable' },
};

/** Carte d'erreur : un titre et une icône distincts par type d'erreur. */
export function ErrorCard({ error, onRetry }) {
  const p = ERROR_PRESENTATION[error.code] || { icon: AlertTriangle, title: 'Erreur' };
  const Icon = p.icon;
  const candidates = error.details?.candidates;
  return (
    <article className="card animate-enter p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">{p.title}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{error.message}</p>
          {error.code === 'SMP_UNREACHABLE' && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Le client est bien enregistré sur Peppol, mais le serveur de métadonnées (SMP) de son opérateur n'a pas répondu.
            </p>
          )}
          {onRetry && error.code !== 'INVALID_ID' && (
            <button type="button" onClick={onRetry} className="btn-secondary mt-4">
              Réessayer
            </button>
          )}
        </div>
      </div>
      {candidates && (
        <div className="mt-5">
          <CandidatesList candidates={candidates} />
        </div>
      )}
    </article>
  );
}
