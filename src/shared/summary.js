/**
 * Génère le texte « résumé pour un ticket » à partir d'une réponse de /api/lookup.
 * Partagé front/back pour pouvoir être testé.
 */

/**
 * Formate une date au format français JJ/MM/AAAA.
 * @param {string|Date} value
 */
export function formatDateFr(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' });
}

/**
 * @param {Object} response réponse de /api/lookup
 * @returns {string}
 */
export function buildTicketSummary(response) {
  const { siren, siret, result, candidates = [], queriedAt } = response;
  const idLabel = siret ? `SIRET ${siret}` : `SIREN ${siren}`;
  const checked = `Vérifié le ${formatDateFr(queriedAt || new Date())} via SMP Peppol`;

  if (!result) {
    const tested = candidates.map((c) => c.shortId).join(', ');
    return [
      idLabel,
      `Peppol : non – aucune inscription trouvée (identifiants testés : ${tested})`,
      checked,
    ].join('\n');
  }

  const reform = result.frenchReform.regulated || result.frenchReform.nonRegulated;
  const lines = [
    result.companyName ? `${idLabel} – ${result.companyName}` : idLabel,
    `Peppol : oui (${result.participantShortId}) – Réforme FR : ${reform ? 'oui' : 'non'}`,
  ];

  let paLine = `PA : ${result.pa.name || 'inconnue'}${result.pa.popId ? ` (${result.pa.popId})` : ''}`;
  if (result.whiteLabel && result.technicalHost) {
    paLine += ` – Point d'accès marque blanche hébergé chez ${result.technicalHost}`;
  } else if (result.pa.operator && result.pa.operator !== result.pa.name) {
    paLine += ` – Exploitant du point d'accès : ${result.pa.operator}`;
  }
  lines.push(paLine, checked);
  return lines.join('\n');
}
