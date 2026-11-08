/**
 * Traduit les réponses XML d'un SMP Peppol dans le format JSON de l'API peppol.helger.com.
 *
 * Ainsi la source « Peppol direct » réutilise helgerParser.js sans changement, et la vue JSON
 * brute de l'interface garde la même structure quelle que soit la source.
 * Formats vérifiés sur de vraies réponses (tests/fixtures/direct/) comparées à celles de Helger :
 *  - ServiceGroup          → { smptype, participantID, urls: [{ href, documentTypeID, niceName, state, isDeprecated }] }
 *  - BusinessCard          → { participant, entity: [{ name, countrycode, geoinfo, additionalinfo, regdate, … }] }
 *  - SignedServiceMetadata → { smptype, participantID, documentTypeID, serviceinfo: { processes, extension } }
 * Les espaces de noms Peppol (busdox) et OASIS SMP 1.0 ont les mêmes noms locaux, à EndpointURI près.
 */
import { parseXml, child, childrenNamed, childText, find } from './xml.js';
import { parseCertificate } from './x509.js';
import { DOCUMENT_TYPES } from './peppolDocumentTypes.js';

const DOCUMENT_TYPES_LOWER = new Map(Object.entries(DOCUMENT_TYPES).map(([id, v]) => [id.toLowerCase(), v]));

/** Identifiant XML (<X scheme="s">valeur</X>) → « s::valeur ». */
const identifier = (el) => {
  if (!el) return null;
  const value = el.text.trim();
  return el.attrs.scheme ? `${el.attrs.scheme}::${value}` : value;
};

/**
 * Dates SMP → format Helger : l'heure est gardée telle qu'écrite par le SMP et le fuseau est retiré.
 * « 2026-09-01T00:00:00+02:00 » → « 2026-09-01T00:00:00 ». Les fractions de seconde suivent Java
 * (3, 6 ou 9 chiffres, rien si elles sont nulles) : « .000 » disparaît, « .607 » et « .988194 » restent.
 * Règles vérifiées par scripts/compare-sources.mjs.
 */
export function toHelgerDate(value) {
  if (!value) return null;
  const local = value.trim().replace(/(Z|[+-]\d\d:?\d\d)$/i, '');
  return local.replace(/\.(\d+)$/, (m, digits) => {
    const nanos = digits.slice(0, 9).padEnd(9, '0');
    if (/^0+$/.test(nanos)) return '';
    if (nanos.endsWith('000000')) return `.${nanos.slice(0, 3)}`;
    if (nanos.endsWith('000')) return `.${nanos.slice(0, 6)}`;
    return `.${nanos}`;
  });
}

const lookupDocumentType = (id) => DOCUMENT_TYPES[id] || DOCUMENT_TYPES_LOWER.get(id.toLowerCase());

const WILDCARD_SCHEME = 'peppol-doctype-wildcard::';

/**
 * Nom lisible et état d'un type de document, d'après la liste de codes officielle.
 * Types PINT (schéma peppol-doctype-wildcard) : comme Helger, le nom précise « (PINT exact match) », ou
 * « (PINT wildcard match) » quand l'identifiant se termine par « * » (on le retire pour trouver le type).
 * @param {string} documentTypeID identifiant avec son schéma (« busdox-docid-qns::… »)
 */
export function describeDocumentType(documentTypeID) {
  let entry = lookupDocumentType(documentTypeID);
  let suffix = '';
  if (documentTypeID.startsWith(WILDCARD_SCHEME)) {
    if (entry) suffix = ' (PINT exact match)';
    else if (documentTypeID.includes('*')) {
      entry = lookupDocumentType(documentTypeID.replace(/\*/g, ''));
      suffix = ' (PINT wildcard match)';
    }
  }
  if (!entry) return { state: null, isDeprecated: false };
  const [niceName, deprecated] = entry;
  return { niceName: niceName + suffix, state: deprecated ? 'dep' : 'act', isDeprecated: Boolean(deprecated) };
}

/**
 * ServiceGroup : liste des types de documents acceptés.
 * Comme Helger, la liste est triée par identifiant (l'ordre compte pour chooseReferenceDocumentType).
 * @param {string} xml
 */
export function parseServiceGroupXml(xml) {
  const root = parseXml(xml);
  if (root.name !== 'ServiceGroup') throw new Error(`Réponse SMP inattendue : <${root.name}> au lieu de <ServiceGroup>`);
  const refs = childrenNamed(child(root, 'ServiceMetadataReferenceCollection'), 'ServiceMetadataReference');
  const urls = refs
    .map((ref) => {
      const href = ref.attrs.href;
      const idx = href?.indexOf('/services/') ?? -1;
      if (idx < 0) return null;
      let documentTypeID;
      try {
        documentTypeID = decodeURIComponent(href.slice(idx + '/services/'.length));
      } catch {
        return null;
      }
      return { href, documentTypeID, ...describeDocumentType(documentTypeID) };
    })
    .filter(Boolean)
    .sort((a, b) => (a.documentTypeID < b.documentTypeID ? -1 : a.documentTypeID > b.documentTypeID ? 1 : 0));
  return { smptype: 'peppol', participantID: identifier(child(root, 'ParticipantIdentifier')), urls };
}

