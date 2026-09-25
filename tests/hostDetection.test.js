import { describe, it, expect } from 'vitest';
import { isWhiteLabel, registrableDomain, detectTechnicalHost } from '../src/server/services/hostDetection.js';
import { normalizeCompanyName, matchKnownAccessPoint } from '../src/server/services/knownAccessPoints.js';

describe('hostDetection', () => {
  it('reconnaît les variantes de « white label »', () => {
    expect(isWhiteLabel('Cecurity (FR) Whitelabel AP')).toBe(true);
    expect(isWhiteLabel('White label access point')).toBe(true);
    expect(isWhiteLabel('White-Label AP')).toBe(true);
    expect(isWhiteLabel('Pagero AP')).toBe(false);
    expect(isWhiteLabel(null)).toBe(false);
  });
  it('extrait le domaine enregistrable', () => {
    expect(registrableDomain('https://ap.galaxygw.com/server/3089/as4')).toBe('galaxygw.com');
    expect(registrableDomain('https://smp.tickstar.com/peppol/')).toBe('tickstar.com');
    expect(registrableDomain('https://ap.example.co.uk/as4')).toBe('example.co.uk');
    expect(registrableDomain('pas une url')).toBeNull();
  });
  it('déduit Tickstar pour un point d\'accès marque blanche', () => {
    expect(
      detectTechnicalHost({
        serviceDescription: 'Cecurity (FR) Whitelabel AP',
        endpointUrl: 'https://ap.galaxygw.com/server/3089/as4',
        smpHostUri: 'https://smp.tickstar.com/peppol/',
      }),
    ).toEqual({ name: 'Tickstar', whiteLabel: true, endpointHost: 'ap.galaxygw.com', smpHost: 'smp.tickstar.com' });
  });
  it('utilise le domaine brut si l\'hébergeur est inconnu', () => {
    expect(detectTechnicalHost({ serviceDescription: 'White label', endpointUrl: 'https://as4.inconnu.fr/x' }).name).toBe('inconnu.fr');
  });
});

describe('table de correspondance', () => {
  it('normalise les noms de société', () => {
    expect(normalizeCompanyName('Cecurity.com SA')).toBe('cecurity');
    expect(normalizeCompanyName('Société Générale SAS')).toBe('societe generale');
  });
  it('priorité à l\'ID POP, puis au nom d\'exploitant', () => {
    const table = {
      POP000717: { pa: 'Cecurity' },
      POP000001: { pa: 'Autre PA', operator: 'Pagero AB' },
    };
    expect(matchKnownAccessPoint(table, { popId: 'pop000717', operator: 'X' })?.matchedBy).toBe('popId');
    expect(matchKnownAccessPoint(table, { popId: 'POP123456', operator: 'Pagero AB' })).toMatchObject({ pa: 'Autre PA', matchedBy: 'operator' });
    expect(matchKnownAccessPoint(table, { popId: 'POP123456', operator: 'Inconnu SA' })).toBeNull();
  });
});
