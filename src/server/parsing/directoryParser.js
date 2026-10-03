/**
 * Lecture des réponses de l'annuaire Peppol (Peppol Directory, directory.peppol.eu).
 *
 * GET /search/1.0/json?q={SIREN}&rpc=100 → {
 *   "total-result-count": 1,
 *   "matches": [{
 *     "participantID": { "scheme": "iso6523-actorid-upis", "value": "0225:923409346_92340934600049" },
 *     "docTypes": [{ "scheme": "busdox-docid-qns", "value": "…" }],
 *     "entities": [{ "name": [{ "name": "MYGESPRO", "language": "fr" }], "countryCode": "FR",
 *                    "geoInfo": "…", "additionalInfo": "FR_ASSUJETTI_ACTIVE", "regDate": "2026-09-16" }]
 *   }]
 * }
 *
 * La recherche est plein texte : on ne garde que les participants dont l'identifiant
 * correspond réellement au SIREN recherché.
 */
import { PARTICIPANT_SCHEME, buildParticipantId, describeFrenchAddressing } from '../../shared/identifiers.js';

/**
 * Indique si un identifiant de participant (sans préfixe de schéma) appartient au SIREN.
 * @param {string} shortId ex. "0225:923409346_92340934600049"
 * @param {string} siren
 */
export function participantBelongsToSiren(shortId, siren) {
  const [scheme, value = ''] = String(shortId).split(/:(.*)/s);
  if (scheme === '0225') return value === siren || value.startsWith(`${siren}_`);
  if (scheme === '0002') return value === siren;
  if (scheme === '0009') return new RegExp(`^${siren}\\d{5}$`).test(value);
  return false;
}

/**
 * Libellé lisible d'un identifiant découvert.
 * @param {string} scheme
 * @param {string} value
 */
export function labelForParticipant(scheme, value) {
  if (scheme === '0225') {
    const { label } = describeFrenchAddressing(value);
    return `Réforme FR · ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
  }
  if (scheme === '0002') return 'SIRENE (SIREN)';
  if (scheme === '0009') return 'SIRET';
  return scheme;
}

/**
 * Extrait les participants d'un SIREN depuis une réponse de recherche de l'annuaire.
 * @param {Object} json réponse brute
 * @param {string} siren
 * @returns {Array<{ scheme: string, value: string, shortId: string, participantId: string, label: string,
 *                   name: string|null, address: string|null, registrationDate: string|null, documentTypeCount: number }>}
 */
export function parseDirectorySearch(json, siren) {
  const out = [];
  for (const match of json?.matches || []) {
    const pid = match?.participantID;
    if (!pid || pid.scheme !== PARTICIPANT_SCHEME || !participantBelongsToSiren(pid.value, siren)) continue;
    const [scheme, value] = pid.value.split(/:(.*)/s);
    const entity = match.entities?.[0];
    out.push({
      scheme,
      value,
      shortId: pid.value,
      participantId: buildParticipantId(scheme, value),
      label: labelForParticipant(scheme, value),
      name: entity?.name?.[0]?.name || null,
      address: entity?.geoInfo || null,
      registrationDate: entity?.regDate || null,
      documentTypeCount: match.docTypes?.length || 0,
    });
  }
  return out;
}
