/**
 * Outils de manipulation des identifiants d'entreprise français (SIREN / SIRET)
 * et de construction des identifiants de participant Peppol.
 *
 * Ce module est partagé entre le front (validation en direct, formatage)
 * et le back (validation avant interrogation de Peppol).
 */

/** Préfixe du schéma d'identifiants de participant Peppol. */
export const PARTICIPANT_SCHEME = 'iso6523-actorid-upis';

/**
 * Identifiants construits et testés systématiquement, dans l'ordre de priorité.
 * - 0225 SIREN_SIRET : réforme FR, maille établissement (si un SIRET a été saisi) —
 *                      la plus précise pour cet établissement, donc prioritaire
 * - 0225 SIREN       : réforme FR, maille SIREN
 * - 0002 SIREN       : SIRENE historique
 * - 0009 SIRET       : SIRET (si un SIRET a été saisi)
 *
 * Les autres mailles de la réforme (codes de routage, autres établissements) ne peuvent
 * pas être devinées : elles sont découvertes via l'annuaire Peppol (voir lookupService).
 */
export const CANDIDATE_SCHEMES = [
  { scheme: '0225', uses: 'siren_siret', label: 'Réforme FR · établissement (SIREN_SIRET)' },
  { scheme: '0225', uses: 'siren', label: 'Réforme FR · SIREN' },
  { scheme: '0002', uses: 'siren', label: 'SIRENE (SIREN)' },
  { scheme: '0009', uses: 'siret', label: 'SIRET' },
];

/** SIREN de La Poste : ses SIRET ne respectent pas la clé de Luhn (règle spécifique). */
const LA_POSTE_SIREN = '356000000';

/**
 * Nettoie une saisie : retire espaces (y compris insécables), points et tirets.
 * @param {string} raw
 * @returns {string}
 */
export function cleanIdentifier(raw) {
  return String(raw ?? '').replace(/[\s.\-  ]/g, '');
}

/**
 * Contrôle de la clé de Luhn.
 * En partant de la droite, on double un chiffre sur deux (soustrait 9 si > 9),
 * la somme totale doit être un multiple de 10.
 * @param {string} digits chaîne composée uniquement de chiffres
 * @returns {boolean}
 */
export function luhnCheck(digits) {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/**
 * Vérifie la clé d'un SIRET, en tenant compte de l'exception La Poste
 * (somme des chiffres multiple de 5 pour les établissements de La Poste).
 * @param {string} siret
 */
function siretKeyIsValid(siret) {
  if (luhnCheck(siret)) return true;
  if (siret.startsWith(LA_POSTE_SIREN)) {
    const sum = [...siret].reduce((acc, d) => acc + Number(d), 0);
    return sum % 5 === 0;
  }
  return false;
}

/**
 * @typedef {Object} IdentifierValidation
 * @property {boolean} valid
 * @property {string} cleaned      saisie nettoyée
 * @property {'siren'|'siret'|null} type
 * @property {string|null} siren
 * @property {string|null} siret
 * @property {string|null} error   message d'erreur en français si invalide
 */

/**
 * Valide une saisie SIREN (9 chiffres) ou SIRET (14 chiffres).
 * @param {string} raw
 * @returns {IdentifierValidation}
 */
export function validateIdentifier(raw) {
  const cleaned = cleanIdentifier(raw);
  const invalid = (error) => ({ valid: false, cleaned, type: null, siren: null, siret: null, error });

  if (!cleaned) return invalid('Veuillez saisir un SIRET ou un SIREN');
  if (!/^\d+$/.test(cleaned)) return invalid("L'identifiant ne doit contenir que des chiffres");

  if (cleaned.length === 9) {
    if (!luhnCheck(cleaned)) return invalid('Clé de contrôle invalide');
    return { valid: true, cleaned, type: 'siren', siren: cleaned, siret: null, error: null };
  }

  if (cleaned.length === 14) {
    const siren = cleaned.slice(0, 9);
    if (!luhnCheck(siren)) return invalid('Clé de contrôle invalide (partie SIREN)');
    if (!siretKeyIsValid(cleaned)) return invalid('Clé de contrôle invalide');
    return { valid: true, cleaned, type: 'siret', siren, siret: cleaned, error: null };
  }

  if (cleaned.length < 9) return invalid('Le SIREN doit contenir 9 chiffres');
  return invalid('Le SIRET doit contenir 14 chiffres');
}

/**
 * Formate un identifiant pour l'affichage : « 750 620 585 » ou « 750 620 585 00018 ».
 * Fonctionne aussi sur une saisie partielle (formatage pendant la frappe).
 * Les caractères non numériques sont retirés.
 * @param {string} value
 * @returns {string}
 */
export function formatIdentifier(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 14);
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9), digits.slice(9, 14)];
  return groups.filter(Boolean).join(' ');
}

