# Source « Peppol direct » : notes de préparation

Notes réunies le 27/10/2026, le jour où peppol.helger.com est tombé (404 puis 503 sur tout le site,
page d'accueil comprise). Elles servent à écrire `src/server/sources/directPeppolSource.js` sans repartir
de zéro. **Tout ce qui est marqué « vérifié » a été testé en direct ce jour-là.**

Contrainte posée par l'utilisateur : **ne perdre aucune fonctionnalité ni aucune information** affichée
aujourd'hui. La section 2 liste tout ce que Helger fournit, champ par champ, comme liste de contrôle.

## 1. Principe

peppol.helger.com n'est pas un service officiel : c'est le site de Philip Helger, développeur de
nombreux logiciels libres de Peppol. Il fait pour nous deux étapes que l'on peut faire nous-mêmes,
sans clé ni inscription :

1. **SML** (registre central de Peppol) : une requête DNS dit si le participant existe et quel SMP
   gère sa fiche.
2. **SMP** (serveur de l'opérateur du participant) : une API REST standard renvoie, en XML, les types
   de documents acceptés, la Business Card et, pour chaque type, le point d'accès et son certificat.

L'annuaire Peppol (directory.peppol.eu), lui, ne dépend pas de Helger et continuait de répondre
pendant la panne. `searchDirectory()` peut être repris tel quel.

## 2. Ce que Helger fournit aujourd'hui (à garder à l'identique)

Les formes normalisées sont décrites dans `src/server/sources/baseSource.js` et produites par
`src/server/parsing/helgerParser.js`. La nouvelle source doit produire **exactement les mêmes**.
Exemples de réponses Helger : `tests/fixtures/existence-0225.json`, `smpquery-0225.json`,
`endpoint-0225-france-invoice.json`.

### `checkExistence(participantId, { sml })` → `{ exists, smpHostUri, raw }`
- `exists` : le participant est inscrit au SML.
- `smpHostUri` : adresse du SMP (affichée et utilisée par `hostDetection.js`).

### `getServiceGroup(participantId, { sml })` → `{ documentTypes, businessCard, raw }`
- `documentTypes[]` : `documentTypeID` (avec le préfixe `busdox-docid-qns::`), `niceName`, `isFrench`,
  `isDeprecated`. **Helger fournit `niceName` et `isDeprecated` ; le SMP ne les donne pas** (voir 4.2).
  `chooseReferenceDocumentType()` et `isFrench` dépendent de `niceName` (« France … », « Peppol BIS
  Billing UBL Invoice V3 »).
- `businessCard` (via `parseBusinessCard`) : `companyName`, `otherNames`, `address` (geoinfo),
  `countryCode`, `registrationDate` (dates factices < 1990 ignorées), `additionalInfo`, `status`
  (`FR_ASSUJETTI_ACTIVE` → « Assujetti actif »), `isActiveTaxpayer`, `website`, `entityCount`.

### `getServiceMetadata(participantId, documentTypeId, { sml })` → `{ endpoints, raw }`
Pour chaque process et chaque endpoint (`NormalizedEndpoint`) :
- `processIds` (sans schéma ; sert à `detectFrenchReform` : `urn:peppol:france:billing:regulated` /
  `non-regulated`), `transportProfile`, `endpointUrl`, `serviceDescription`, `technicalContact`,
  `technicalInformationUrl`, `activationDate`, `expirationDate`.
- `certificate` : `operator` (O du sujet = nom de la plateforme), `popId` (CN, ex. `POP000717`),
  `subject` (DN complet), `issuer` (DN complet), `serial` (hexadécimal en minuscules), `validFrom`,
  `validTo`, `validByDate`.
- `_rawCertificate` (base64) : sert à dédupliquer quand il n'y a pas de numéro de série.

Format Helger des certificats (à reproduire) :
`subject.name = "CN=POP000717,OU=PEPPOL PRODUCTION AP,O=Cecurity.com SA,C=FR"`,
`serial16 = "2ff1ab54…"`, `notBefore = "2026-03-15T00:00:00"` (UTC sans fuseau).
`isCertificateValid()` accepte aussi les dates avec `Z`.

### Autour des données
- **Vue JSON brute** (`JsonViewer` dans `ResultCard.jsx`) : affiche `response.raw`
  (`existence`, `serviceGroup`, `serviceMetadata`, `directory`). Elle doit rester remplie ; avec la
  source directe, y mettre les objets lus depuis le XML (et éventuellement le XML d'origine).
- Erreurs distinctes : `API_UNAVAILABLE`, `UPSTREAM_RATE_LIMITED`, `SMP_UNREACHABLE` (titres
  dans `StatusCards.jsx`).
- Cache, recherche en lot, limite par IP, réseaux `peppolprod` / `peppoltest` : à conserver.
- `/api/config` expose `helgerMinIntervalMs` et la liste des sources (`direct` y est déjà, en
  `available: false`).

## 3. Étape 1 : le SML (DNS)

### Domaines (vérifié)
Peppol a repris le SML en interne en 2026 (« SML Insourcing »). **L'ancien domaine de la Commission
européenne `edelivery.tech.ec.europa.eu` ne répond plus du tout** (NXDOMAIN même pour des
participants connus). Le commentaire de `directPeppolSource.js` d'origine citait cet ancien domaine.

| Réseau | Domaine |
| --- | --- |
| `peppolprod` | `participant.sml.prod.tech.peppol.org` |
| `peppoltest` | `participant.sml.test.tech.peppol.org` |

### Nom à interroger (vérifié)
```
base32( sha256( minuscules("0225:552032534_danonesender") ) ) sans les "=" finaux
  + ".iso6523-actorid-upis." + domaine
```
- On hache la **valeur seule** (`0225:…`), sans le préfixe `iso6523-actorid-upis::`.
- La mise en **minuscules est obligatoire** : `…_DANONESENDER` ne donne rien.
- Type d'enregistrement : **NAPTR** (type 35). Le schéma CNAME `B-<md5>` est abandonné.

Réponse obtenue pour DANONE :
```
100 10 "U" "Meta:SMP" "!.*!https://smp.tickstar.com/peppol/!" .
```
L'URL du SMP se lit dans l'expression `!.*!<url>!`. Autres exemples vérifiés :
`0192:991825827` → `https://smp.elma-smp.no/`, `0208:0477472701` → `https://peppol-smp.odoo.com`,
`9915:helger` (test) → `https://smp.helger.com`.

### Depuis Cloudflare Workers
Pas de résolution NAPTR native : passer par le DNS-over-HTTPS de Cloudflare, gratuit et sans clé.
```
GET https://cloudflare-dns.com/dns-query?name=<nom>&type=NAPTR
Accept: application/dns-json
```
- `Status: 0` + `Answer[].data` → participant inscrit.
- `Status: 3` (NXDOMAIN) → **participant non inscrit** (`exists: false`), ce n'est pas une erreur.
- Autre statut ou échec réseau → `API_UNAVAILABLE` (message du type « Le registre Peppol (SML) ne
  répond pas »).

Le même appel marche sous Node (Express en local) : un seul chemin de code pour les deux.

## 4. Étape 2 : le SMP (REST + XML)

Identifiants dans l'URL encodés avec `encodeURIComponent` (`::` → `%3A%3A`, `#` → `%23`).
Réponses vérifiées sur le SMP Tickstar, enregistrées dans `tests/fixtures/direct/`.

### 4.1 ServiceGroup : liste des types de documents
```
GET {smp}/iso6523-actorid-upis::0225:552032534_danonesender
```
XML `ServiceGroup` (espace de noms `http://busdox.org/serviceMetadata/publishing/1.0/`) avec des
`ServiceMetadataReference href="{smp}/{participant}/services/{doctype encodé}"`. Le type de document
se lit en décodant la fin du `href` (il est déjà préfixé par `busdox-docid-qns::`).
Fixture : `servicegroup-0225-552032534_danonesender.xml`.

### 4.2 Noms lisibles des types de documents
Le SMP ne donne que les identifiants techniques. Les noms (`niceName`) et l'état (`isDeprecated`) viennent
de la **liste de codes officielle Peppol**, qui donne exactement les mêmes noms que Helger :
```
https://docs.peppol.eu/edelivery/codelists/v9.7/Peppol%20Code%20Lists%20-%20Document%20types%20v9.7.json
```
`values[]` : `{ name, scheme, value, state: "active" | "deprecated", … }` (321 entrées en v9.7).
Ex. `France Factur-X`, `France UBL Invoice CIUS`, `Peppol BIS Billing UBL Invoice V3`.
À embarquer dans le projet (un petit fichier JS `value → { name, deprecated }`), à mettre à jour de temps
en temps, avec repli sur l'identifiant brut si un type est inconnu (comme `parseDocumentTypes` le fait déjà).

### 4.3 Business Card
```
GET {smp}/businesscard/iso6523-actorid-upis::0225:552032534_danonesender
```
XML `BusinessCard` (espace de noms `http://www.peppol.eu/schema/pd/businesscard/20180621/`) :
`BusinessEntity@registrationDate`, `Name@language`, `CountryCode`, et selon les SMP `GeoInfo`,
`AdditionalInfo`, `WebsiteURI`, `Contact`. Fixture : `businesscard-0225-552032534_danonesender.xml`.
- Tous les SMP ne la publient pas (404) : ce n'est pas une erreur, `businessCard: null`. Les noms
  restent disponibles via l'annuaire Peppol, déjà interrogé.
- Faire correspondre chaque élément au champ Helger : `geoinfo`, `additionalinfo` (statut
  `FR_ASSUJETTI_ACTIVE`), `regdate`, `websiteuri`, puis réutiliser `parseBusinessCard`.

### 4.4 ServiceMetadata : point d'accès et certificat
```
GET {smp}/{participant}/services/{doctype}
```
(le plus simple : réutiliser le `href` du ServiceGroup). XML `SignedServiceMetadata` →
`ServiceInformation/ProcessList/Process` : `ProcessIdentifier`, puis `ServiceEndpointList/Endpoint` :
`@transportProfile`, `EndpointReference/Address`, `ServiceActivationDate`, `ServiceExpirationDate`,
`Certificate` (base64 DER), `ServiceDescription`, `TechnicalContactUrl`, `TechnicalInformationUrl`.
Ignorer le bloc `Signature` (on ne vérifie pas la signature, Helger non plus côté PA-Radar).
Fixture : `servicemetadata-0225-552032534_danonesender-facturx.xml`.

Certificat de cette fixture, décodé avec openssl (vérifié) :
```
subject = C=DE, O=SAP SE, OU=PEPPOL PRODUCTION AP, CN=PDE000237
issuer  = C=BE, O=OpenPEPPOL AISBL, CN=PEPPOL ACCESS POINT CA - G3
serial  = 10A45F2FC494400421FA06041B8D7AF69EDEA798
valide du 12/03/2026 au 29/02/2028
```
Il faut donc décoder le X.509 pour retrouver `operator`, `popId`, `subject`, `issuer`, `serial`,
`validFrom`, `validTo`, puis calculer `validByDate`. Remettre le DN dans l'ordre Helger
(`CN=…,OU=…,O=…,C=…`) pour que l'affichage ne change pas.

## 5. Points à trancher ou vérifier pendant l'implémentation

- **Lecture du XML sur Workers** : pas de `DOMParser`. Options : une petite bibliothèque
  (ex. `fast-xml-parser`) ou une lecture ciblée par expressions régulières. Gérer les préfixes
  d'espace de noms variables (`ns2:`, `ns3:`… selon les SMP).
- **Décodage X.509 sur Workers** : vérifier si `X509Certificate` de `node:crypto` est disponible avec
  `nodejs_compat` ; sinon une bibliothèque (ex. `@peculiar/x509`) ou un petit lecteur ASN.1.
- **Format SMP** : toutes les réponses testées sont au format Peppol SMP 1.0 (busdox). Si un SMP
  répond dans un autre format, renvoyer une erreur claire plutôt qu'un résultat faux.
- **Débit** : plus de limite d'~1 req/s (propre à Helger). Garder un espacement raisonnable par
  SMP, les SMP de grands opérateurs servant beaucoup de participants (recherche en lot).
- **Délais** : garder `EXTERNAL_TIMEOUT_MS` ; SMP qui ne répond pas → `SMP_UNREACHABLE`
  (comme aujourd'hui).
- **Choix de la source** : la nouvelle source peut servir de secours si Helger ne répond pas, puis
  devenir la source principale si elle est fiable. À décider avec l'utilisateur.

## 6. Comment vérifier qu'on ne perd rien

1. Tests unitaires des nouveaux lecteurs XML sur `tests/fixtures/direct/`.
2. Quand Helger répond de nouveau : pour une liste de SIRET/SIREN variés (déjà inscrits, non inscrits,
   plusieurs établissements, codes de routage), comparer champ par champ la réponse de `/api/lookup`
   avec chaque source. Toute différence est soit corrigée, soit expliquée.
3. Contrôler à l'écran : carte résultat, Business Card, liste des identifiants testés, certificat,
   recherche en lot, export CSV, résumé pour ticket, vue JSON brute.

## 7. Mentions de Helger à mettre à jour ensuite

`README.md` (variables `HELGER_*`, schéma d'architecture, limites), `.env.example`,
`src/server/config.js`, `src/server/api.js` (`helgerMinIntervalMs`), `src/server/sources/index.js`
(source par défaut), `src/client/components/about/AboutView.jsx` (texte sur les dépendances).

## Sources

- [SML Insourcing (OpenPeppol)](https://openpeppol.atlassian.net/wiki/spaces/PTPUB/pages/5059608580/SML+Insourcing)
- [Migration du SML (AgID)](https://peppol.agid.gov.it/en/news/SML-migration/)
- [Peppol CNAME to NAPTR Migration Process](https://docs.peppol.eu/edelivery/changelog/2025-04/Peppol%20CNAME%20to%20NAPTR%20Migration%20Process%20v1.0.0%202025-04-17.pdf)
- [Listes de codes Peppol](https://docs.peppol.eu/edelivery/codelists/)
