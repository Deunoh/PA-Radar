/**
 * Orchestration d'une recherche : validation → candidats → existence → détails → résultat.
 */
import { validateIdentifier, buildCandidates, describeFrenchAddressing } from '../../shared/identifiers.js';
import { chooseReferenceDocumentType } from '../parsing/helgerParser.js';
import { LookupError } from '../errors.js';
import { config, SUPPORTED_SMLS } from '../config.js';
import { TtlCache } from './cache.js';
import { buildResult, applyKnownAccessPoint } from './resultBuilder.js';

/** Nombre maximum de candidats existants pour lesquels on lit le point d'accès. */
export const MAX_DETAILED_CANDIDATES = 3;

/**
 * Ordre des inscriptions découvertes dans l'annuaire :
 * celles qui concernent le SIRET saisi d'abord, puis les établissements, puis codes de routage et suffixes.
 */
function directoryRank(candidate, siret) {
  const addressing = candidate.scheme === '0225' ? describeFrenchAddressing(candidate.value) : null;
  if (siret && candidate.value.includes(siret)) return addressing?.level === 'siret' ? 0 : 1;
  if (candidate.scheme !== '0225') return 4;
  return { siren: 2, siret: 2, routing: 3, suffix: 3 }[addressing.level];
}

/**
 * Fusionne les résultats de l'annuaire Peppol dans la liste des candidats (sans doublon).
 * @returns {{ searched: boolean, ok: boolean, total: number, found: number, error: string|null }}
 */
function mergeDirectoryResults(candidates, outcome, validation) {
  if (!outcome.ok) {
    return { searched: true, ok: false, total: 0, found: 0, error: outcome.error?.message || 'Annuaire Peppol injoignable' };
  }
  if (!outcome.value) return { searched: false, ok: true, total: 0, found: 0, error: null };

  const discovered = [];
  for (const p of outcome.value.participants) {
    const known = candidates.find((c) => c.shortId === p.shortId);
    if (known) {
      known.inDirectory = true;
      known.name = p.name;
    } else {
      discovered.push({
        scheme: p.scheme,
        value: p.value,
        label: p.label,
        shortId: p.shortId,
        participantId: p.participantId,
        origin: 'directory',
        inDirectory: true,
        name: p.name,
        exists: true, // confirmé auprès du SML avant lecture des détails
        smpHostUri: null,
        error: null,
      });
    }
  }
  discovered.sort((a, b) => directoryRank(a, validation.siret) - directoryRank(b, validation.siret) || a.shortId.localeCompare(b.shortId));

  // Les inscriptions concernant le SIRET saisi passent devant les identifiants génériques non trouvés
  candidates.push(...discovered);
  return { searched: true, ok: true, total: outcome.value.total, found: outcome.value.participants.length, error: null };
}

export class LookupService {
  /**
   * @param {{ source: import('../sources/baseSource.js').PeppolSource,
   *           knownAccessPoints: import('./knownAccessPoints.js').KnownAccessPointsStore,
   *           cacheTtlMs?: number }} deps
   */
  constructor({ source, knownAccessPoints, cacheTtlMs = config.cacheTtlMs }) {
    this.source = source;
    this.knownAccessPoints = knownAccessPoints;
    this.cache = new TtlCache(cacheTtlMs);
    /** Recherches en cours, pour mutualiser deux demandes identiques simultanées */
    this.inFlight = new Map();
  }

  /**
   * Normalise le SML demandé.
   * @param {string|undefined} sml
   */
  resolveSml(sml) {
    if (!sml) return config.defaultSml;
    if (!SUPPORTED_SMLS.includes(sml)) {
      throw new LookupError('BAD_REQUEST', `SML inconnu : ${sml} (valeurs possibles : ${SUPPORTED_SMLS.join(', ')})`);
    }
    return sml;
  }

  /**
   * Recherche complète d'un identifiant.
   * @param {string} rawInput SIRET ou SIREN saisi
   * @param {{ sml?: string, refresh?: boolean, includeRaw?: boolean }} [options]
   */
  async lookup(rawInput, { sml, refresh = false, includeRaw = true } = {}) {
    const validation = validateIdentifier(rawInput);
    if (!validation.valid) {
      throw new LookupError('INVALID_ID', validation.error, { input: String(rawInput ?? '') });
    }
    const resolvedSml = this.resolveSml(sml);
    const cacheKey = `${resolvedSml}:${validation.cleaned}`;

    let response = refresh ? undefined : this.cache.get(cacheKey);
    let cached = Boolean(response);

    if (!response) {
      // Mutualise les recherches identiques lancées en même temps
      let pending = this.inFlight.get(cacheKey);
      if (!pending) {
        pending = this.#resolve(rawInput, validation, resolvedSml).finally(() => this.inFlight.delete(cacheKey));
        this.inFlight.set(cacheKey, pending);
      }
      response = await pending;
      this.cache.set(cacheKey, response);
      cached = false;
    }

    // L'enrichissement est appliqué à chaque lecture (la table peut avoir changé)
    const table = await this.knownAccessPoints.load();
    const out = { ...response, input: String(rawInput), result: applyKnownAccessPoint(response.result, table), cached };
    if (!includeRaw) delete out.raw;
    return out;
  }

