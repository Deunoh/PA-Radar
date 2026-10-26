/**
 * Logique des routes /api, indépendante du serveur HTTP : utilisée par Express
 * (src/server/index.js, en local) et par le Worker Cloudflare (src/worker/index.js, en ligne).
 *
 *  - GET /api/config                                  configuration utile au front
 *  - GET /api/lookup?id=…&sml=…&refresh=1&raw=0       recherche unitaire (raw=0 : sans les réponses brutes)
 */
import { config, SUPPORTED_SMLS } from './config.js';
import { LookupError } from './errors.js';
import { getDefaultSource, sources } from './sources/index.js';
import { LookupService } from './services/lookupService.js';

const lookupService = new LookupService({ source: getDefaultSource() });

export function getConfig() {
  return {
    defaultSml: config.defaultSml,
    smls: SUPPORTED_SMLS,
    cacheTtlMinutes: config.cacheTtlMs / 60_000,
    rateLimitPerMinute: config.rateLimitPerMinute,
    helgerMinIntervalMs: config.helgerMinIntervalMs,
    sources: Object.values(sources).map((s) => ({ id: s.id, label: s.label, available: s.isAvailable() })),
  };
}

/**
 * Limitation simple par client sur une fenêtre glissante d'une minute.
 * Renvoie une fonction qui lève RATE_LIMITED (avec `retryAfter` en secondes) quand la limite est atteinte.
 * @param {number} maxPerMinute
 */
export function createRateLimiter(maxPerMinute) {
  /** @type {Map<string, number[]>} */
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < 60_000);
    if (recent.length >= maxPerMinute) {
      const retryAfter = Math.ceil((60_000 - (now - recent[0])) / 1000);
      throw new LookupError(
        'RATE_LIMITED',
        `Limite de ${maxPerMinute} recherches par minute atteinte. Réessayez dans ${retryAfter} s.`,
        { retryAfter },
      );
    }
    recent.push(now);
    hits.set(key, recent);
    // Nettoyage occasionnel des clients inactifs
    if (hits.size > 1000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k);
  };
}

const checkRateLimit = createRateLimiter(config.rateLimitPerMinute);

/**
 * Recherche unitaire.
 * @param {URLSearchParams} params
 * @param {string} clientKey identifiant du client pour la limite (adresse IP)
 */
export function lookup(params, clientKey) {
  checkRateLimit(clientKey || 'local');
  const flag = (name) => params.get(name) === '1' || params.get(name) === 'true';
  return lookupService.lookup(params.get('id'), {
    sml: params.get('sml') || undefined,
    refresh: flag('refresh'),
    includeRaw: params.get('raw') !== '0',
  });
}

/**
 * Traduit une erreur en réponse JSON { error: { code, message } }.
 * @param {any} err
 * @returns {{ status: number, body: any, headers: Record<string, string> }}
 */
export function toErrorResponse(err) {
  if (err instanceof LookupError) {
    const headers = err.details?.retryAfter ? { 'Retry-After': String(err.details.retryAfter) } : {};
    return { status: err.status, body: err.toJSON(), headers };
  }
  console.error('[erreur]', err);
  return { status: 500, body: { error: { code: 'INTERNAL', message: 'Erreur interne du serveur' } }, headers: {} };
}
