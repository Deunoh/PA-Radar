/**
 * Source « lookup Peppol direct » : interroge l'infrastructure Peppol sans passer par peppol.helger.com.
 * Notes complètes et vérifiées (domaines, formats XML, champs à conserver) : docs/source-peppol-directe.md
 *
 *  1. SML : nom DNS du participant = base32(sha256(valeur en minuscules, ex. "0225:750620585")) sans "="
 *     + ".iso6523-actorid-upis." + domaine du SML (config.smlDomains). Requête NAPTR via DNS-over-HTTPS
 *     (Cloudflare Workers ne fait pas de requête DNS native) → URL du SMP. NXDOMAIN → participant absent.
 *  2. SMP : GET {smp}/{participant} (ServiceGroup), GET {smp}/businesscard/{participant},
 *     GET {smp}/{participant}/services/{type de document} (SignedServiceMetadata).
 *  3. Le XML est traduit au format JSON de Helger (../parsing/smpParser.js), puis lu par helgerParser.js :
 *     les données normalisées sont identiques à celles de la source Helger.
 */
import { config } from '../config.js';
import { LookupError } from '../errors.js';
import { PeppolSource } from './baseSource.js';
import { parseDocumentTypes, parseBusinessCard, extractEndpoints } from '../parsing/helgerParser.js';
import { parseServiceGroupXml, parseBusinessCardXml, parseServiceMetadataXml } from '../parsing/smpParser.js';
import { parseDirectorySearch } from '../parsing/directoryParser.js';

/** Nombre maximum de résultats lus dans l'annuaire Peppol pour un SIREN (comme la source Helger). */
const DIRECTORY_MAX_RESULTS = 100;

/** Durée de mémorisation de l'adresse du SMP d'un participant, entre les étapes d'une même recherche. */
const SMP_CACHE_TTL_MS = 5 * 60_000;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/**
 * Nom DNS à interroger dans le SML pour un participant (Peppol Policy for use of identifiers 4.x).
 * @param {string} participantId ex. "iso6523-actorid-upis::0225:750620585"
 * @param {string} smlDomain ex. "participant.sml.prod.tech.peppol.org"
 */
export async function smlDnsName(participantId, smlDomain) {
  const idx = participantId.indexOf('::');
  const scheme = idx >= 0 ? participantId.slice(0, idx) : 'iso6523-actorid-upis';
  const value = idx >= 0 ? participantId.slice(idx + 2) : participantId;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value.toLowerCase()));
  return `${base32(new Uint8Array(hash))}.${scheme.toLowerCase()}.${smlDomain}`;
}

/**
 * URL du SMP dans un enregistrement NAPTR « 100 10 "U" "Meta:SMP" "!.*!https://smp.example.com/!" . ».
 * @param {string} data
 */
