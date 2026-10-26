/**
 * Point d'entrée Cloudflare Workers (déploiement en ligne, voir wrangler.jsonc).
 * Les fichiers du front (dist/) sont servis directement par Cloudflare ;
 * seules les requêtes /api/* arrivent ici.
 */
import { getConfig, lookup, toErrorResponse } from '../server/api.js';
import { LookupError } from '../server/errors.js';

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

export default {
  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/api/config') return json(200, getConfig());
      if (request.method === 'GET' && url.pathname === '/api/lookup') {
        return json(200, await lookup(url.searchParams, request.headers.get('CF-Connecting-IP')));
      }
      throw new LookupError('BAD_REQUEST', 'Route API inconnue');
    } catch (err) {
      const { status, body, headers } = toErrorResponse(err);
      return json(status, body, headers);
    }
  },
};
