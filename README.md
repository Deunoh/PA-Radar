# PAradar

Outil interne de support technique : à partir d'un **SIRET** ou d'un **SIREN**, PAradar indique si une
entreprise française est inscrite sur le réseau **Peppol** et **par quelle plateforme agréée (PA)** elle
reçoit ses factures électroniques.

> Le point d'accès Peppol indique l'opérateur technique qui reçoit les factures du client. C'est
> généralement sa plateforme agréée, mais un sous-traitant est possible. **La source officielle reste
> l'annuaire du PPF.**

---

## Installation et lancement

Prérequis : **Node.js 22.9 ou plus récent** (version LTS 22 ou 24 recommandée, testé avec Node 24). Fonctionne sous Windows, macOS et Linux.

```bash
npm install
cp .env.example .env   # facultatif : les valeurs par défaut conviennent
```

Il existe deux façons de lancer l'outil :

| Usage                                    | Commandes                           | Adresse de l'interface  |
| ---------------------------------------- | ----------------------------------- | ----------------------- |
| **Utilisation au quotidien**             | `npm run build` (une fois) puis `npm start` | <http://localhost:3001> |
| **Développement** (modifier le code)     | `npm run dev`                       | <http://localhost:5173> |

> En mode développement, l'API tourne aussi sur le port 3001, mais l'interface est servie par Vite sur
> le port 5173 (qui redirige `/api` vers l'API). Ouvrir <http://localhost:3001> redirige vers le 5173.
> Après une modification du code, refaites `npm run build` pour mettre à jour la version servie par `npm start`.

### Autres commandes

| Commande             | Rôle                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| `npm run dev`        | Lance le front (Vite) et l'API (Express) ensemble, avec rechargement  |
| `npm test`           | Lance les tests (vitest)                                              |
| `npm run build`      | Compile le front dans `dist/`                                         |
| `npm start`          | Lance l'API en production ; elle sert aussi le front compilé (`dist/`) |

### Variables d'environnement (`.env`)

| Variable                 | Défaut                           | Rôle                                                  |
| ------------------------ | -------------------------------- | ----------------------------------------------------- |
| `PORT`                   | `3001`                           | Port de l'API                                         |
| `DEFAULT_SML`            | `peppolprod`                     | Réseau Peppol par défaut (`peppolprod` / `peppoltest`) |
| `CACHE_TTL_MINUTES`      | `15`                             | Durée du cache des recherches                         |
| `RATE_LIMIT_PER_MINUTE`  | `30`                             | Recherches unitaires autorisées par minute et par IP  |
| `EXTERNAL_TIMEOUT_MS`    | `10000`                          | Délai maximum d'un appel à l'API externe              |
| `HELGER_API_BASE`        | `https://peppol.helger.com/api`  | URL de l'API Peppol utilisée                          |
| `DIRECTORY_URL_PROD`     | `https://directory.peppol.eu`    | Annuaire Peppol (réseau de production)                |
| `DIRECTORY_URL_TEST`     | `https://test-directory.peppol.eu` | Annuaire Peppol (réseau de test)                    |
| `HELGER_MIN_INTERVAL_MS` | `1200`                           | Espacement minimal entre deux appels à l'API Helger   |
| `TRUST_PROXY`            | `loopback`                       | Proxys de confiance pour l'IP du client, si Express tourne derrière un proxy |

### Déploiement sur Cloudflare Workers

En ligne, PAradar tourne sur Cloudflare Workers (offre gratuite, sans carte bancaire ni mise en veille).
Le front compilé (`dist/`) est servi directement par Cloudflare ; les routes `/api` passent par
`src/worker/index.js`, qui réutilise la même logique que le serveur Express (`src/server/api.js`).
La configuration est dans `wrangler.jsonc`.

```bash
npx wrangler login     # une fois : connexion au compte Cloudflare dans le navigateur
npm run deploy         # compile le front puis publie sur https://paradar.<compte>.workers.dev
npm run preview        # essai local avec le moteur de Cloudflare (http://localhost:8787)
```

Les variables d'environnement ci-dessus peuvent être définies dans le tableau de bord Cloudflare
(Worker → Settings → Variables). Le cache et la limite de recherches restent en mémoire : Cloudflare
pouvant faire tourner plusieurs copies du Worker, ils ne sont pas partagés entre elles.

---

## Utilisation

### Recherche unitaire

1. Saisissez un SIRET ou un SIREN. La saisie est formatée automatiquement (`750 620 585 00018`) et validée
   en direct (longueur et clé de Luhn). Le raccourci **⌘K / Ctrl+K** place le curseur dans le champ.
2. Appuyez sur **Entrée**.
3. La carte résultat affiche :
   - le nom et l'adresse de l'entreprise (Business Card de l'annuaire Peppol) ;
   - **la plateforme agréée** : nom de l'exploitant (`O=`) du certificat du point d'accès ;
   - des badges : inscrit sur Peppol, inscrit réforme FR, assujetti actif, certificat valide ou expiré ;
   - le détail technique, chaque valeur avec un bouton copier ;
   - les documents acceptés, les identifiants testés et le JSON brut, dans des sections repliables ;
   - le bouton **« Copier le résumé pour un ticket »**, par exemple :

     ```
     SIRET 75062058500018 – EARL BISONS D'AUVERGNE
     Peppol : oui (0225:750620585) – Réforme FR : oui
     PA : Cecurity.com SA (POP000717) – Point d'accès marque blanche hébergé chez Tickstar
     Vérifié le 25/09/2026 via SMP Peppol
     ```

Les 10 dernières recherches sont gardées dans le navigateur (localStorage). Le bouton ⟳ de la carte relance
la recherche sans passer par le cache.

### Recherche en lot

Collez une liste d'identifiants : un par ligne, ou séparés par virgule, point-virgule ou espace. Vous pouvez
aussi importer un CSV : tous les SIREN et SIRET qu'il contient sont extraits. Les recherches sont faites une
par une depuis le navigateur, avec une pause d'une seconde entre chaque, et la progression s'affiche en
temps réel. Si la limite de recherches par minute est atteinte, le lot attend puis reprend tout seul.
Un lot compte au maximum 500 identifiants.
Le tableau se trie et se filtre par PA. L'export CSV utilise le point-virgule et l'UTF-8 avec BOM, pour
qu'Excel l'ouvre directement. Un clic sur une ligne ouvre la fiche détaillée.

### Réseau de test

Le menu ⚙ de l'en-tête bascule entre le SML de production (`peppolprod`) et celui de test (`peppoltest`).

---

## Fonctionnement

```
Navigateur ──► /api/lookup ──► LookupService ──► source « helger » ──► peppol.helger.com ──► SML / SMP
```

1. **Nettoyage et validation** : suppression des espaces, points et tirets, puis contrôle de la longueur
   (9 ou 14 chiffres) et de la clé de Luhn. Les SIRET de La Poste suivent une règle spécifique.
2. **Candidats construits**, par ordre de priorité : `0225:{SIREN}_{SIRET}` (réforme FR, maille
   établissement, si un SIRET a été saisi), `0225:{SIREN}` (réforme FR, maille SIREN), `0002:{SIREN}`,
   puis `0009:{SIRET}` si un SIRET a été saisi.
3. **Existence** de chaque candidat construit (`/ppidexistence`), qui donne aussi l'adresse du SMP.
   **En parallèle**, le SIREN est recherché dans l'**annuaire Peppol** (`directory.peppol.eu`, API de
   recherche publique). La réforme française autorise plusieurs « mailles » d'adressage
   (`SIREN`, `SIREN_SIRET`, `SIREN_SIRET_codeRoutage`, `SIREN_codeRoutage`) : une entreprise peut être
   inscrite uniquement au niveau d'un établissement ou de codes de routage, qu'on ne peut pas deviner.
   Les inscriptions découvertes sont ajoutées aux candidats (celles du SIRET saisi en premier), puis
   confirmées auprès du SML. Si l'annuaire est injoignable, la recherche continue sans lui.
4. Pour chaque candidat existant (les **3 premiers** au maximum : un grand compte peut avoir des dizaines
   de codes de routage, tous listés dans « Identifiants testés ») :
   - lecture des **types de documents** et de la **Business Card** (`/smpquery?businessCard=true`) ;
   - choix d'un **type de document de référence** : une facture « France … » en priorité, sinon un autre
     type « France … », sinon « Peppol BIS Billing UBL Invoice V3 », sinon le premier disponible ;
   - lecture du **point d'accès** pour ce type (`/smpquery/{doctype}`), avec dédoublonnage des endpoints
     par numéro de série du certificat ;
   - détection des processus `urn:peppol:france:billing:regulated` / `non-regulated`, qui donnent
     l'indicateur « réforme FR » ;
   - si la description du service mentionne « Whitelabel » ou « white label », déduction de
     l'**hébergeur technique** d'après les domaines de l'endpoint et du SMP (ex. `galaxygw.com` ou
     `tickstar.com` → Tickstar).