/**
 * Business Card publiée par le SMP (GET {smp}/businesscard/{participant}).
 * @param {string} xml
 */
export function parseBusinessCardXml(xml) {
  const root = parseXml(xml);
  if (root.name !== 'BusinessCard') throw new Error(`Réponse SMP inattendue : <${root.name}> au lieu de <BusinessCard>`);
  const participant = child(root, 'ParticipantIdentifier');
  const list = (items) => (items.length ? items : undefined);
  return {
    participant: participant ? { scheme: participant.attrs.scheme ?? null, value: participant.text } : null,
    entity: childrenNamed(root, 'BusinessEntity').map((e) => {
      const entity = {
        name: childrenNamed(e, 'Name').map((n) => ({ name: n.text, language: n.attrs.language ?? null })),
        countrycode: childText(e, 'CountryCode'),
        geoinfo: childText(e, 'GeographicalInformation') ?? undefined,
        identifier: list(childrenNamed(e, 'Identifier').map((i) => ({ scheme: i.attrs.scheme ?? null, value: i.text }))),
        websiteuri: list(childrenNamed(e, 'WebsiteURI').map((w) => w.text).filter(Boolean)),
        contact: list(
          childrenNamed(e, 'Contact').map((c) => ({
            type: c.attrs.TypeCode ?? null,
            name: c.attrs.Name ?? null,
            phonenumber: c.attrs.PhoneNumber ?? null,
            email: c.attrs.Email ?? null,
          })),
        ),
        additionalinfo: childText(e, 'AdditionalInformation') ?? undefined,
        regdate: e.attrs.registrationDate ?? undefined,
      };
      // Champs absents omis, comme dans les réponses Helger
      return Object.fromEntries(Object.entries(entity).filter(([, v]) => v !== undefined));
    }),
  };
}

/**
 * SignedServiceMetadata : points d'accès et certificats pour un type de document.
 * Renvoie { redirect } si le SMP redirige vers un autre SMP.
 * @param {string} xml
 * @param {Date} [now] date de référence pour la validité des certificats
 */
export function parseServiceMetadataXml(xml, now = new Date()) {
  const root = parseXml(xml);
  const metadata = root.name === 'ServiceMetadata' ? root : child(root, 'ServiceMetadata');
  if (!metadata) throw new Error(`Réponse SMP inattendue : <${root.name}> au lieu de <SignedServiceMetadata>`);

  const redirect = child(metadata, 'Redirect');
  if (redirect) return { redirect: redirect.attrs.href };

  const info = child(metadata, 'ServiceInformation');
  const processes = childrenNamed(child(info, 'ProcessList'), 'Process').map((p) => ({
    processID: identifier(child(p, 'ProcessIdentifier')),
    endpoints: childrenNamed(child(p, 'ServiceEndpointList'), 'Endpoint').map((ep) => {
      // Texte d'origine conservé (retours à la ligne compris), comme Helger
      const certificate = childText(ep, 'Certificate');
      const signature = childText(ep, 'RequireBusinessLevelSignature');
      return {
        transportProfile: ep.attrs.transportProfile ?? null,
        endpointReference: childText(child(ep, 'EndpointReference'), 'Address') ?? childText(ep, 'EndpointURI'),
        requireBusinessLevelSignature: signature === null ? null : signature === 'true',
        minimumAuthenticationLevel: childText(ep, 'MinimumAuthenticationLevel'),
        serviceActivationDate: toHelgerDate(childText(ep, 'ServiceActivationDate')),
        serviceExpirationDate: toHelgerDate(childText(ep, 'ServiceExpirationDate')),
        certificate,
        certificateDetails: certificate ? parseCertificate(certificate, now) : null,
        serviceDescription: childText(ep, 'ServiceDescription'),
        technicalContactUrl: childText(ep, 'TechnicalContactUrl'),
        technicalInformationUrl: childText(ep, 'TechnicalInformationUrl'),
        extension: null,
      };
    }),
  }));

  return {
    smptype: 'peppol',
    participantID: identifier(find(info, 'ParticipantIdentifier')),
    documentTypeID: identifier(find(info, 'DocumentIdentifier')),
    serviceinfo: { processes, extension: null },
  };
}
