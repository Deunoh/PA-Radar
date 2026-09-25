/**
 * Source « lookup Peppol direct » — NON IMPLÉMENTÉE.
 *
 * Objectif : ne plus dépendre de peppol.helger.com en interrogeant directement l'infrastructure :
 *  1. Construire le nom DNS du participant (Peppol Policy for use of identifiers, NAPTR) :
 *       base32(sha256(valeur en minuscules, ex. "0225:750620585")) sans "=" final
 *       + ".iso6523-actorid-upis" + ".edelivery.tech.ec.europa.eu" (SML de production)
 *       ou ".acc.edelivery.tech.ec.europa.eu" (SML de test).
 *  2. Résolution DNS NAPTR (node:dns/promises → resolveNaptr) pour obtenir l'URL du SMP.
 *     Aucun enregistrement → le participant n'existe pas.
 *  3. GET {smp}/{participantId} (XML ServiceGroup) → types de documents.
 *     GET {smp}/{participantId}/services/{documentTypeId} (XML SignedServiceMetadata)
 *     → endpoints + certificat X.509 à décoder (node:crypto X509Certificate).
 *  4. Business Card : GET {smp}/businesscard/{participantId} si le SMP la publie.
 *  5. Produire les mêmes formes normalisées que helgerParser.js.
 */
import { PeppolSource } from './baseSource.js';

export class DirectPeppolSource extends PeppolSource {
  id = 'direct';
  label = 'Lookup Peppol direct (SML + SMP)';

  isAvailable() {
    return false;
  }
}