### Robustesse

- Timeout de 10 s par appel externe.
- Cache mémoire de 15 min par identifiant et par SML. Deux recherches identiques simultanées ne font
  qu'un seul appel.
- Limite de 30 recherches unitaires par minute.
- **L'API Helger est limitée à environ 1 requête par seconde** et renvoie HTTP 429 au-delà. Tous les appels
  passent donc par une file qui les espace de 1,2 s. Un 429 suspend la file pendant la durée `Retry-After`,
  puis l'appel est réessayé (2 fois au maximum). Une recherche complète prend donc **environ 5 s**
  (3 ou 4 existences + 2 lectures SMP ; la recherche dans l'annuaire Peppol se fait en parallèle).
- Messages d'erreur distincts : identifiant invalide, non trouvé sur Peppol, API Peppol indisponible,
  API Peppol saturée, SMP qui ne répond pas, limite locale atteinte.

### API

| Route                                    | Description                                                  |
| ---------------------------------------- | ------------------------------------------------------------ |
| `GET /api/lookup?id=…&sml=…&refresh=1`   | Recherche unitaire (JSON normalisé + réponses brutes)        |
| `GET /api/lookup?id=…&raw=0`             | Idem sans les réponses brutes (utilisé par la recherche en lot) |
| `GET /api/config`                        | Configuration utile au front                                 |

---

## Organisation du code

```
src/shared/                     code partagé front/back (identifiants, résumé pour ticket, ligne de lot)
src/worker/index.js             point d'entrée Cloudflare Workers (en ligne)
src/server/
  index.js                      serveur Express (en local)
  api.js                        logique des routes /api, commune à Express et au Worker
  config.js · errors.js         configuration, erreurs typées
  services/                     orchestration, cache, construction du résultat, hébergeur
  parsing/helgerParser.js       lecture des JSON de l'API Helger (fonctions pures)
  sources/
    baseSource.js               interface commune des sources
    helgerSource.js             source actuelle (peppol.helger.com)
    directPeppolSource.js       à implémenter : DNS SML + appel direct du SMP
    ppfSource.js                à implémenter : annuaire PPF via l'API PISTE (OAuth2)
src/client/                     interface React + Tailwind
tests/                          tests vitest, fixtures = réponses réelles de l'API
```

### Ajouter une source

Une source étend `PeppolSource` (`src/server/sources/baseSource.js`) et implémente `checkExistence`,
`getServiceGroup` et `getServiceMetadata` en renvoyant les formes normalisées décrites dans ce fichier. Elle
s'enregistre ensuite dans `src/server/sources/index.js`. Deux squelettes documentés sont prêts :

- **Lookup Peppol direct** : résolution DNS NAPTR sur le SML, puis appel direct du SMP (XML), pour ne plus
  dépendre de peppol.helger.com et de sa limite de débit.
- **Annuaire PPF** (API PISTE) : OAuth2 « client credentials », avec des identifiants à fournir en variables
  d'environnement (`PISTE_CLIENT_ID`, `PISTE_CLIENT_SECRET`…, voir `.env.example`).

---

## Tests

```bash
npm test
```

Les tests couvrent :

- la validation SIREN / SIRET (clé de Luhn, messages d'erreur, exception La Poste) ;
- la construction des identifiants Peppol et le découpage des listes collées ;
- le parsing des réponses, sur les **réponses réelles** enregistrées pour `0225:750620585`
  (EARL BISONS D'AUVERGNE, Cecurity / POP000717, hébergé chez Tickstar) ;
- le dédoublonnage des certificats, la détection de la réforme FR et de l'hébergeur en marque blanche ;
- le résumé pour ticket, la gestion des 429 et des timeouts, et le service de
  recherche de bout en bout (source simulée, cache compris).

---

## Limites de l'outil

- **Ce n'est pas une source officielle.** Le résultat est déduit du certificat du point d'accès Peppol :
  il désigne l'**opérateur technique** qui reçoit les factures. C'est généralement la plateforme agréée,
  mais ce peut être un sous-traitant ou un point d'accès en marque blanche. En cas de doute, l'annuaire du
  PPF fait foi.
- **Peppol uniquement.** Une entreprise dont la PA n'utilise pas Peppol, ou qui n'est pas encore inscrite,
  apparaît « non trouvée » alors qu'elle peut recevoir des factures électroniques.
- **Dépendance à peppol.helger.com**, un service public tiers, gratuit, sans garantie de disponibilité et
  limité en débit (environ 1 requête/s). Les recherches en lot sont donc lentes (environ 6 s par identifiant
  hors cache).
- **Un seul type de document interrogé** (le type de référence). Un participant qui utilise des points
  d'accès différents selon le type de document n'est vu qu'à travers celui-ci.
- **Business Card facultative** : certains SMP ne publient ni nom ni adresse, ou publient des données de
  test (nom générique, date factice).
- **Déduction de l'hébergeur** : elle repose sur une liste de domaines connus (`hostDetection.js`), à
  compléter au besoin.
- Le cache et la limite de débit sont **en mémoire** : ils sont remis à zéro au redémarrage et ne sont pas
  partagés entre plusieurs instances (ni entre les copies du Worker Cloudflare).