/**
 * Construit un identifiant de participant Peppol complet.
 * @param {string} scheme ex. "0225"
 * @param {string} value  ex. "750620585"
 * @returns {string} ex. "iso6523-actorid-upis::0225:750620585"
 */
export function buildParticipantId(scheme, value) {
  return `${PARTICIPANT_SCHEME}::${scheme}:${value}`;
}

/**
 * @typedef {Object} Candidate
 * @property {string} scheme          ex. "0225"
 * @property {string} value           identifiant sans schéma
 * @property {string} shortId         ex. "0225:750620585"
 * @property {string} participantId   identifiant complet
 * @property {string} label           libellé lisible
 */

/**
 * Construit la liste ordonnée des identifiants de participant à tester.
 * @param {{ siren: string, siret?: string|null }} ids
 * @returns {Candidate[]}
 */
export function buildCandidates({ siren, siret = null }) {
  const values = { siren, siret, siren_siret: siret ? `${siren}_${siret}` : null };
  return CANDIDATE_SCHEMES.filter((c) => values[c.uses]).map((c) => {
    const value = values[c.uses];
    return {
      scheme: c.scheme,
      value,
      shortId: `${c.scheme}:${value}`,
      participantId: buildParticipantId(c.scheme, value),
      label: c.label,
    };
  });
}

/**
 * Décrit le format d'adresse électronique d'un identifiant de la réforme française (schéma 0225).
 * Les 4 formats prévus par la réforme :
 *   - SIREN                    → l'entreprise
 *   - SIREN_SIRET              → un établissement
 *   - SIREN_SIRET_CODEROUTAGE  → un service d'un établissement (code de routage)
 *   - SIREN_SUFFIXE            → un suffixe libre choisi par l'entreprise
 * @param {string} value partie après le schéma, ex. "923409346_92340934600049"
 * @returns {{ level: 'siren'|'siret'|'routing'|'suffix', format: string, siren: string, siret: string|null,
 *             routingCode: string|null, suffix: string|null, extra: string|null, label: string }}
 */
export function describeFrenchAddressing(value) {
  const [siren, ...rest] = String(value || '').split('_');
  const base = { siren, siret: null, routingCode: null, suffix: null, extra: null };
  if (rest.length && /^\d{14}$/.test(rest[0])) {
    const siret = rest.shift();
    const routingCode = rest.length ? rest.join('_') : null;
    return routingCode
      ? { ...base, level: 'routing', format: 'SIREN_SIRET_CODEROUTAGE', siret, routingCode, extra: routingCode, label: 'Établissement + code de routage' }
      : { ...base, level: 'siret', format: 'SIREN_SIRET', siret, label: 'Établissement (SIRET)' };
  }
  if (rest.length) {
    const suffix = rest.join('_');
    return { ...base, level: 'suffix', format: 'SIREN_SUFFIXE', suffix, extra: suffix, label: 'Suffixe' };
  }
  return { ...base, level: 'siren', format: 'SIREN', label: 'Entreprise (SIREN)' };
}

/**
 * Découpe un texte collé (recherche en lot) en liste d'identifiants.
 * Séparateurs : retour à la ligne, virgule, point-virgule, tabulation, espace.
 * Un segment comme « 750 620 585 00018 » (identifiant formaté avec espaces)
 * est conservé entier s'il forme un SIREN/SIRET une fois nettoyé.
 * @param {string} text
 * @returns {string[]} identifiants bruts (nettoyés), doublons retirés
 */
export function splitIdentifierList(text) {
  const out = [];
  for (const chunk of String(text ?? '').split(/[\n\r,;\t]+/)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const whole = cleanIdentifier(trimmed);
    if (/^\d{9}$|^\d{14}$/.test(whole)) {
      out.push(whole);
    } else {
      for (const part of trimmed.split(/\s+/)) {
        const cleaned = cleanIdentifier(part);
        if (cleaned) out.push(cleaned);
      }
    }
  }
  return [...new Set(out)];
}
