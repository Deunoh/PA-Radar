/**
 * Détection de l'hébergeur technique d'un point d'accès Peppol.
 *
 * Beaucoup de plateformes agréées utilisent un point d'accès « marque blanche » :
 * le certificat est à leur nom (O=), mais l'infrastructure (endpoint AS4, SMP)
 * est opérée par un prestataire. On déduit ce prestataire à partir des domaines.
 */

/**
 * Domaines d'infrastructure connus → nom de l'opérateur technique.
 * Correspondance sur le domaine enregistrable (ex. ap.galaxygw.com → galaxygw.com).
 */
export const KNOWN_INFRA_DOMAINS = {
  'galaxygw.com': 'Tickstar',
  'tickstar.com': 'Tickstar',
  'storecove.com': 'Storecove',
  'pagero.com': 'Pagero',
  'basware.com': 'Basware',
  'unifiedpost.com': 'Unifiedpost',
  'banqup.com': 'Unifiedpost',
  'tradeshift.com': 'Tradeshift',
  'ecosio.com': 'ecosio',
  'b2brouter.net': 'B2Brouter',
  'edicomgroup.com': 'EDICOM',
  'edicomnet.com': 'EDICOM',
  'sovos.com': 'Sovos',
  'comarch.com': 'Comarch',
  'docuware.cloud': 'DocuWare',
  'ionos.com': 'IONOS',
  'qvalia.com': 'Qvalia',
  'crossinx.com': 'crossinx',
  'babelway.net': 'Babelway',
  'seeburger.com': 'SEEBURGER',
  'generix.biz': 'Generix',
  'generixgroup.com': 'Generix',
  'esker.com': 'Esker',
  'yooz.fr': 'Yooz',
  'docoon.com': 'Docoon',
};

/** Suffixes publics à deux niveaux (liste volontairement courte). */
const TWO_LEVEL_SUFFIXES = new Set(['co.uk', 'com.au', 'co.nz', 'com.br', 'co.jp']);

/**
 * Indique si la description du service mentionne un point d'accès marque blanche.
 * @param {string|null} serviceDescription
 */
export function isWhiteLabel(serviceDescription) {
  return /white[\s-]?label/i.test(serviceDescription || '');
}

/**
 * Extrait le domaine enregistrable d'une URL (ex. https://ap.galaxygw.com/x → galaxygw.com).
 * @param {string|null} url
 * @returns {string|null}
 */
export function registrableDomain(url) {
  if (!url) return null;
  let hostname;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (/^[\d.]+$/.test(hostname)) return hostname; // adresse IP
  const labels = hostname.split('.');
  const lastTwo = labels.slice(-2).join('.');
  const take = TWO_LEVEL_SUFFIXES.has(lastTwo) ? 3 : 2;
  return labels.slice(-take).join('.');
}

/**
 * Renvoie le nom d'hôte complet d'une URL, ou null.
 * @param {string|null} url
 */
export function hostnameOf(url) {
  try {
    return url ? new URL(url).hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Déduit l'hébergeur technique.
 * - Si le point d'accès est en marque blanche : nom connu du domaine de l'endpoint,
 *   sinon celui du SMP, sinon le domaine brut de l'endpoint.
 * - Sinon : on renvoie tout de même le nom connu de l'infrastructure s'il existe
 *   (information utile pour le support), sans le qualifier de marque blanche.
 *
 * @param {{ serviceDescription?: string|null, endpointUrl?: string|null, smpHostUri?: string|null }} input
 * @returns {{ name: string|null, whiteLabel: boolean, endpointHost: string|null, smpHost: string|null }}
 */
export function detectTechnicalHost({ serviceDescription, endpointUrl, smpHostUri }) {
  const whiteLabel = isWhiteLabel(serviceDescription);
  const endpointDomain = registrableDomain(endpointUrl);
  const smpDomain = registrableDomain(smpHostUri);
  const known = KNOWN_INFRA_DOMAINS[endpointDomain] || KNOWN_INFRA_DOMAINS[smpDomain] || null;

  return {
    name: whiteLabel ? known || endpointDomain : known,
    whiteLabel,
    endpointHost: hostnameOf(endpointUrl),
    smpHost: hostnameOf(smpHostUri),
  };
}
