/**
 * Compare, champ par champ, les réponses de la source Helger et de la recherche Peppol directe.
 * Sert à vérifier qu'aucune information n'est perdue (voir docs/source-peppol-directe.md).
 *
 * Usage : node scripts/compare-sources.mjs <SIRET|SIREN|identifiant Peppol> …
 *   - SIRET / SIREN : compare la recherche complète (/api/lookup) avec chaque source ;
 *   - identifiant Peppol (ex. 0225:552032534_danonesender) : compare existence, types de documents,
 *     Business Card et point d'accès du participant.
 * Lent : Helger impose environ une requête par seconde.
 */
import { HelgerSource } from '../src/server/sources/helgerSource.js';
import { DirectPeppolSource } from '../src/server/sources/directPeppolSource.js';
import { LookupService } from '../src/server/services/lookupService.js';
import { chooseReferenceDocumentType } from '../src/server/parsing/helgerParser.js';

const sml = 'peppolprod';
const helger = new HelgerSource();
const direct = new DirectPeppolSource();

/** Différences entre deux valeurs JSON, sous forme de chemins « a.b[0].c ». */
function diff(a, b, path = '', out = []) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) diff(a[k], b[k], Array.isArray(a) ? `${path}[${k}]` : path ? `${path}.${k}` : k, out);
    return out;
  }
  out.push({ path: path || '(racine)', helger: a, direct: b });
  return out;
}

const settle = (p) => p.then((value) => ({ value }), (err) => ({ error: `${err.code || 'ERREUR'} : ${err.message}` }));

async function participant(s, pid) {
  const existence = await settle(s.checkExistence(pid, { sml }));
  if (!existence.value?.exists) return { existence: existence.value ? { exists: false } : existence };
  const group = await settle(s.getServiceGroup(pid, { sml }));
  const out = {
    existence: { exists: true, smpHostUri: existence.value.smpHostUri },
    documentTypes: group.value?.documentTypes ?? group,
    businessCard: group.value?.businessCard ?? null,
  };
  const ref = group.value && chooseReferenceDocumentType(group.value.documentTypes);
  if (ref) {
    const metadata = await settle(s.getServiceMetadata(pid, ref.documentTypeID, { sml }));
    out.endpoints = metadata.value?.endpoints ?? metadata;
  }
  return out;
}

async function lookup(s, id) {
  const r = await settle(new LookupService({ source: s, cacheTtlMs: 1 }).lookup(id, { sml, includeRaw: false }));
  if (r.error) return r;
  // Champs qui changent forcément d'un appel à l'autre ou d'une source à l'autre
  const { queriedAt, durationMs, source, cached, ...rest } = r.value;
  return rest;
}

let differences = 0;
for (const arg of process.argv.slice(2)) {
  const isParticipant = arg.includes(':');
  const pid = arg.startsWith('iso6523-actorid-upis::') ? arg : `iso6523-actorid-upis::${arg}`;
  const run = (s) => (isParticipant ? participant(s, pid) : lookup(s, arg));
  const [h, d] = [await run(helger), await run(direct)];
  const found = diff(h, d);
  differences += found.length;
  console.log(`\n${found.length ? '✗' : '✓'} ${arg}${found.length ? ` : ${found.length} différence(s)` : ' : identique'}`);
  for (const f of found) {
    console.log(`  ${f.path}\n    helger : ${JSON.stringify(f.helger)}\n    direct : ${JSON.stringify(f.direct)}`);
  }
}
console.log(`\n${differences ? `${differences} différence(s) au total` : 'Aucune différence'}`);
process.exitCode = differences ? 1 : 0;
