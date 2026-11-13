import { Info } from 'lucide-react';

/** Version injectée au build (vite.config.js) ; absente dans les tests. */
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null;
const BUILT_AT = VERSION
  ? new Date(VERSION.builtAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  : null;

/**
 * Avertissement permanent et discret sur la portée du résultat, et lien vers les mentions légales.
 * @param {{ onShowLegal: () => void }} props
 */
export function Disclaimer({ onShowLegal }) {
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
      <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
        <button type="button" onClick={onShowLegal} className="hover:text-slate-600 hover:underline dark:hover:text-slate-300">
          Mentions légales et données personnelles
        </button>
      </p>
      {VERSION && (
        <p className="mt-2 text-center font-mono text-[11px] text-slate-300 dark:text-slate-600" title={`Compilé le ${BUILT_AT}`}>
          version {VERSION.commit} · {BUILT_AT}
        </p>
      )}
    </footer>
  );
}
