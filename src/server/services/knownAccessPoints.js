/**
 * Table de correspondance des points d'accès connus (data/known-access-points.json).
 *
 * Format : { "POP000717": { "pa": "Cecurity", "note": "…", "operator": "Cecurity.com SA" (optionnel) } }
 * Correspondance par ID POP, puis à défaut par nom d'exploitant (O= du certificat).
 */
import fs from 'node:fs/promises';
import { LookupError } from '../errors.js';

const POP_ID_PATTERN = /^[A-Z]{3}\d{6}$/;

/**
 * Normalise un nom de société pour comparaison :
 * minuscules, sans accents, sans formes juridiques ni extension de domaine.
 * ex. « Cecurity.com SA » → « cecurity »
 * @param {string|null} name
 */
export function normalizeCompanyName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\.(com|fr|net|eu|io)\b/g, ' ')
    .replace(/\b(sa|sas|sasu|sarl|gmbh|ltd|limited|inc|bv|ab|nv|srl|spa|ag|oy|as)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Recherche une entrée dans la table (fonction pure, testable).
 * @param {Record<string, { pa: string, note?: string, operator?: string }>} table
 * @param {{ popId?: string|null, operator?: string|null }} query
 * @returns {{ popId: string, pa: string, note: string|null, matchedBy: 'popId'|'operator' } | null}
 */
export function matchKnownAccessPoint(table, { popId, operator }) {
  if (popId) {
    const entry = table[popId.toUpperCase()];
    if (entry) return { popId: popId.toUpperCase(), pa: entry.pa, note: entry.note || null, matchedBy: 'popId' };
  }
  const target = normalizeCompanyName(operator);
  if (target) {
    for (const [id, entry] of Object.entries(table)) {
      const candidates = [entry.operator, entry.pa].map(normalizeCompanyName).filter(Boolean);
      if (candidates.some((c) => c === target || (c.length >= 4 && target.split(' ').includes(c)))) {
        return { popId: id, pa: entry.pa, note: entry.note || null, matchedBy: 'operator' };
      }
    }
  }
  return null;
}

/**
 * Magasin persistant de la table. Les écritures passent par un fichier temporaire
 * puis un renommage (atomique) pour ne jamais laisser un JSON corrompu.
 */
export class KnownAccessPointsStore {
  constructor(filePath) {
    this.filePath = filePath;
    /** @type {Record<string, any> | null} */
    this.table = null;
    this.writeChain = Promise.resolve();
  }

  async load() {
    if (this.table) return this.table;
    try {
      this.table = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') console.error('[known-access-points] lecture impossible :', err.message);
      this.table = {};
    }
    return this.table;
  }

  async list() {
    const table = await this.load();
    return Object.entries(table)
      .map(([popId, e]) => ({ popId, pa: e.pa, note: e.note || '', operator: e.operator || '' }))
      .sort((a, b) => a.popId.localeCompare(b.popId));
  }

  async match(query) {
    return matchKnownAccessPoint(await this.load(), query);
  }

  /**
   * Ajoute ou met à jour une entrée.
   * @param {{ popId: string, pa: string, note?: string, operator?: string }} input
   */
  async upsert({ popId, pa, note, operator }) {
    const id = String(popId || '').trim().toUpperCase();
    const name = String(pa || '').trim();
    if (!POP_ID_PATTERN.test(id)) {
      throw new LookupError('BAD_REQUEST', "L'ID POP doit avoir la forme POP000123 (3 lettres + 6 chiffres)");
    }
    if (!name) throw new LookupError('BAD_REQUEST', 'Le nom de la plateforme agréée est obligatoire');

    const table = await this.load();
    const entry = { pa: name.slice(0, 120) };
    if (note?.trim()) entry.note = note.trim().slice(0, 500);
    if (operator?.trim()) entry.operator = operator.trim().slice(0, 200);
    table[id] = entry;
    await this.persist();
    return { popId: id, ...entry };
  }

  async remove(popId) {
    const table = await this.load();
    const id = String(popId || '').toUpperCase();
    if (!table[id]) return false;
    delete table[id];
    await this.persist();
    return true;
  }

  persist() {
    // Sérialise les écritures pour éviter deux renommages concurrents
    // (le catch évite qu'un échec précédent bloque les écritures suivantes)
    this.writeChain = this.writeChain.catch(() => {}).then(async () => {
      const tmp = `${this.filePath}.tmp`;
      await fs.writeFile(tmp, `${JSON.stringify(this.table, null, 2)}\n`, 'utf8');
      await fs.rename(tmp, this.filePath);
    });
    return this.writeChain;
  }
}
