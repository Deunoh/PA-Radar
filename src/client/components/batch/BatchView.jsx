import { useMemo, useRef, useState } from 'react';
import { Upload, Play, Square, Download, Eraser, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { splitIdentifierList, validateIdentifier } from '../../../shared/identifiers.js';
import { lookupBatch } from '../../api.js';
import { useToast } from '../../hooks/useToast.jsx';
import { useLocalStorage } from '../../hooks/useLocalStorage.js';
import { toCsv, downloadCsv, extractIdentifiersFromCsv } from '../../utils/csv.js';
import { formatEta, formatDuration } from '../../utils/format.js';
import { BatchSummary } from './BatchSummary.jsx';
import { BatchTable } from './BatchTable.jsx';

/** Durée estimée d'une recherche non mise en cache (≈ 5 appels espacés de 1,2 s + pause d'1 s). */
const ESTIMATED_MS_PER_ITEM = 6500;
const STATUS_LABELS = { found: 'Trouvé', not_found: 'Non inscrit', error: 'Erreur', invalid: 'Invalide' };

/**
 * Onglet « Recherche en lot ».
 * @param {{ sml: string, onOpen: (id: string) => void }} props
 */
export function BatchView({ sml, onOpen }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const abortRef = useRef(null);
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total, elapsedMs, processedValid, totalValid }
  const [items, setItems] = useState([]);
  const [paFilter, setPaFilter] = useState('');
  const [reference, setReference] = useLocalStorage('paradar.batchReference', '');
  const [error, setError] = useState(null);

  // Analyse de la saisie avant lancement
  const parsed = useMemo(() => {
    const ids = splitIdentifierList(text);
    const validations = ids.map((id) => ({ id, v: validateIdentifier(id) }));
    return {
      ids,
      valid: validations.filter((x) => x.v.valid).length,
      invalid: validations.filter((x) => !x.v.valid),
    };
  }, [text]);

  const importFile = async (file) => {
    if (!file) return;
    const content = await file.text();
    const found = extractIdentifiersFromCsv(content);
    if (!found.length) {
      toast('Aucun SIREN / SIRET trouvé dans ce fichier', { tone: 'error' });
      return;
    }
    setText((t) => [t.trim(), ...found].filter(Boolean).join('\n'));
    toast(`${found.length} identifiant${found.length > 1 ? 's' : ''} importé${found.length > 1 ? 's' : ''}`);
  };

  const start = async () => {
    if (!parsed.ids.length) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError(null);
    setItems([]);
    setPaFilter('');
    setProgress({ done: 0, total: parsed.ids.length, elapsedMs: 0, processedValid: 0, totalValid: parsed.valid });

    try {
      await lookupBatch(parsed.ids, {
        sml,
        signal: controller.signal,
        onEvent: (event, data) => {
          if (event === 'progress') {
            setItems((list) => [...list, data.item]);
            setProgress((p) => ({
              ...p,
              done: data.done,
              elapsedMs: data.elapsedMs,
              processedValid: p.processedValid + (data.item.status === 'invalid' ? 0 : 1),
            }));
          } else if (event === 'done') {
            toast('Recherche en lot terminée');
          }
        },
      });
    } catch (err) {
      if (err.name === 'AbortError') toast('Recherche en lot interrompue', { tone: 'error' });
      else setError(err.message);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const exportCsv = () => {
    const headers = ['Identifiant', 'SIREN', 'SIRET', 'Nom', 'Peppol', 'Réforme FR', 'PA', 'ID POP', 'Exploitant (O=)', 'Hébergeur technique', 'Identifiant Peppol', 'Statut', 'Erreur'];
    const rows = items.map((i) => [
      i.id,
      i.siren || '',
      i.siret || '',
      i.companyName || '',
      i.status === 'found' ? 'Oui' : i.status === 'not_found' ? 'Non' : '',
      i.status === 'found' ? (i.frenchReform ? 'Oui' : 'Non') : '',
      i.pa || '',
      i.popId || '',
      i.operator || '',
      i.technicalHost || '',
      i.participantId || '',
      STATUS_LABELS[i.status] || i.status,
      i.error || '',
    ]);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    downloadCsv(`paradar-lot-${stamp}.csv`, toCsv(headers, rows));
  };

  // Estimation du temps restant, affinée au fil des résultats
  const eta = useMemo(() => {
    if (!progress || !running) return null;
    const remaining = progress.totalValid - progress.processedValid;
    const perItem = progress.processedValid > 0 ? progress.elapsedMs / progress.processedValid : ESTIMATED_MS_PER_ITEM;
    return (remaining * perItem) / 1000;
  }, [progress, running]);

  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pt-8 sm:px-6 sm:pt-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recherche en lot</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Collez une liste de SIRET / SIREN (un par ligne, ou séparés par virgule, point-virgule ou espace) ou importez un fichier CSV.
          Les recherches sont faites une par une pour ne pas surcharger les serveurs Peppol.
        </p>
      </div>

      <div className="card p-4 sm:p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={running}
          rows={6}
          spellCheck={false}
          placeholder={'75062058500018\n552100554\n…'}
          aria-label="Liste d'identifiants"
          className="input scrollbar-thin min-h-36 resize-y font-mono text-[13px] leading-relaxed"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            importFile(e.dataTransfer.files?.[0]);
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="mr-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" /> {parsed.valid} valide{parsed.valid > 1 ? 's' : ''}
            </span>
            <span
              className={parsed.invalid.length ? 'inline-flex items-center gap-1.5 text-red-600 dark:text-red-400' : 'inline-flex items-center gap-1.5 text-slate-400'}
              title={parsed.invalid.map((x) => `${x.id} : ${x.v.error}`).join('\n')}
            >
              <XCircle className="size-4" /> {parsed.invalid.length} invalide{parsed.invalid.length > 1 ? 's' : ''}
            </span>
            {parsed.valid > 0 && !running && (
              <span className="text-slate-400">≈ {formatEta((parsed.valid * ESTIMATED_MS_PER_ITEM) / 1000)} (hors cache)</span>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" className="btn-ghost" disabled={running} onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Importer un CSV
          </button>
          {text && !running && (
            <button type="button" className="btn-ghost" onClick={() => setText('')}>
              <Eraser className="size-4" /> Effacer
            </button>
          )}
          {running ? (
            <button type="button" className="btn-secondary" onClick={stop}>
              <Square className="size-3.5 fill-current" /> Arrêter
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={!parsed.valid} onClick={start}>
              <Play className="size-3.5 fill-current" /> Lancer {parsed.ids.length > 0 && `(${parsed.ids.length})`}
            </button>
          )}
        </div>
        {parsed.invalid.length > 0 && !running && (
          <p className="mt-2 truncate text-xs text-slate-400" title={parsed.invalid.map((x) => x.id).join(', ')}>
            Invalides : <span className="font-mono">{parsed.invalid.slice(0, 6).map((x) => x.id).join(', ')}{parsed.invalid.length > 6 && '…'}</span>
          </p>
        )}
      </div>

      {error && <p className="card border-amber-200 p-4 text-sm text-amber-800 dark:text-amber-300">{error}</p>}

      {progress && (
        <div className="card animate-enter p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-medium">
              {running && <Loader2 className="size-4 animate-spin text-accent-500" />}
              {progress.done} / {progress.total} traités
            </span>
            <span className="text-slate-500 tabular-nums dark:text-slate-400">
              {running ? (eta != null && eta > 0 ? `≈ ${formatEta(eta)} restantes` : 'Finalisation…') : `Terminé en ${formatDuration(progress.elapsedMs)}`}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent-600 transition-[width] duration-500 ease-out dark:bg-accent-400" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {items.length > 0 && (
        <>
          <BatchSummary items={items} reference={reference} onReferenceChange={setReference} />
          <div className="flex justify-end">
            <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!items.length}>
              <Download className="size-4" /> Exporter en CSV
            </button>
          </div>
          <BatchTable items={items} paFilter={paFilter} onPaFilterChange={setPaFilter} onOpen={onOpen} />
        </>
      )}
    </div>
  );
}
