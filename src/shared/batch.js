/**
 * Version allégée d'une réponse de recherche, pour une ligne de la recherche en lot.
 * @param {string} id identifiant nettoyé
 * @param {any} response réponse de GET /api/lookup
 */
export function toBatchItem(id, response) {
  const r = response.result;
  return {
    id,
    siren: response.siren,
    siret: response.siret,
    status: r ? 'found' : 'not_found',
    participantId: r?.participantShortId || null,
    companyName: r?.companyName || null,
    peppol: Boolean(r),
    frenchReform: r ? r.frenchReform.regulated || r.frenchReform.nonRegulated : false,
    pa: r?.pa.name || null,
    popId: r?.pa.popId || null,
    operator: r?.pa.operator || null,
    technicalHost: r?.technicalHost || null,
    cached: Boolean(response.cached),
    error: null,
  };
}
