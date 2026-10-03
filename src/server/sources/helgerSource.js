/**
 * Source « helger » : API REST publique https://peppol.helger.com/api
 *
 * Particularités observées :
 *  - Limitation stricte (~1 requête/seconde, HTTP 429 avec Retry-After: 5).
 *    Tous les appels passent donc par une file globale qui les espace, et un 429
 *    déclenche une nouvelle tentative après le délai Retry-After.
 *  - /ppidexistence répond HTTP 404 avec { exists: false } quand le participant n'existe pas.
 *  - /smpquery répond HTTP 404 quand le participant n'existe pas sur le SMP.
 */
import { config } from '../config.js';
import { LookupError } from '../errors.js';
import { PeppolSource } from './baseSource.js';
import { parseDocumentTypes, parseBusinessCard, extractEndpoints } from '../parsing/helgerParser.js';
import { parseDirectorySearch } from '../parsing/directoryParser.js';

/** Nombre maximum de résultats lus dans l'annuaire Peppol pour un SIREN. */
const DIRECTORY_MAX_RESULTS = 100;

const MAX_RETRIES_ON_429 = 2;
const DEFAULT_RETRY_AFTER_S = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * File d'attente globale : garantit un intervalle minimal entre le début de deux appels.
 * Partagée par toutes les recherches (unitaires et en lot) de l'instance.
 */
function createThrottle(minIntervalMs) {
  let nextSlot = 0;
  return {
    /** Attend le prochain créneau libre. */
    async wait() {
      const now = Date.now();
      const delay = Math.max(0, nextSlot - now);
      nextSlot = Math.max(now, nextSlot) + minIntervalMs;
      if (delay > 0) await sleep(delay);
    },
    /** Suspend toute la file (après un HTTP 429) : les appels en attente sont décalés d'autant. */
    pauseFor(ms) {
      nextSlot = Math.max(nextSlot, Date.now() + ms);
    },
  };
}

export class HelgerSource extends PeppolSource {
  id = 'helger';
  label = 'peppol.helger.com';

  constructor({
    baseUrl = config.helgerApiBase,
    directoryUrls = config.directoryUrls,
    timeoutMs = config.externalTimeoutMs,
    minIntervalMs = config.helgerMinIntervalMs,
    directoryMinIntervalMs = 300,
    fetchImpl = globalThis.fetch,
  } = {}) {
    super();
    this.baseUrl = baseUrl;
    this.directoryUrls = directoryUrls;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
    this.throttle = createThrottle(minIntervalMs);
    // L'annuaire Peppol est un autre serveur : sa file est indépendante de celle de l'API Helger
    this.directoryThrottle = createThrottle(directoryMinIntervalMs);
  }

  isAvailable() {
    return true;
  }

