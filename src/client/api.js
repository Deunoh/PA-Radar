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
 * @param {{ sml?: string, refresh?: boolean, signal?: AbortSignal }} [options]
 */
export function lookup(id, { sml, refresh, signal } = {}) {
  const params = new URLSearchParams({ id });
  if (sml) params.set('sml', sml);
  if (refresh) params.set('refresh', '1');
  return request(`/api/lookup?${params}`, { signal });
}

/**
 * Recherche en lot : lit le flux Server-Sent Events renvoyé par POST /api/lookup/batch.
 * (EventSource ne permet pas de POST, on lit donc le flux « à la main ».)
 * @param {string[]} ids
 * @param {{ sml?: string, signal?: AbortSignal, onEvent: (event: string, data: any) => void }} options
 */
export async function lookupBatch(ids, { sml, signal, onEvent }) {
  let res;
  try {
    res = await fetch('/api/lookup/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, sml }),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('NETWORK', 'Impossible de joindre le serveur PAradar.');
  }
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error?.code || 'HTTP_' + res.status, body?.error?.message || `Erreur HTTP ${res.status}`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    // Les messages SSE sont séparés par une ligne vide
    let sep;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = 'message';
      let data = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (data) onEvent(event, JSON.parse(data));
    }
  }
}