  /**
   * Interroge réellement la source.
   * @param {string} rawInput
   * @param {import('../../shared/identifiers.js').IdentifierValidation} validation
   * @param {string} sml
   */
  async #resolve(rawInput, validation, sml) {
    const started = Date.now();
    const constructed = buildCandidates(validation);
    const raw = { existence: {}, serviceGroup: {}, serviceMetadata: {}, directory: null };

    // 1. En parallèle :
    //    - existence de chaque identifiant construit (la source espace elle-même les appels
    //      si l'API externe l'exige) ;
    //    - recherche du SIREN dans l'annuaire Peppol, pour découvrir les inscriptions
    //      impossibles à deviner (autres établissements, codes de routage).
    const [existence, directoryOutcome] = await Promise.all([
      Promise.allSettled(constructed.map((c) => this.source.checkExistence(c.participantId, { sml }))),
      this.source.searchDirectory(validation.siren, { sml }).then(
        (value) => ({ ok: true, value }),
        (error) => ({ ok: false, error }),
      ),
    ]);

    const candidatesOut = constructed.map((c, i) => {
      const r = existence[i];
      if (r.status === 'fulfilled') raw.existence[c.shortId] = r.value.raw;
      return {
        scheme: c.scheme,
        value: c.value,
        label: c.label,
        shortId: c.shortId,
        participantId: c.participantId,
        origin: 'constructed',
        exists: r.status === 'fulfilled' ? r.value.exists : null,
        smpHostUri: r.status === 'fulfilled' ? r.value.smpHostUri : null,
        error: r.status === 'rejected' ? r.reason?.message || 'Erreur inconnue' : null,
      };
    });

    const directory = mergeDirectoryResults(candidatesOut, directoryOutcome, validation);
    raw.directory = directoryOutcome.ok ? directoryOutcome.value?.raw ?? null : null;

    const existing = candidatesOut.filter((c) => c.exists);
    const failures = existence.filter((r) => r.status === 'rejected');

    // Aucun candidat trouvé : on ne conclut « non trouvé » que si tous les appels ont abouti
    if (!existing.length && failures.length) {
      throw failures[0].reason instanceof LookupError
        ? failures[0].reason
        : new LookupError('API_UNAVAILABLE', "L'API Peppol est indisponible");
    }

    // 2. Détails des candidats existants, en séquence et par ordre de priorité.
    //    Plafonné : un grand compte peut avoir des dizaines de codes de routage.
    let result = null;
    let firstError = null;
    let detailed = 0;
    for (const candidate of candidatesOut) {
      if (!candidate.exists) continue;
      if (detailed >= MAX_DETAILED_CANDIDATES) {
        candidate.detailsSkipped = true;
        continue;
      }
      try {
        // Candidat découvert via l'annuaire : on confirme son inscription au SML (et on obtient son SMP)
        if (candidate.origin === 'directory') {
          const check = await this.source.checkExistence(candidate.participantId, { sml });
          raw.existence[candidate.shortId] = check.raw;
          candidate.smpHostUri = check.smpHostUri;
          if (!check.exists) {
            candidate.exists = false;
            candidate.error = "Listé dans l'annuaire Peppol mais absent du SML (inscription retirée ?)";
            continue;
          }
        }
        detailed++;

        const serviceGroup = await this.source.getServiceGroup(candidate.participantId, { sml });
        raw.serviceGroup[candidate.shortId] = serviceGroup.raw;

        const referenceDocumentType = chooseReferenceDocumentType(serviceGroup.documentTypes);
        let endpoints = [];
        if (referenceDocumentType) {
          const metadata = await this.source.getServiceMetadata(candidate.participantId, referenceDocumentType.documentTypeID, { sml });
          raw.serviceMetadata[candidate.shortId] = metadata.raw;
          endpoints = metadata.endpoints;
        }

        const built = buildResult({ candidate, smpHostUri: candidate.smpHostUri, serviceGroup, referenceDocumentType, endpoints });
        candidate.popId = built.pa.popId;
        candidate.operator = built.pa.operator;
        // Le premier candidat (ordre de priorité) qui aboutit fournit le résultat principal
        if (!result) result = built;
      } catch (err) {
        candidate.error = err.message;
        firstError ??= err;
      }
    }

    // Des candidats existent mais aucun détail n'a pu être lu : on remonte l'erreur (souvent SMP muet)
    const stillExisting = candidatesOut.filter((c) => c.exists);
    if (stillExisting.length && !result) {
      const err = firstError instanceof LookupError ? firstError : new LookupError('SMP_UNREACHABLE', 'Le SMP du participant ne répond pas');
      err.details = { ...(err.details || {}), candidates: candidatesOut, smpHostUri: stillExisting[0].smpHostUri };
      throw err;
    }

    return {
      input: String(rawInput),
      siren: validation.siren,
      siret: validation.siret,
      type: validation.type,
      sml,
      source: this.source.label,
      candidates: candidatesOut,
      directory,
      result,
      raw,
      queriedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    };
  }
}
