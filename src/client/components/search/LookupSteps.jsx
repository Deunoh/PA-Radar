import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cx } from '../../utils/format.js';

const STEPS = ["Vérification de l'identifiant", 'Recherche sur Peppol', "Lecture du point d'accès"];

/**
 * Étapes animées pendant la recherche.
 * La recherche est un seul appel serveur : la progression est estimée à partir
 * des durées typiques (les appels à l'API Peppol sont espacés d'environ 1,2 s).
 * @param {{ finished: boolean, candidateCount: number }} props
 */
export function LookupSteps({ finished, candidateCount = 3 }) {
  const [current, setCurrent] = useState(1);

  useEffect(() => {
    // Étape 2 ≈ un appel d'existence par candidat ; ensuite lecture du point d'accès
    const t = setTimeout(() => setCurrent(2), 400 + candidateCount * 1200);
    return () => clearTimeout(t);
  }, [candidateCount]);

  const active = finished ? STEPS.length : current;

  return (
    <div className="card animate-enter mx-auto w-full max-w-md p-5">
      <ol className="space-y-3.5">
        {STEPS.map((label, i) => {
          const done = i < active;
          const running = i === active;
          return (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span
                className={cx(
                  'grid size-6 place-items-center rounded-full border transition-all duration-300',
                  done && 'border-accent-600 bg-accent-600 text-white dark:border-accent-500 dark:bg-accent-500',
                  running && 'border-accent-300 text-accent-600 dark:border-accent-700 dark:text-accent-400',
                  !done && !running && 'border-slate-200 dark:border-slate-700',
                )}
              >
                {done ? (
                  <Check className="animate-fade size-3.5" strokeWidth={3} />
                ) : running ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
              </span>
              <span
                className={cx(
                  'transition-colors',
                  done && 'text-slate-900 dark:text-slate-100',
                  running && 'font-medium text-slate-900 dark:text-white',
                  !done && !running && 'text-slate-400 dark:text-slate-500',
                )}
              >
                {label}
                {running && <span className="text-slate-400">…</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
