import { useCallback, useEffect, useRef, useState } from 'react';
import { formatIdentifier, validateIdentifier } from '../../../shared/identifiers.js';
import { lookup } from '../../api.js';
import { useModHotkey } from '../../hooks/useHotkey.js';
import { useLocalStorage } from '../../hooks/useLocalStorage.js';
import { SearchBar } from './SearchBar.jsx';
import { LookupSteps } from './LookupSteps.jsx';
import { History } from './History.jsx';
import { ResultCard } from '../result/ResultCard.jsx';
import { NotFoundCard, ErrorCard } from '../result/StatusCards.jsx';

const HISTORY_SIZE = 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Onglet « Recherche » : barre de commande, étapes animées, carte résultat, historique.
 * @param {{ sml: string, pendingId: string|null, onPendingConsumed: () => void }} props
 */
export function SearchView({ sml, pendingId, onPendingConsumed }) {
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const [query, setQuery] = useState('');
  // phase : idle | loading | finishing (étapes toutes cochées) | done | error
  const [phase, setPhase] = useState('idle');
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [lastId, setLastId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useLocalStorage('paradar.history', []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  useModHotkey('k', focusInput);

  const pushHistory = useCallback(
    (id, res) => {
      const entry = {
        id,
        name: res?.result?.companyName || null,
        pa: res?.result?.pa?.name || null,
        found: res ? Boolean(res.result) : null,
        at: new Date().toISOString(),
      };
      setHistory((list) => [entry, ...list.filter((h) => h.id !== id)].slice(0, HISTORY_SIZE));
    },
    [setHistory],
  );

  const run = useCallback(
    /**
     * @param {string} rawId
     * @param {{ refresh?: boolean, keepCard?: boolean }} options
     *   refresh  : ignorer le cache serveur
     *   keepCard : garder la carte affichée pendant le rechargement
     */
    async (rawId, { refresh = false, keepCard = refresh } = {}) => {
      const v = validateIdentifier(rawId);
      if (!v.valid) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLastId(v.cleaned);
      setError(null);
      if (keepCard) setRefreshing(true);
      else {
        setResponse(null);
        setPhase('loading');
      }

      try {
        const res = await lookup(v.cleaned, { sml, refresh, signal: controller.signal });
        if (!keepCard && !res.cached) {
          setPhase('finishing');
          await sleep(350);
        }
        if (controller.signal.aborted) return;
        setResponse(res);
        setPhase('done');
        pushHistory(v.cleaned, res);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(err);
        setPhase('error');
        if (err.code !== 'INVALID_ID') pushHistory(v.cleaned, null);
      } finally {
        if (abortRef.current === controller) setRefreshing(false);
      }
    },
    [sml, pushHistory],
  );

  // Recherche demandée depuis un autre onglet (ex. clic dans le tableau de lot)
  useEffect(() => {
    if (!pendingId) return;
    setQuery(formatIdentifier(pendingId));
    run(pendingId);
    onPendingConsumed();
  }, [pendingId, run, onPendingConsumed]);

  const selectFromHistory = (id) => {
    setQuery(formatIdentifier(id));
    run(id);
  };

  const loading = phase === 'loading' || phase === 'finishing';
  const candidateCount = lastId?.length === 14 ? 3 : 2;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 sm:px-6">
      <section className={phase === 'idle' ? 'pt-[12vh] sm:pt-[16vh]' : 'pt-8 sm:pt-10'} style={{ transition: 'padding 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Identifiez la plateforme agréée d'un client via Peppol</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Saisissez un SIRET ou un SIREN : PAradar interroge l'annuaire Peppol et lit le point d'accès qui reçoit ses factures.
          </p>
        </div>
        <div className="mx-auto max-w-2xl">
          <SearchBar ref={inputRef} value={query} onChange={setQuery} onSubmit={() => run(query)} loading={loading || refreshing} />
        </div>
      </section>

      {loading && <LookupSteps key={lastId} finished={phase === 'finishing'} candidateCount={candidateCount} />}

      {phase === 'done' && response && (
        response.result ? (
          <ResultCard
            key={response.queriedAt}
            response={response}
            refreshing={refreshing}
            onRefresh={() => run(lastId, { refresh: true })}
          />
        ) : (
          <NotFoundCard key={response.queriedAt} response={response} />
        )
      )}

      {phase === 'error' && error && (
        <ErrorCard
          error={error}
          onRetry={() => run(lastId)}
          siren={validateIdentifier(lastId).siren}
          siret={validateIdentifier(lastId).siret}
        />
      )}

      {!loading && <History items={history} onSelect={selectFromHistory} onClear={() => setHistory([])} />}
    </div>
  );
}
