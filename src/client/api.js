/**
 * Client HTTP de l'API PAradar.
 */

/** Erreur API avec code métier (INVALID_ID, API_UNAVAILABLE, SMP_UNREACHABLE…). */
export class ApiError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('NETWORK', 'Impossible de joindre le serveur PAradar. Est-il démarré ?');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error?.code || 'HTTP_' + res.status, body?.error?.message || `Erreur HTTP ${res.status}`, body?.error?.details);
  }
  return body;
}

/**
 * Recherche unitaire.
 * @param {string} id
 * @param {{ sml?: string, refresh?: boolean, raw?: boolean, signal?: AbortSignal }} [options]
 *   raw : false pour ne pas recevoir les réponses brutes (recherche en lot)
 */
export function lookup(id, { sml, refresh, raw = true, signal } = {}) {
  const params = new URLSearchParams({ id });
  if (sml) params.set('sml', sml);
  if (refresh) params.set('refresh', '1');
  if (!raw) params.set('raw', '0');
  return request(`/api/lookup?${params}`, { signal });
}
