/**
 * Configuration lue depuis les variables d'environnement (.env chargé par Node --env-file en local,
 * variables du Worker en ligne). Sans import Node : ce module tourne aussi sur Cloudflare Workers.
 */
const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const parseTrustProxy = (value) => {
  if (!value) return 'loopback';
  if (value === 'true') return true;
  if (value === 'false') return false;
  return /^\d+$/.test(value) ? Number(value) : value;
};

export const SUPPORTED_SMLS = ['peppolprod', 'peppoltest'];

export const config = {
  port: int(process.env.PORT, 3001),
  defaultSml: SUPPORTED_SMLS.includes(process.env.DEFAULT_SML) ? process.env.DEFAULT_SML : 'peppolprod',
  cacheTtlMs: int(process.env.CACHE_TTL_MINUTES, 15) * 60_000,
  rateLimitPerMinute: int(process.env.RATE_LIMIT_PER_MINUTE, 30),
  externalTimeoutMs: int(process.env.EXTERNAL_TIMEOUT_MS, 10_000),
  helgerApiBase: (process.env.HELGER_API_BASE || 'https://peppol.helger.com/api').replace(/\/$/, ''),
  // Annuaire Peppol (Peppol Directory), un par réseau
  directoryUrls: {
    peppolprod: (process.env.DIRECTORY_URL_PROD || 'https://directory.peppol.eu').replace(/\/$/, ''),
    peppoltest: (process.env.DIRECTORY_URL_TEST || 'https://test-directory.peppol.eu').replace(/\/$/, ''),
  },
  // Espacement minimal entre deux appels à l'API Helger (elle renvoie 429 au-delà d'~1 req/s)
  helgerMinIntervalMs: int(process.env.HELGER_MIN_INTERVAL_MS, 1200),
  // Proxys de confiance pour lire l'IP du client (X-Forwarded-For) : « true » derrière un hébergeur
  // comme Render, sinon seul un proxy local est cru (valeurs acceptées par Express « trust proxy »)
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
};
