/**
 * Serveur Express de PAradar.
 * - En développement : sert uniquement l'API (/api), Vite sert le front et redirige /api ici.
 * - En production (npm run build puis npm start) : sert aussi le front compilé (dist/).
 */
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { config, SUPPORTED_SMLS } from './config.js';
import { LookupError } from './errors.js';
import { getDefaultSource, sources } from './sources/index.js';
import { KnownAccessPointsStore } from './services/knownAccessPoints.js';
import { LookupService } from './services/lookupService.js';
import { createLookupRouter } from './routes/lookup.js';
import { createKnownAccessPointsRouter } from './routes/knownAccessPoints.js';

const knownAccessPoints = new KnownAccessPointsStore(config.knownAccessPointsFile);
const lookupService = new LookupService({ source: getDefaultSource(), knownAccessPoints });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '1mb' }));

// Informations de configuration utiles au front
app.get('/api/config', (_req, res) => {
  res.json({
    defaultSml: config.defaultSml,
    smls: SUPPORTED_SMLS,
    cacheTtlMinutes: config.cacheTtlMs / 60_000,
    rateLimitPerMinute: config.rateLimitPerMinute,
    batchPauseMs: config.batchPauseMs,
    helgerMinIntervalMs: config.helgerMinIntervalMs,
    sources: Object.values(sources).map((s) => ({ id: s.id, label: s.label, available: s.isAvailable() })),
  });
});

app.use('/api', createLookupRouter(lookupService));
app.use('/api', createKnownAccessPointsRouter(knownAccessPoints));

app.use('/api', (_req, _res, next) => next(new LookupError('BAD_REQUEST', 'Route API inconnue')));

// Front compilé (production)
const distDir = path.join(config.rootDir, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// Gestion centralisée des erreurs → JSON { error: { code, message } }
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof LookupError) return res.status(err.status).json(err.toJSON());
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Corps JSON invalide' } });
  }
  console.error('[erreur]', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Erreur interne du serveur' } });
});

app.listen(config.port, () => {
  console.log(`PAradar API → http://localhost:${config.port}  (SML par défaut : ${config.defaultSml})`);
});
