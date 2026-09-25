/**
 * Routes de la table de correspondance des points d'accès :
 *  - GET    /api/known-access-points          liste
 *  - POST   /api/known-access-points          ajout / modification { popId, pa, note?, operator? }
 *  - DELETE /api/known-access-points/:popId   suppression
 */
import { Router } from 'express';

/**
 * @param {import('../services/knownAccessPoints.js').KnownAccessPointsStore} store
 */
export function createKnownAccessPointsRouter(store) {
  const router = Router();

  router.get('/known-access-points', async (_req, res, next) => {
    try {
      res.json({ items: await store.list() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/known-access-points', async (req, res, next) => {
    try {
      const entry = await store.upsert(req.body || {});
      res.status(201).json({ item: entry, items: await store.list() });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/known-access-points/:popId', async (req, res, next) => {
    try {
      const removed = await store.remove(req.params.popId);
      res.status(removed ? 200 : 404).json({ removed, items: await store.list() });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
