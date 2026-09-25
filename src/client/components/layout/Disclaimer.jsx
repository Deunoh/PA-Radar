import { Info } from 'lucide-react';

/** Avertissement permanent et discret sur la portée du résultat. */
export function Disclaimer() {
  return (
    <footer className="mx-auto max-w-5xl px-4 pt-6 pb-10 sm:px-6">
      <div className="flex gap-3 rounded-2xl border border-dashed border-slate-300/80 px-4 py-3 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Le point d'accès Peppol indique l'opérateur technique qui reçoit les factures du client. C'est
          généralement sa plateforme agréée, mais un sous-traitant est possible.{' '}
          <strong className="font-medium text-slate-600 dark:text-slate-300">La source officielle reste l'annuaire du PPF.</strong>
        </p>
      </div>
    </footer>
  );
}
