/**
 * Petit cache mémoire clé → valeur avec durée de vie (TTL).
 * Suffisant pour un outil interne mono-instance.
 */
export class TtlCache {
  /**
   * @param {number} ttlMs durée de vie d'une entrée
   * @param {number} [maxEntries] nombre maximum d'entrées (les plus anciennes sont évincées)
   */
  constructor(ttlMs, maxEntries = 1000) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    /** @type {Map<string, { value: any, expiresAt: number }>} */
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    if (this.store.size >= this.maxEntries) {
      // Map conserve l'ordre d'insertion : la première clé est la plus ancienne
      this.store.delete(this.store.keys().next().value);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clear() {
    this.store.clear();
  }
}
