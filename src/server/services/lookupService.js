/**
 * Orchestration d'une recherche : validation → candidats → existence → détails → résultat.
 */
import { validateIdentifier, buildCandidates } from '../../shared/identifiers.js';
import { chooseReferenceDocumentType } from '../parsing/helgerParser.js';
import { LookupError } from '../errors.js';
import { config, SUPPORTED_SMLS } from '../config.js';
import { TtlCache } from './cache.js';
import { buildResult, applyKnownAccessPoint } from './resultBuilder.js';

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
    const candidates = buildCandidates(validation);
    const raw = { existence: {}, serviceGroup: {}, serviceMetadata: {} };

    // 1. Existence de chaque candidat (lancées en parallèle ; la source espace
    //    elle-même les appels si l'API externe l'exige)
    const existence = await Promise.allSettled(candidates.map((c) => this.source.checkExistence(c.participantId, { sml })));

    const candidatesOut = candidates.map((c, i) => {
      const r = existence[i];
      if (r.status === 'fulfilled') raw.existence[c.shortId] = r.value.raw;
      return {
        scheme: c.scheme,
        label: c.label,
        shortId: c.shortId,
        participantId: c.participantId,
        exists: r.status === 'fulfilled' ? r.value.exists : null,
        smpHostUri: r.status === 'fulfilled' ? r.value.smpHostUri : null,
        error: r.status === 'rejected' ? r.reason?.message || 'Erreur inconnue' : null,
      };
    });

    const existing = candidatesOut.filter((c) => c.exists);
    const failures = existence.filter((r) => r.status === 'rejected');

    // Aucun candidat trouvé : on ne conclut « non trouvé » que si tous les appels ont abouti
    if (!existing.length && failures.length) {
      throw failures[0].reason instanceof LookupError
        ? failures[0].reason
        : new LookupError('API_UNAVAILABLE', "L'API Peppol est indisponible");
    }

    // 2. Détails de chaque candidat existant (en séquence, par ordre de priorité)
    let result = null;
    let firstError = null;
    for (const candidate of existing) {
      try {
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
    if (existing.length && !result) {
      const err = firstError instanceof LookupError ? firstError : new LookupError('SMP_UNREACHABLE', 'Le SMP du participant ne répond pas');
      err.details = { ...(err.details || {}), candidates: candidatesOut, smpHostUri: existing[0].smpHostUri };
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
      result,
      raw,
      queriedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    };
  }
}
