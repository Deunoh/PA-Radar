/**
 * Source « annuaire PPF » (Portail Public de Facturation) via l'API PISTE — NON IMPLÉMENTÉE.
 *
 * Pistes pour l'implémentation :
 *  - Authentification OAuth2 « client credentials » sur PISTE_TOKEN_URL avec
 *    PISTE_CLIENT_ID / PISTE_CLIENT_SECRET (variables d'environnement), jeton mis en cache
 *    jusqu'à son expiration.
 *  - Interroger l'annuaire par SIREN / SIRET pour obtenir la plateforme agréée déclarée
 *    (source officielle, contrairement à la déduction via le certificat Peppol).
 *  - Exposer une méthode supplémentaire getDirectoryEntry(siren) et adapter lookupService
 *    pour fusionner son résultat avec celui de la source Peppol.
 */
import { PeppolSource } from './baseSource.js';

export class PpfSource extends PeppolSource {
  id = 'ppf';
  label = 'Annuaire PPF (API PISTE)';

  isAvailable() {
    // Deviendra vrai quand l'implémentation existera et que les identifiants seront fournis
    return false;
  }
}
