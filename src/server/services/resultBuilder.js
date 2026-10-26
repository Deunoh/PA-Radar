/**
 * Construction du résultat normalisé renvoyé au front, à partir des données
 * (déjà normalisées) d'une source. Fonctions pures, testées sur les données réelles.
 */
import {
  dedupeByCertificate,
  detectFrenchReform,
  isCertificateValid,
} from '../parsing/helgerParser.js';
import { detectTechnicalHost } from './hostDetection.js';
import { describeFrenchAddressing } from '../../shared/identifiers.js';

/**
 * Choisit le point d'accès principal parmi les endpoints dédupliqués :
 * en priorité celui qui sert le processus français « regulated », sinon le premier AS4, sinon le premier.
 * @param {import('../parsing/helgerParser.js').NormalizedEndpoint[]} endpoints
 */
export function pickPrimaryEndpoint(endpoints) {
  if (!endpoints?.length) return null;
  return (
    endpoints.find((e) => e.processIds.includes('urn:peppol:france:billing:regulated')) ||
    endpoints.find((e) => /as4/i.test(e.transportProfile || '')) ||
    endpoints[0]
  );
}

/**
 * Construit l'objet `result`.
 *
 * @param {Object} input
 * @param {{ shortId: string, participantId: string, scheme: string, value?: string, origin?: string }} input.candidate
 * @param {string|null} input.smpHostUri
 * @param {{ documentTypes: any[], businessCard: any }} input.serviceGroup
 * @param {{ documentTypeID: string, niceName: string } | null} input.referenceDocumentType
 * @param {import('../parsing/helgerParser.js').NormalizedEndpoint[]} input.endpoints endpoints bruts (non dédupliqués)
 * @param {Date} [input.now]
 */
export function buildResult({ candidate, smpHostUri, serviceGroup, referenceDocumentType, endpoints, now = new Date() }) {
  const bc = serviceGroup?.businessCard || null;
  const accessPoints = dedupeByCertificate(endpoints || []);
  const primary = pickPrimaryEndpoint(accessPoints);
  const allProcessIds = [...new Set(accessPoints.flatMap((e) => e.processIds))];
  const host = detectTechnicalHost({
    serviceDescription: primary?.serviceDescription,
    endpointUrl: primary?.endpointUrl,
    smpHostUri,
  });

  const cert = primary?.certificate || {};
  const computedValidity = isCertificateValid(cert, now);

  return {
    participantId: candidate.participantId,
    participantShortId: candidate.shortId,
    scheme: candidate.scheme,
    // Maille d'adressage de la réforme FR (SIREN, établissement, code de routage)
    addressing: candidate.scheme === '0225' && candidate.value ? describeFrenchAddressing(candidate.value) : null,
    foundVia: candidate.origin === 'directory' ? 'directory' : 'identifier',

    companyName: bc?.companyName || null,
    address: bc?.address || null,
    countryCode: bc?.countryCode || null,
    registrationDate: bc?.registrationDate || null,
    status: bc?.status || null,
    additionalInfo: bc?.additionalInfo || null,
    isActiveTaxpayer: Boolean(bc?.isActiveTaxpayer),
    hasBusinessCard: Boolean(bc),

    pa: {
      name: cert.operator || null,
      popId: cert.popId || null,
      operator: cert.operator || null,
    },

    technicalHost: host.name,
    whiteLabel: host.whiteLabel,
    endpointHost: host.endpointHost,
    smpHost: host.smpHost,
    smpHostUri: smpHostUri || null,
    endpointUrl: primary?.endpointUrl || null,
    transportProfile: primary?.transportProfile || null,
    serviceDescription: primary?.serviceDescription || null,
    technicalContact: primary?.technicalContact || null,
    website: bc?.website || primary?.technicalInformationUrl || null,
    serviceActivationDate: primary?.activationDate || null,

    certificate: {
      validFrom: cert.validFrom || null,
      validTo: cert.validTo || null,
      isValid: computedValidity ?? cert.validByDate ?? null,
      serial: cert.serial || null,
      issuer: cert.issuer || null,
      subject: cert.subject || null,
    },

    frenchReform: detectFrenchReform(allProcessIds),
    processes: allProcessIds,
    referenceDocumentType: referenceDocumentType?.niceName || null,

    documentTypes: (serviceGroup?.documentTypes || []).map((d) => ({
      niceName: d.niceName,
      isFrench: d.isFrench,
      documentTypeID: d.documentTypeID,
    })),

    // Tous les points d'accès distincts (normalement un seul)
    accessPoints: accessPoints.map((e) => ({
      popId: e.certificate.popId,
      operator: e.certificate.operator,
      endpointUrl: e.endpointUrl,
      serviceDescription: e.serviceDescription,
      processes: e.processIds,
      serial: e.certificate.serial,
    })),
  };
}
