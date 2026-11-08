/**
 * Regénère src/server/parsing/peppolDocumentTypes.js depuis la liste de codes officielle Peppol
 * (noms lisibles des types de documents, ceux qu'affiche aussi peppol.helger.com).
 *
 * Usage : node scripts/update-document-types.mjs [version]   (ex. 9.7)
 * Versions publiées : https://docs.peppol.eu/edelivery/codelists/
 */
import { writeFile } from 'node:fs/promises';

const version = process.argv[2] || '9.7';
const url = `https://docs.peppol.eu/edelivery/codelists/v${version}/Peppol%20Code%20Lists%20-%20Document%20types%20v${version}.json`;

const res = await fetch(url);
if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
const { values } = await res.json();

const entries = Object.fromEntries(
  values
    .filter((v) => v.scheme && v.value && v.name)
    .map((v) => [`${v.scheme}::${v.value}`, v.state === 'deprecated' ? [v.name, 1] : [v.name]]),
);

const out = `/**
 * Noms lisibles des types de documents Peppol : identifiant complet → [nom, 1 si obsolète].
 * Fichier GÉNÉRÉ par scripts/update-document-types.mjs depuis la liste de codes Peppol v${version}.
 * Ne pas modifier à la main : relancer le script quand Peppol publie une nouvelle version.
 */
export const CODELIST_VERSION = '${version}';

export const DOCUMENT_TYPES = {
${Object.entries(entries)
  .map(([id, v]) => `  ${JSON.stringify(id)}: ${JSON.stringify(v)},`)
  .join('\n')}
};
`;
await writeFile(new URL('../src/server/parsing/peppolDocumentTypes.js', import.meta.url), out);
console.log(`${Object.keys(entries).length} types de documents écrits (liste v${version})`);
