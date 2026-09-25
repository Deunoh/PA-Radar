/**
 * Fonctions pures de lecture des réponses JSON de l'API peppol.helger.com.
 *
 * Structure vérifiée sur le cas réel iso6523-actorid-upis::0225:750620585 :
 *  - /ppidexistence  → { participantID, sml, smpHostURI, exists }
 *                      (HTTP 404 avec exists:false si le participant n'existe pas)
 *  - /smpquery?businessCard=true → { urls: [{ documentTypeID, niceName, state, isDeprecated }],
 *                      businessCard: { participant, entity: [{ name: [{ name, language }],
 *                      countrycode, geoinfo, additionalinfo, regdate, websiteuri?, contact? }] } }
 *  - /smpquery/{doctype} → { serviceinfo: { processes: [{ processID, endpoints: [{
 *                      endpointReference, serviceActivationDate, serviceExpirationDate,
 *                      certificateDetails: { subject: { O, CN }, serial16, notBefore, notAfter, validByDate },
 *                      serviceDescription, technicalContactUrl, technicalInformationUrl }] }] } }
 *
 * Les autres sources (Peppol direct, etc.) devront produire les mêmes formes normalisées.
 */

/** Process IDs de la réforme française de la facturation électronique. */
export const FR_PROCESS_REGULATED = 'urn:peppol:france:billing:regulated';
export const FR_PROCESS_NON_REGULATED = 'urn:peppol:france:billing:non-regulated';

/** Libellés lisibles des statuts connus de la Business Card (champ additionalinfo). */
const STATUS_LABELS = {
  FR_ASSUJETTI_ACTIVE: 'Assujetti actif',
};

/**
 * Retire le préfixe de schéma d'un identifiant Peppol (« scheme::valeur » → « valeur »).
 * @param {string} id
 */
export function stripScheme(id) {
  if (!id) return '';
  const idx = id.indexOf('::');
  return idx >= 0 ? id.slice(idx + 2) : id;
}

/**
 * Normalise la liste des types de documents acceptés.
 * @param {Array<Object>} urls champ `urls` de /smpquery
 * @returns {Array<{ documentTypeID: string, niceName: string, isFrench: boolean, isDeprecated: boolean }>}
 */
export function parseDocumentTypes(urls) {
  if (!Array.isArray(urls)) return [];
  return urls
    .filter((u) => u && u.documentTypeID)
    .map((u) => {
      const niceName = u.niceName || stripScheme(u.documentTypeID);
      return {
        documentTypeID: u.documentTypeID,
        niceName,
        isFrench: /^France\b/i.test(niceName) || u.documentTypeID.includes(':france:'),
        isDeprecated: Boolean(u.isDeprecated),
      };
    });
}

/**
 * Choisit le type de document de référence à interroger pour lire le point d'accès.
 * Priorité :
 *   1. un type français de facture (« France … Invoice … »)
 *   2. n'importe quel type dont le nom commence par « France »
 *   3. « Peppol BIS Billing UBL Invoice V3 »
 *   4. le premier disponible
 * @param {ReturnType<typeof parseDocumentTypes>} documentTypes
 */
export function chooseReferenceDocumentType(documentTypes) {
  if (!documentTypes?.length) return null;
  const startsWithFrance = documentTypes.filter((d) => /^France\b/i.test(d.niceName));
  return (
    startsWithFrance.find((d) => /invoice/i.test(d.niceName)) ||
    startsWithFrance[0] ||
    documentTypes.find((d) => d.niceName === 'Peppol BIS Billing UBL Invoice V3') ||
    documentTypes[0]
  );
}

/**
 * Certains SMP publient une date factice (ex. « 0001-01-01 ») : on l'ignore.
 * @param {string|undefined} value
 */
export function normalizeRegDate(value) {
  const m = /^(\d{4})-\d{2}-\d{2}/.exec(value || '');
  return m && Number(m[1]) >= 1990 ? value : null;
}

/**
 * Lit la Business Card (annuaire Peppol) : nom, adresse, statut, date d'inscription.
 * @param {Object|null|undefined} businessCard
 */
export function parseBusinessCard(businessCard) {
  const entity = businessCard?.entity?.[0];
  if (!entity) return null;

  const names = (entity.name || []).map((n) => n?.name).filter(Boolean);
  const additionalInfo = entity.additionalinfo || null;
  const websites = [entity.websiteuri].flat().filter(Boolean);

  return {
    companyName: names[0] || null,
    otherNames: names.slice(1),
    address: entity.geoinfo || null,
    countryCode: entity.countrycode || null,
    registrationDate: normalizeRegDate(entity.regdate),
    additionalInfo,
    status: additionalInfo ? STATUS_LABELS[additionalInfo] || additionalInfo : null,
    isActiveTaxpayer: additionalInfo === 'FR_ASSUJETTI_ACTIVE',
    website: websites[0] || null,
    entityCount: businessCard.entity.length,
  };
}

