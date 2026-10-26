/**
 * Routes de recherche :
 *  - GET  /api/lookup?id=…&sml=…&refresh=1   recherche unitaire
 *  - POST /api/lookup/batch                   recherche en lot, progression en Server-Sent Events
 */
import { Router } from 'express';
import { validateIdentifier } from '../../shared/identifiers.js';
import { LookupError } from '../errors.js';
import { config } from '../config.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Limitation simple par adresse IP sur une fenêtre glissante d'une minute.
 * @param {number} maxPerMinute
 */
export function rateLimit(maxPerMinute) {
  /** @type {Map<string, number[]>} */
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip || 'local';
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < 60_000);
    if (recent.length >= maxPerMinute) {
      const retryAfter = Math.ceil((60_000 - (now - recent[0])) / 1000);
      res.set('Retry-After', String(retryAfter));
      return next(
        new LookupError('RATE_LIMITED', `Limite de ${maxPerMinute} recherches par minute atteinte. Réessayez dans ${retryAfter} s.`),
      );
    }
    recent.push(now);
    hits.set(key, recent);
    // Nettoyage occasionnel des IP inactives
    if (hits.size > 1000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k);
    next();
  };
}

/**
 * Version allégée d'une réponse pour la recherche en lot.
 */
function toBatchItem(id, response) {
  const r = response.result;
  return {
    id,
    siren: response.siren,
    siret: response.siret,
    status: r ? 'found' : 'not_found',
    participantId: r?.participantShortId || null,
    companyName: r?.companyName || null,
    peppol: Boolean(r),
    frenchReform: r ? r.frenchReform.regulated || r.frenchReform.nonRegulated : false,
    pa: r?.pa.name || null,
    popId: r?.pa.popId || null,
    operator: r?.pa.operator || null,
    technicalHost: r?.technicalHost || null,
    error: null,
  };
}

/**
 * @param {import('../services/lookupService.js').LookupService} lookupService
 */
export function createLookupRouter(lookupService) {
  const router = Router();

  router.get('/lookup', rateLimit(config.rateLimitPerMinute), async (req, res, next) => {
    try {
      const response = await lookupService.lookup(req.query.id, {
        sml: req.query.sml,
        refresh: req.query.refresh === '1' || req.query.refresh === 'true',
      });
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  router.post('/lookup/batch', async (req, res, next) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || !ids.length) {
      return next(new LookupError('BAD_REQUEST', 'Le corps doit contenir { "ids": [ … ] } avec au moins un identifiant'));
    }
    if (ids.length > config.batchMaxItems) {
      return next(new LookupError('BAD_REQUEST', `Maximum ${config.batchMaxItems} identifiants par lot`));
    }
    let sml;
    try {
      sml = lookupService.resolveSml(req.body.sml);
    } catch (err) {
      return next(err);
    }

    // Ouverture du flux SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    let aborted = false;
    res.on('close', () => {
      aborted = true;
    });

    const items = ids.map((raw) => ({ raw: String(raw), validation: validateIdentifier(String(raw)) }));
    const validCount = items.filter((i) => i.validation.valid).length;
    send('start', { total: items.length, valid: validCount, invalid: items.length - validCount, sml });

    const started = Date.now();
    let processedValid = 0;
    for (let index = 0; index < items.length && !aborted; index++) {
      const { raw, validation } = items[index];
      let item;
      if (!validation.valid) {
        item = { id: raw, status: 'invalid', error: validation.error };
      } else {
        // Pause entre deux identifiants pour ne pas surcharger les SMP
        if (processedValid > 0) await sleep(config.batchPauseMs);
        if (aborted) break;
        try {
          const response = await lookupService.lookup(validation.cleaned, { sml, includeRaw: false });
          item = { ...toBatchItem(validation.cleaned, response), cached: response.cached };
        } catch (err) {
          item = { id: validation.cleaned, status: 'error', error: err.message, errorCode: err.code || 'ERROR' };
        }
        processedValid++;
      }
      send('progress', { index, done: index + 1, total: items.length, elapsedMs: Date.now() - started, item });
    }

    if (!aborted) {
      send('done', { total: items.length, durationMs: Date.now() - started });
      res.end();
    }
  });

  return router;
}
