import { describe, it, expect } from 'vitest';
import { buildTicketSummary } from '../src/shared/summary.js';

const base = {
  siren: '123456782',
  siret: '12345678200010',
  queriedAt: '2026-09-25T10:00:00Z',
  candidates: [{ shortId: '0225:123456782' }, { shortId: '0002:123456782' }, { shortId: '0009:12345678200010' }],
};

describe('buildTicketSummary', () => {
  it('produit le résumé attendu pour le cas réel', () => {
    const text = buildTicketSummary({
      ...base,
      result: {
        companyName: "ENTREPRISE EXEMPLE",
        participantShortId: '0225:123456782',
        frenchReform: { regulated: true, nonRegulated: true },
        pa: { name: 'PLATEFORME EXEMPLE', popId: 'POP000000', operator: 'PLATEFORME EXEMPLE' },
        whiteLabel: true,
        technicalHost: 'Tickstar',
      },
    });
    expect(text).toBe(
      [
        "SIRET 12345678200010 – ENTREPRISE EXEMPLE",
        'Peppol : oui (0225:123456782) – Réforme FR : oui',
        "PA : PLATEFORME EXEMPLE (POP000000) – Point d'accès marque blanche hébergé chez Tickstar",
        'Vérifié le 25/09/2026 via SMP Peppol',
      ].join('\n'),
    );
  });

  it('gère le cas non trouvé', () => {
    const text = buildTicketSummary({ ...base, siret: null, candidates: base.candidates.slice(0, 2), result: null });
    expect(text).toContain('SIREN 123456782');
    expect(text).toContain('Peppol : non');
    expect(text).toContain('0225:123456782, 0002:123456782');
  });
});