export function smpUrlFromNaptr(data) {
  const fields = [...String(data).matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  if (fields.length < 3 || !/^U$/i.test(fields[0]) || !/^Meta:SMP$/i.test(fields[1])) return null;
  const regexp = fields[2];
  const parts = regexp.split(regexp[0]);
  return parts[2] || null;
}

export class DirectPeppolSource extends PeppolSource {
  id = 'direct';
  label = 'Lookup Peppol direct (SML + SMP)';

  constructor({
    smlDomains = config.smlDomains,
    dohUrl = config.dohUrl,
    directoryUrls = config.directoryUrls,
    timeoutMs = config.externalTimeoutMs,
    // Appel via une fonction : Cloudflare Workers refuse un fetch appelé comme méthode d'un autre objet
    fetchImpl = (...args) => globalThis.fetch(...args),
    now = () => new Date(),
  } = {}) {
    super();
    this.smlDomains = smlDomains;
    this.dohUrl = dohUrl;
    this.directoryUrls = directoryUrls;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
    this.now = now;
    /** @type {Map<string, { expires: number, value: Promise<{ smpUrl: string|null, raw: any }> }>} */
    this.smpCache = new Map();
  }

  isAvailable() {
    return true;
  }

  /**
   * Appel HTTP GET avec délai maximal. Les échecs réseau deviennent des LookupError.
   * @param {string} url
   * @param {'sml'|'smp'|'directory'} target pour choisir le bon code d'erreur
   * @param {Record<string, string>} [headers]
   * @returns {Promise<{ status: number, text: string }>}
   */
  async request(url, target, headers = {}) {
    let res;
    try {
      res = await this.fetch(url, {
        headers: { 'User-Agent': 'PAradar/1.0 (outil interne de support)', ...headers },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      if (target === 'smp') {
        throw new LookupError(
          'SMP_UNREACHABLE',
          timedOut
            ? `Le SMP du participant n'a pas répondu dans le délai imparti (${this.timeoutMs / 1000} s)`
            : 'Le SMP du participant ne répond pas',
        );
      }
      const service = target === 'directory' ? "L'annuaire Peppol" : 'Le registre Peppol (SML)';
      throw new LookupError(
        'API_UNAVAILABLE',
        timedOut ? `${service} n'a pas répondu en ${this.timeoutMs / 1000} s` : `${service} est injoignable`,
      );
    }
    return { status: res.status, text: await res.text() };
  }

  /**
   * Interroge le SML (NAPTR via DNS-over-HTTPS) et renvoie l'URL du SMP, ou null si le participant est absent.
   * Mémorisé quelques minutes : chaque étape d'une recherche a besoin de l'adresse du SMP.
   * @param {string} participantId
   * @param {string} sml
   */
  resolveSmp(participantId, sml) {
    const key = `${sml}|${participantId.toLowerCase()}`;
    const hit = this.smpCache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;

    const value = this.#querySml(participantId, sml);
    this.smpCache.set(key, { expires: Date.now() + SMP_CACHE_TTL_MS, value });
    // Une erreur ne doit pas rester en mémoire
    value.catch(() => this.smpCache.delete(key));
    if (this.smpCache.size > 5000) {
      for (const [k, v] of this.smpCache) if (v.expires <= Date.now()) this.smpCache.delete(k);
    }
    return value;
  }

  async #querySml(participantId, sml) {
    const domain = this.smlDomains[sml];
    if (!domain) throw new LookupError('BAD_REQUEST', `SML inconnu : ${sml}`);
    const name = await smlDnsName(participantId, domain);
    const url = `${this.dohUrl}?name=${encodeURIComponent(name)}&type=NAPTR`;
    const { status, text } = await this.request(url, 'sml', { Accept: 'application/dns-json' });

    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    if (status !== 200 || !body || typeof body.Status !== 'number') {
      throw new LookupError('API_UNAVAILABLE', `Le registre Peppol (SML) a renvoyé une réponse inattendue (HTTP ${status})`);
    }
    // Status 3 = NXDOMAIN : le participant n'est pas inscrit. Tout autre code non nul est une panne DNS.
    if (body.Status === 3) return { smpUrl: null, raw: { dnsName: name, status: body.Status, answers: [] } };
    if (body.Status !== 0) {
      throw new LookupError('API_UNAVAILABLE', `Le registre Peppol (SML) ne répond pas (code DNS ${body.Status})`);
    }
    const answers = (body.Answer || []).filter((a) => a.type === 35).map((a) => a.data);
    const smpUrl = answers.map(smpUrlFromNaptr).find(Boolean) || null;
    return { smpUrl, raw: { dnsName: name, status: body.Status, answers } };
  }

  /** URL du SMP, ou erreur si le participant a disparu du SML entre deux étapes. */
  async #requireSmp(participantId, sml) {
    const { smpUrl } = await this.resolveSmp(participantId, sml);
    if (!smpUrl) {
      throw new LookupError('SMP_UNREACHABLE', "Le participant est enregistré dans le SML mais son SMP ne renvoie aucune information");
    }
    return smpUrl.replace(/\/+$/, '');
  }

  async checkExistence(participantId, { sml }) {
    const { smpUrl, raw } = await this.resolveSmp(participantId, sml);
    return {
      exists: Boolean(smpUrl),
      smpHostUri: smpUrl,
      // Même forme que /ppidexistence de Helger, avec le détail de la requête DNS
      raw: { participantID: participantId, sml, smpHostURI: smpUrl, exists: Boolean(smpUrl), source: 'direct', smlQuery: raw },
    };
  }

  async getServiceGroup(participantId, { sml }) {
    const smp = await this.#requireSmp(participantId, sml);
    const encoded = encodeURIComponent(participantId);
    const [group, card] = await Promise.all([
      this.request(`${smp}/${encoded}`, 'smp', { Accept: 'application/xml, text/xml' }),
      // La Business Card est facultative : son absence ou une erreur n'empêchent pas la recherche
      this.request(`${smp}/businesscard/${encoded}`, 'smp', { Accept: 'application/xml, text/xml' }).catch(() => null),
    ]);

    if (group.status !== 200) {
      throw new LookupError(
        'SMP_UNREACHABLE',
        group.status === 404
          ? "Le participant est enregistré dans le SML mais son SMP ne renvoie aucune information"
          : `Le SMP du participant ne répond pas correctement (HTTP ${group.status})`,
      );
    }
    let raw;
    try {
      raw = parseServiceGroupXml(group.text);
    } catch (err) {
      throw new LookupError('SMP_UNREACHABLE', `Le SMP du participant a renvoyé une réponse illisible (${err.message})`);
    }

    let businessCard = null;
    if (card?.status === 200) {
      try {
        businessCard = parseBusinessCardXml(card.text);
      } catch {
        businessCard = null;
      }
    }
    if (businessCard) raw.businessCard = businessCard;
    raw.source = 'direct';

    return { documentTypes: parseDocumentTypes(raw.urls), businessCard: parseBusinessCard(businessCard), raw };
  }

  async getServiceMetadata(participantId, documentTypeId, { sml }) {
    const smp = await this.#requireSmp(participantId, sml);
    let url = `${smp}/${encodeURIComponent(participantId)}/services/${encodeURIComponent(documentTypeId)}`;

    // Un SMP peut rediriger vers un autre SMP : on suit une seule redirection
    for (let hop = 0; hop < 2; hop++) {
      const { status, text } = await this.request(url, 'smp', { Accept: 'application/xml, text/xml' });
      if (status !== 200) {
        throw new LookupError('SMP_UNREACHABLE', `Impossible de lire le point d'accès auprès du SMP (HTTP ${status})`);
      }
      let raw;
      try {
        raw = parseServiceMetadataXml(text, this.now());
      } catch (err) {
        throw new LookupError('SMP_UNREACHABLE', `Le SMP du participant a renvoyé une réponse illisible (${err.message})`);
      }
      if (raw.redirect) {
        url = raw.redirect;
        continue;
      }
      raw.source = 'direct';
      return { endpoints: extractEndpoints(raw), raw };
    }
    throw new LookupError('SMP_UNREACHABLE', 'Le SMP du participant redirige en boucle');
  }

  /** Recherche dans l'annuaire Peppol : même appel que la source Helger (l'annuaire ne dépend pas de Helger). */
  async searchDirectory(siren, { sml }) {
    const baseUrl = this.directoryUrls[sml];
    if (!baseUrl) return { participants: [], total: 0, raw: null };
    const { status, text } = await this.request(
      `${baseUrl}/search/1.0/json?q=${encodeURIComponent(siren)}&rpc=${DIRECTORY_MAX_RESULTS}`,
      'directory',
      { Accept: 'application/json' },
    );
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    if (status !== 200 || !body) {
      throw new LookupError('API_UNAVAILABLE', `L'annuaire Peppol a renvoyé une réponse inattendue (HTTP ${status})`);
    }
    return { participants: parseDirectorySearch(body, siren), total: body['total-result-count'] ?? 0, raw: body };
  }
}
