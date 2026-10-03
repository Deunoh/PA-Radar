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

// Interface :
//  - `npm run dev`   (option --dev) : servie par Vite sur le port 5173 → on y redirige
//  - `npm start`     : front compilé (dist/), s'il existe
//  - sinon           : page d'aide expliquant comment obtenir l'interface
const isDev = process.argv.includes('--dev');
const VITE_URL = 'http://localhost:5173';
const distDir = path.join(config.rootDir, 'dist');
const hasDist = fs.existsSync(path.join(distDir, 'index.html'));

if (isDev) {
  app.get(/^\/(?!api\/).*/, (req, res) => res.redirect(VITE_URL + req.originalUrl));
} else if (hasDist) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
} else {
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.status(503).type('html').send(`<!doctype html><html lang="fr"><meta charset="utf-8"><title>PAradar</title>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:0 16px;line-height:1.6;color:#0f172a">
<h1 style="font-size:22px">L'interface de PAradar n'est pas compilée</h1>
<p>L'API fonctionne, mais le dossier <code>dist/</code> est absent. Deux possibilités :</p>
<ul>
<li>Compiler l'interface puis relancer : <code>npm run build</code> puis <code>npm start</code> → interface sur ce port.</li>
<li>Ou lancer le mode développement : <code>npm run dev</code> → interface sur <a href="${VITE_URL}">${VITE_URL}</a>.</li>
</ul></body></html>`);
  });
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
  const api = `http://localhost:${config.port}`;
  console.log(`PAradar – API sur ${api} (SML par défaut : ${config.defaultSml})`);
  if (isDev) {
    console.log(`\n  ➜  Ouvrez l'interface : ${VITE_URL}\n`);
  } else if (hasDist) {
    console.log(`\n  ➜  Ouvrez l'interface : ${api}\n`);
  } else {
    console.warn(`\n  ⚠  Interface non compilée : lancez « npm run build » puis « npm start »,\n     ou « npm run dev » (interface sur ${VITE_URL}).\n`);
  }
});
