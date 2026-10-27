/**
 * Source « lookup Peppol direct » — NON IMPLÉMENTÉE.
 *
 * Objectif : ne plus dépendre de peppol.helger.com en interrogeant directement l'infrastructure Peppol.
 * Notes complètes et vérifiées (domaines, formats XML, champs à conserver) : docs/source-peppol-directe.md
 *
 *  1. Nom DNS du participant : base32(sha256(valeur en minuscules, ex. "0225:750620585")) sans "=" final
 *       + ".iso6523-actorid-upis." + "participant.sml.prod.tech.peppol.org" (production)
 *       ou "participant.sml.test.tech.peppol.org" (test).
 *     L'ancien domaine de la Commission européenne (edelivery.tech.ec.europa.eu) ne répond plus depuis 2026.
 *  2. Requête NAPTR (via DNS-over-HTTPS sur Cloudflare Workers) → URL du SMP.
 *     NXDOMAIN → le participant n'existe pas.
 *  3. GET {smp}/{participantId} (XML ServiceGroup) → types de documents.
 *     GET {smp}/{participantId}/services/{documentTypeId} (XML SignedServiceMetadata)
 *     → endpoints + certificat X.509 à décoder.
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
