/**
 * Interface commune des sources de données Peppol.
 *
 * Une source sait répondre à trois questions, en renvoyant des données NORMALISÉES
 * (formes produites par ../parsing/helgerParser.js), pour que le service de recherche
 * soit indépendant de l'origine des données :
 *
 *   1. checkExistence(participantId, { sml })
 *        → { exists: boolean, smpHostUri: string|null, raw: any }
 *   2. getServiceGroup(participantId, { sml })
 *        → { documentTypes: Array<{ documentTypeID, niceName, isFrench, isDeprecated }>,
 *            businessCard: ReturnType<parseBusinessCard> | null, raw: any }
 *   3. getServiceMetadata(participantId, documentTypeId, { sml })
 *        → { endpoints: NormalizedEndpoint[], raw: any }
 *   4. searchDirectory(siren, { sml })  — facultatif
 *        → { participants: [{ scheme, value, shortId, participantId, label, name, … }], total, raw }
 *        Découvre les inscriptions impossibles à deviner (établissements, codes de routage).
 *        Une source qui ne sait pas le faire renvoie null.
 *
 * Erreurs : lever un LookupError (../errors.js) avec le code approprié
 * (API_UNAVAILABLE, UPSTREAM_RATE_LIMITED, SMP_UNREACHABLE…).
 *
 * Sources prévues :
 *   - helger        : API REST peppol.helger.com (implémentée)
 *   - directPeppol  : requête DNS NAPTR sur le SML + appel direct du SMP (à venir)
 *   - ppf           : annuaire du Portail Public de Facturation via l'API PISTE (à venir).
 *                     Cette source pourra aussi exposer getDirectoryEntry(siren) qui renvoie
 *                     directement la plateforme agréée déclarée à l'annuaire.
 */
import { LookupError } from '../errors.js';

export class PeppolSource {
  /** Identifiant technique de la source (ex. "helger") */
  id = 'base';
  /** Libellé lisible (affiché dans la réponse et l'interface) */
  label = 'Source abstraite';

  /** Indique si la source est utilisable (ex. identifiants configurés). */
  isAvailable() {
    return false;
  }

  // eslint-disable-next-line no-unused-vars
  async checkExistence(participantId, options) {
    throw notImplemented(this, 'checkExistence');
  }

  // eslint-disable-next-line no-unused-vars
  async getServiceGroup(participantId, options) {
    throw notImplemented(this, 'getServiceGroup');
  }

  // eslint-disable-next-line no-unused-vars
  async getServiceMetadata(participantId, documentTypeId, options) {
    throw notImplemented(this, 'getServiceMetadata');
  }

  /** Facultatif : null signifie « recherche dans l'annuaire non disponible pour cette source ». */
  // eslint-disable-next-line no-unused-vars
  async searchDirectory(siren, options) {
    return null;
  }
}

export function notImplemented(source, method) {
  return new LookupError('NOT_IMPLEMENTED', `La source « ${source.label} » n'implémente pas encore ${method}()`);
}
