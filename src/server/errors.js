/**
 * Erreurs métier typées. Chaque code correspond à un message distinct côté interface.
 */

export const ERROR_CODES = {
  INVALID_ID: 'INVALID_ID', //             identifiant saisi invalide
  NOT_FOUND: 'NOT_FOUND', //               aucune inscription Peppol
  API_UNAVAILABLE: 'API_UNAVAILABLE', //   peppol.helger.com injoignable / en erreur
  UPSTREAM_RATE_LIMITED: 'UPSTREAM_RATE_LIMITED', // l'API externe limite les requêtes (HTTP 429)
  SMP_UNREACHABLE: 'SMP_UNREACHABLE', //   le SMP du participant ne répond pas
  RATE_LIMITED: 'RATE_LIMITED', //         limite locale de 30 recherches/minute atteinte
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
};

const HTTP_STATUS = {
  INVALID_ID: 400,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  API_UNAVAILABLE: 502,
  UPSTREAM_RATE_LIMITED: 503,
  SMP_UNREACHABLE: 504,
  NOT_IMPLEMENTED: 501,
};

export class LookupError extends Error {
  /**
   * @param {keyof ERROR_CODES} code
   * @param {string} message message en français, affichable tel quel
   * @param {Object} [details] informations complémentaires (renvoyées au front)
   */
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'LookupError';
    this.code = code;
    this.status = HTTP_STATUS[code] || 500;
    this.details = details;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) } };
  }
}
