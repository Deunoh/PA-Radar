import {
  Building2,
  CheckCircle2,
  Flag,
  BadgeCheck,
  ShieldCheck,
  ShieldAlert,
  FileText,
  ListChecks,
  Braces,
  ClipboardCopy,
  RefreshCw,
  Server,
  MapPin,
  Clock,
  Zap,
} from 'lucide-react';
import { formatIdentifier } from '../../../shared/identifiers.js';
import { buildTicketSummary } from '../../../shared/summary.js';
import { useCopy } from '../../hooks/useCopy.js';
import { formatDate, formatDateTime, formatDuration, cx } from '../../utils/format.js';
import { Badge, Collapsible, CopyButton } from './primitives.jsx';
import { JsonViewer } from './JsonViewer.jsx';
import { CandidatesList } from './CandidatesList.jsx';

/**
 * Carte résultat d'une recherche aboutie.
 * @param {{ response: any, onRefresh: () => void, refreshing: boolean }} props
 */
export function ResultCard({ response, onRefresh, refreshing }) {
  const copy = useCopy();
  const r = response.result;
  const reform = r.frenchReform.regulated || r.frenchReform.nonRegulated;
  const frenchDocs = r.documentTypes.filter((d) => d.isFrench);
  const otherDocs = r.documentTypes.filter((d) => !d.isFrench);
  const existingCount = response.candidates.filter((c) => c.exists).length;

  return (
    <article className="card animate-enter overflow-hidden">
      {/* ——— Bloc héros ——— */}
      <div className="relative px-5 pt-6 pb-6 sm:px-7 sm:pt-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[radial-gradient(circle,var(--color-accent-500)_0%,transparent_65%)] opacity-[0.07] dark:opacity-[0.12]"
        />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-[28px] sm:leading-tight">
              {r.companyName || <span className="text-slate-400">Nom non publié dans l'annuaire Peppol</span>}
            </h2>
            {r.address && (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <MapPin className="size-3.5 shrink-0" /> {r.address}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="btn-ghost size-9 shrink-0 !p-0"
            title="Relancer la recherche sans le cache"
            aria-label="Relancer la recherche sans le cache"
          >
            <RefreshCw className={cx('size-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Résultat principal : la plateforme agréée */}
        <div className="relative mt-5 flex flex-col gap-4 rounded-2xl border border-accent-100 bg-gradient-to-br from-accent-50 to-white p-4 sm:flex-row sm:items-center sm:p-5 dark:border-accent-500/20 dark:from-accent-500/10 dark:to-transparent">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-600 text-white shadow-md shadow-accent-600/25 dark:bg-accent-500">
            <Building2 className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-accent-700/80 uppercase dark:text-accent-300/80">Plateforme agréée</p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-semibold tracking-tight text-accent-900 sm:text-3xl dark:text-white">{r.pa.name || 'Inconnue'}</span>
              {r.pa.popId && <span className="font-mono text-sm text-accent-700/80 dark:text-accent-300">{r.pa.popId}</span>}
            </p>
            {r.pa.operator && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Nom issu du certificat du point d'accès (O=)</p>
            )}
          </div>
          {r.whiteLabel && r.technicalHost && (
            <div className="shrink-0 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Marque blanche hébergée chez</p>
              <p className="flex items-center gap-1.5 font-medium">
                <Server className="size-3.5 text-slate-400" /> {r.technicalHost}
              </p>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="green" icon={CheckCircle2}>Inscrit sur Peppol</Badge>
          {reform ? (
            <Badge tone="blue" icon={Flag}>
              Inscrit réforme FR
              {!(r.frenchReform.regulated && r.frenchReform.nonRegulated) && (
                <span className="opacity-70">· {r.frenchReform.regulated ? 'regulated' : 'non-regulated'}</span>
              )}
            </Badge>
          ) : (
            <Badge tone="slate" icon={Flag}>Pas de processus réforme FR</Badge>
          )}
          {r.isActiveTaxpayer && <Badge tone="blue" icon={BadgeCheck}>Assujetti actif</Badge>}
          {r.status && !r.isActiveTaxpayer && <Badge tone="slate">{r.status}</Badge>}
          {r.certificate.isValid === true && <Badge tone="green" icon={ShieldCheck}>Certificat valide</Badge>}
          {r.certificate.isValid === false && <Badge tone="red" icon={ShieldAlert}>Certificat expiré</Badge>}
        </div>

        {existingCount > 1 && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
            <ListChecks className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <span>
              {existingCount} inscriptions Peppol pour ce SIREN (établissements ou codes de routage). Le résultat affiché
              concerne <span className="font-mono">{r.participantShortId}</span> ; voir « Identifiants testés ».
            </span>
          </p>
        )}
      </div>

      {/* ——— Grille de détails ——— */}
      <dl className="grid gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-800">
        <Detail label="SIREN" value={response.siren} display={formatIdentifier(response.siren)} mono />
        <Detail
          label="SIRET"
          value={response.siret || r.addressing?.siret}
          display={(response.siret || r.addressing?.siret) ? formatIdentifier(response.siret || r.addressing.siret) : null}
          hint={!response.siret && r.addressing?.siret ? "Établissement inscrit (non saisi)" : null}
          mono
          empty="Non saisi"
        />
        <Detail
          label="Identifiant Peppol"
          value={r.participantId}
          display={r.participantShortId}
          mono
          hint={[
            r.addressing && `Format : ${r.addressing.format}${r.addressing.extra ? ` (« ${r.addressing.extra} »)` : ''}`,
            r.foundVia === 'directory' && "trouvé via l'annuaire Peppol",
          ].filter(Boolean).join(' · ') || r.participantId}
        />
        <Detail label="ID POP (point d'accès)" value={r.pa.popId} mono />
        <Detail label="Exploitant (O=)" value={r.pa.operator} />
        <Detail
          label="Hébergeur technique"
          value={r.technicalHost}
          display={
            r.technicalHost && (
              <>
                {r.technicalHost}
                {r.whiteLabel && <span className="ml-2 text-xs text-slate-400">marque blanche</span>}
              </>
            )
          }
          hint={[r.endpointHost, r.smpHost && `SMP ${r.smpHost}`].filter(Boolean).join(' · ')}
          empty="Non déterminé"
        />
        <Detail label="URL du point d'accès" value={r.endpointUrl} mono small hint={r.serviceDescription} />
        <Detail
          label="Contact technique"
          value={r.technicalContact}
          display={
            r.technicalContact &&
            (/^[^@\s]+@[^@\s]+$/.test(r.technicalContact) ? (
              <a href={`mailto:${r.technicalContact}`} className="hover:text-accent-600 hover:underline dark:hover:text-accent-400">{r.technicalContact}</a>
            ) : (
              r.technicalContact
            ))
          }
          hint={r.website}
        />
        <Detail label="Date d'inscription" value={formatDate(r.registrationDate)} empty="Non renseignée" />
        <Detail
          label="Validité du certificat"
          value={r.certificate.validTo && `${formatDate(r.certificate.validFrom)} → ${formatDate(r.certificate.validTo)}`}
          display={
            r.certificate.validTo && (
              <span className={cx(r.certificate.isValid === false && 'text-red-600 dark:text-red-400')}>
                {formatDate(r.certificate.validFrom)} → {formatDate(r.certificate.validTo)}
              </span>
            )
          }
        />
      </dl>

      {/* ——— Sections repliables ——— */}
      <Collapsible title="Documents acceptés" icon={FileText} count={r.documentTypes.length}>
        {frenchDocs.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {frenchDocs.map((d) => (
              <span
                key={d.documentTypeID}
                title={d.documentTypeID}
                className="inline-flex items-center gap-1 rounded-lg border border-accent-200 bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-800 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-200"
              >
                <Flag className="size-3" /> {d.niceName}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {otherDocs.map((d) => (
            <span
              key={d.documentTypeID}
              title={d.documentTypeID}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {d.niceName}
            </span>
          ))}
        </div>
        {r.referenceDocumentType && (
          <p className="mt-3 text-xs text-slate-400">
            Point d'accès lu sur le type de document « {r.referenceDocumentType} »
            {r.accessPoints.length > 1 && ` · ${r.accessPoints.length} certificats distincts trouvés`}
          </p>
        )}
      </Collapsible>

      <Collapsible title="Identifiants testés" icon={ListChecks} count={response.candidates.length}>
        <CandidatesList candidates={response.candidates} directory={response.directory} />
      </Collapsible>

      <Collapsible
        title="JSON brut"
        icon={Braces}
        actions={<CopyButton value={JSON.stringify(response, null, 2)} label="Copier le JSON" message="JSON copié" />}
      >
        <JsonViewer data={response} />
      </Collapsible>

      {/* ——— Pied : méta + action principale ——— */}
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 dark:border-slate-800 dark:bg-slate-900/40">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1"><Clock className="size-3.5" /> Vérifié le {formatDateTime(response.queriedAt)}</span>
          <span className="flex items-center gap-1">
            <Zap className="size-3.5" /> {response.cached ? 'depuis le cache' : formatDuration(response.durationMs)}
          </span>
          {response.sml !== 'peppolprod' && <span className="font-mono">{response.sml}</span>}
        </p>
        <button
          type="button"
          className="btn-primary h-10"
          onClick={() => copy(buildTicketSummary(response), 'Résumé copié pour le ticket')}
        >
          <ClipboardCopy className="size-4" /> Copier le résumé pour un ticket
        </button>
      </div>
    </article>
  );
}

/** Cellule de la grille de détails, avec bouton copier. */
function Detail({ label, value, display, hint, mono, small, empty = '—' }) {
  const shown = display ?? value;
  return (
    <div className="group flex min-w-0 items-start gap-2 bg-white px-5 py-3.5 sm:px-7 dark:bg-slate-900">
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
        <dd
          className={cx(
            'mt-0.5 break-words',
            mono ? 'font-mono' : 'font-medium',
            small ? 'text-[13px]' : 'text-sm',
            !shown && 'font-sans font-normal text-slate-400',
          )}
        >
          {shown || empty}
        </dd>
        {hint && <p className="mt-0.5 truncate text-xs text-slate-400" title={hint}>{hint}</p>}
      </div>
      {value && <CopyButton value={value} label={`Copier : ${label}`} message={`Copié : ${label}`} className="mt-2 opacity-60 group-hover:opacity-100 focus:opacity-100" />}
    </div>
  );
}
