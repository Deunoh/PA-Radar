/**
 * Export CSV compatible Excel : séparateur « ; », encodage UTF-8 avec BOM.
 */

function escapeCell(value) {
  const s = value == null ? '' : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * @param {string[]} headers
 * @param {Array<Array<any>>} rows
 */
export function toCsv(headers, rows) {
  return [headers, ...rows].map((r) => r.map(escapeCell).join(';')).join('\r\n');
}

/** Déclenche le téléchargement d'un fichier CSV (avec BOM UTF-8 pour Excel). */
export function downloadCsv(filename, csv) {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Extrait les SIREN / SIRET d'un fichier CSV quelconque (colonnes, en-têtes…) :
 * on garde toute suite de chiffres (éventuellement espacés) de 9 ou 14 chiffres.
 * @param {string} text
 * @returns {string[]}
 */
export function extractIdentifiersFromCsv(text) {
  const out = [];
  for (const match of String(text).matchAll(/\d[\d . ]{7,22}\d/g)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length === 9 || digits.length === 14) out.push(digits);
  }
  return [...new Set(out)];
}