/**
 * @typedef {Object} NormalizedEndpoint
 * @property {string[]} processIds     process IDs (sans schéma) servis par ce point d'accès
 * @property {string|null} transportProfile
 * @property {string|null} endpointUrl
 * @property {string|null} serviceDescription
 * @property {string|null} technicalContact
 * @property {string|null} technicalInformationUrl
 * @property {string|null} activationDate
 * @property {string|null} expirationDate
 * @property {{ operator: string|null, popId: string|null, subject: string|null, issuer: string|null,
 *              serial: string|null, validFrom: string|null, validTo: string|null, validByDate: boolean|null }} certificate
 */

/**
 * Aplatit tous les endpoints de tous les processes d'une réponse /smpquery/{doctype}.
 * Chaque endpoint est associé au process qui le référence.
 * @param {Object} serviceMetadata réponse brute
 * @returns {NormalizedEndpoint[]}
 */
export function extractEndpoints(serviceMetadata) {
  const processes = serviceMetadata?.serviceinfo?.processes;
  if (!Array.isArray(processes)) return [];

  const out = [];
  for (const process of processes) {
    const processId = stripScheme(process?.processID);
    for (const ep of process?.endpoints || []) {
      const cert = ep.certificateDetails || {};
      out.push({
        processIds: processId ? [processId] : [],
        transportProfile: ep.transportProfile || null,
        endpointUrl: ep.endpointReference || null,
        serviceDescription: ep.serviceDescription || null,
        technicalContact: ep.technicalContactUrl || null,
        technicalInformationUrl: ep.technicalInformationUrl || null,
        activationDate: ep.serviceActivationDate || null,
        expirationDate: ep.serviceExpirationDate || null,
        certificate: {
          operator: cert.subject?.O || null,
          popId: cert.subject?.CN || null,
          subject: cert.subject?.name || null,
          issuer: cert.issuer?.name || null,
          // serial16 est une chaîne : serial10 dépasse la précision des nombres JS
          serial: cert.serial16 ? String(cert.serial16).toLowerCase() : null,
          validFrom: cert.notBefore || null,
          validTo: cert.notAfter || null,
          validByDate: typeof cert.validByDate === 'boolean' ? cert.validByDate : null,
        },
        // Conservé pour dédupliquer si le certificat n'a pas de numéro de série lisible
        _rawCertificate: ep.certificate || null,
      });
    }
  }
  return out;
}

/**
 * Déduplique les endpoints par numéro de série du certificat.
 * Les process IDs des doublons sont fusionnés dans l'entrée conservée (la première rencontrée).
 * À défaut de numéro de série, on se rabat sur le certificat brut puis sur l'URL.
 * @param {NormalizedEndpoint[]} endpoints
 * @returns {NormalizedEndpoint[]}
 */
export function dedupeByCertificate(endpoints) {
  const byKey = new Map();
  for (const ep of endpoints || []) {
    const key = ep.certificate?.serial || ep._rawCertificate || ep.endpointUrl || JSON.stringify(ep);
    const existing = byKey.get(key);
    if (existing) {
      for (const p of ep.processIds) {
        if (!existing.processIds.includes(p)) existing.processIds.push(p);
      }
    } else {
      byKey.set(key, { ...ep, processIds: [...ep.processIds], certificate: { ...ep.certificate } });
    }
  }
  return [...byKey.values()];
}

/**
 * Détecte l'inscription aux processus de la réforme française.
 * Attention : « non-regulated » contient « regulated », on compare donc strictement.
 * @param {string[]} processIds process IDs (avec ou sans schéma)
 */
export function detectFrenchReform(processIds) {
  const ids = new Set((processIds || []).map(stripScheme));
  return {
    regulated: ids.has(FR_PROCESS_REGULATED),
    nonRegulated: ids.has(FR_PROCESS_NON_REGULATED),
  };
}

/**
 * Indique si un certificat est valide à une date donnée.
 * Les dates Helger sont au format « 2028-03-03T23:59:59 » (UTC, sans fuseau).
 * @param {{ validFrom: string|null, validTo: string|null }} cert
 * @param {Date} [now]
 */
export function isCertificateValid(cert, now = new Date()) {
  const toDate = (s) => (s ? new Date(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`) : null);
  const from = toDate(cert?.validFrom);
  const to = toDate(cert?.validTo);
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return now >= from && now <= to;
}