  /**
   * Appel HTTP GET avec timeout, espacement et nouvelles tentatives sur 429.
   * @param {string} path chemin relatif (déjà encodé)
   * @param {'api'|'smp'|'directory'} target pour choisir le bon code d'erreur si l'appel échoue
   * @param {{ baseUrl?: string, throttle?: ReturnType<typeof createThrottle> }} [options]
   * @returns {Promise<{ status: number, body: any }>}
   */
  async request(path, target, { baseUrl = this.baseUrl, throttle = this.throttle } = {}) {
    const url = `${baseUrl}${path}`;

    for (let attempt = 0; ; attempt++) {
      await throttle.wait();
      let res;
      try {
        res = await this.fetch(url, {
          headers: { Accept: 'application/json', 'User-Agent': 'PAradar/1.0 (outil interne de support)' },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
        if (target === 'smp') {
          throw new LookupError(
            'SMP_UNREACHABLE',
            timedOut
              ? `Le SMP du participant n'a pas répondu dans le délai imparti (${this.timeoutMs / 1000} s)`
              : 'Le SMP du participant ne répond pas',
          );
        }
        const service = target === 'directory' ? "L'annuaire Peppol" : "L'API Peppol (peppol.helger.com)";
        throw new LookupError(
          'API_UNAVAILABLE',
          timedOut ? `${service} n'a pas répondu en ${this.timeoutMs / 1000} s` : `${service} est injoignable`,
        );
      }

      if (res.status === 429) {
        const retryAfter = Number.parseInt(res.headers.get('retry-after'), 10);
        const delayS = Number.isFinite(retryAfter) ? Math.min(retryAfter, 15) : DEFAULT_RETRY_AFTER_S;
        await res.body?.cancel().catch(() => {});
        if (attempt < MAX_RETRIES_ON_429) {
          // La nouvelle tentative repasse par la file, qui est suspendue pendant Retry-After
          throttle.pauseFor(delayS * 1000);
          continue;
        }
        throw new LookupError(
          'UPSTREAM_RATE_LIMITED',
          "L'API Peppol limite temporairement le nombre de requêtes. Réessayez dans quelques secondes.",
        );
      }

      const text = await res.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null; // réponse HTML (page d'erreur Tomcat, etc.)
      }
      return { status: res.status, body };
    }
  }

  async checkExistence(participantId, { sml }) {
    const { status, body } = await this.request(`/ppidexistence/${sml}/${encodeURIComponent(participantId)}`, 'api');
    if ((status === 200 || status === 404) && body && typeof body.exists === 'boolean') {
      return { exists: body.exists, smpHostUri: body.smpHostURI || null, raw: body };
    }
    throw new LookupError('API_UNAVAILABLE', `L'API Peppol a renvoyé une réponse inattendue (HTTP ${status})`);
  }

  async getServiceGroup(participantId, { sml }) {
    const { status, body } = await this.request(
      `/smpquery/${sml}/${encodeURIComponent(participantId)}?businessCard=true`,
      'smp',
    );
    if (status === 200 && body) {
      return {
        documentTypes: parseDocumentTypes(body.urls),
        businessCard: parseBusinessCard(body.businessCard),
        raw: body,
      };
    }
    throw new LookupError(
      'SMP_UNREACHABLE',
      status === 404
        ? "Le participant est enregistré dans le SML mais son SMP ne renvoie aucune information"
        : `Le SMP du participant ne répond pas correctement (HTTP ${status})`,
    );
  }

  async getServiceMetadata(participantId, documentTypeId, { sml }) {
    const { status, body } = await this.request(
      `/smpquery/${sml}/${encodeURIComponent(participantId)}/${encodeURIComponent(documentTypeId)}`,
      'smp',
    );
    if (status === 200 && body) {
      return { endpoints: extractEndpoints(body), raw: body };
    }
    throw new LookupError(
      'SMP_UNREACHABLE',
      `Impossible de lire le point d'accès auprès du SMP (HTTP ${status})`,
    );
  }

  /**
   * Recherche dans l'annuaire Peppol (Peppol Directory) toutes les inscriptions d'un SIREN :
   * maille SIREN, établissements (SIREN_SIRET) et codes de routage, impossibles à deviner.
   * @param {string} siren
   * @param {{ sml: string }} options
   * @returns {Promise<{ participants: ReturnType<typeof parseDirectorySearch>, total: number, raw: any }>}
   */
  async searchDirectory(siren, { sml }) {
    const baseUrl = this.directoryUrls[sml];
    if (!baseUrl) return { participants: [], total: 0, raw: null };
    const { status, body } = await this.request(
      `/search/1.0/json?q=${encodeURIComponent(siren)}&rpc=${DIRECTORY_MAX_RESULTS}`,
      'directory',
      { baseUrl, throttle: this.directoryThrottle },
    );
    if (status !== 200 || !body) {
      throw new LookupError('API_UNAVAILABLE', `L'annuaire Peppol a renvoyé une réponse inattendue (HTTP ${status})`);
    }
    return { participants: parseDirectorySearch(body, siren), total: body['total-result-count'] ?? 0, raw: body };
  }
}
