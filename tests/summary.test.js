import { describe, it, expect } from 'vitest';
import { buildTicketSummary } from '../src/shared/summary.js';

const base = {
  siren: '750620585',
  siret: '75062058500018',
  queriedAt: '2026-09-25T10:00:00Z',
  candidates: [{ shortId: '0225:750620585' }, { shortId: '0002:750620585' }, { shortId: '0009:75062058500018' }],
};

describe('buildTicketSummary', () => {
  it('produit le résumé attendu pour le cas réel', () => {
    const text = buildTicketSummary({
      ...base,
      result: {
        companyName: "EARL BISONS D'AUVERGNE",
        participantShortId: '0225:750620585',
        frenchReform: { regulated: true, nonRegulated: true },
        pa: { name: 'Cecurity.com SA', popId: 'POP000717', operator: 'Cecurity.com SA' },
        whiteLabel: true,
        technicalHost: 'Tickstar',
      },
    });
    expect(text).toBe(
      [
        "SIRET 75062058500018 – EARL BISONS D'AUVERGNE",
        'Peppol : oui (0225:750620585) – Réforme FR : oui',
        "PA : Cecurity.com SA (POP000717) – Point d'accès marque blanche hébergé chez Tickstar",
        'Vérifié le 25/09/2026 via SMP Peppol',
      ].join('\n'),
    );
  });

  it('gère le cas non trouvé', () => {
    const text = buildTicketSummary({ ...base, siret: null, candidates: base.candidates.slice(0, 2), result: null });
    expect(text).toContain('SIREN 750620585');
    expect(text).toContain('Peppol : non');
    expect(text).toContain('0225:750620585, 0002:750620585');
  });
});
