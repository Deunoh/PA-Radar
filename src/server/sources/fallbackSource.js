/**
 * Source « avec secours » : interroge la source principale et, si elle ne répond pas,
 * reprend la même question auprès de la source de secours.
 *
 * Les deux sources produisent les mêmes formes normalisées (voir baseSource.js) : une recherche
 * peut donc mélanger les deux sans que le résultat change.
 *
 * Quand la source principale est en panne (API_UNAVAILABLE, UPSTREAM_RATE_LIMITED), elle est mise
 * de côté pendant `cooldownMs` : les appels suivants vont directement au secours, sans attendre
 * à chaque fois l'échec de la principale.
 */
import { LookupError } from '../errors.js';
import { PeppolSource } from './baseSource.js';

/** Erreurs de la source principale qui justifient d'essayer le secours. */
const FALLBACK_CODES = new Set(['API_UNAVAILABLE', 'UPSTREAM_RATE_LIMITED', 'SMP_UNREACHABLE']);

/** Erreurs qui indiquent une panne de la source principale elle-même (et pas d'un SMP). */
const OUTAGE_CODES = new Set(['API_UNAVAILABLE', 'UPSTREAM_RATE_LIMITED']);

export class FallbackSource extends PeppolSource {
  /**
   * @param {PeppolSource} primary
   * @param {PeppolSource} secondary
   * @param {{ cooldownMs?: number }} [options]
   */
  constructor(primary, secondary, { cooldownMs = 60_000 } = {}) {
    super();
    this.primary = primary;
    this.secondary = secondary;
    this.cooldownMs = cooldownMs;
    this.primaryDownUntil = 0;
    this.id = `${primary.id}+${secondary.id}`;
    this.label = `${primary.label} (secours : ${secondary.label})`;
  }

  isAvailable() {
    return this.primary.isAvailable() || this.secondary.isAvailable();
  }

  /** La source principale est-elle actuellement mise de côté ? */
  get primaryDown() {
    return Date.now() < this.primaryDownUntil;
  }

  async #call(method, args) {
    if (!this.primaryDown) {
      try {
        return await this.primary[method](...args);
      } catch (err) {
        const code = err instanceof LookupError ? err.code : null;
        // Erreur « métier » (identifiant invalide…) : le secours répondrait la même chose
        if (code && !FALLBACK_CODES.has(code)) throw err;
        if (!code || OUTAGE_CODES.has(code)) this.primaryDownUntil = Date.now() + this.cooldownMs;
        console.warn(`[source] ${this.primary.label} : ${err.message} — essai avec ${this.secondary.label}`);
      }
    }
    return this.secondary[method](...args);
  }

  checkExistence(...args) {
    return this.#call('checkExistence', args);
  }

  getServiceGroup(...args) {
    return this.#call('getServiceGroup', args);
  }

  getServiceMetadata(...args) {
    return this.#call('getServiceMetadata', args);
  }

  searchDirectory(...args) {
    return this.#call('searchDirectory', args);
  }
}
