/**
 * Tests du parsing sur les réponses RÉELLES de l'API (enregistrées le 25/09/2026)
 * pour le participant iso6523-actorid-upis::0225:750620585 (EARL BISONS D'AUVERGNE).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseDocumentTypes,
  chooseReferenceDocumentType,
  parseBusinessCard,
  extractEndpoints,
  dedupeByCertificate,
  detectFrenchReform,
  isCertificateValid,
} from '../src/server/parsing/helgerParser.js';
import { buildResult, applyKnownAccessPoint } from '../src/server/services/resultBuilder.js';

const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const existence = load('existence-0225.json');
const serviceGroup = load('smpquery-0225.json');
const metadata = load('endpoint-0225-france-invoice.json');

describe('réponse /ppidexistence', () => {
  it('indique l\'existence et le SMP', () => {
    expect(existence.exists).toBe(true);
    expect(existence.smpHostURI).toBe('https://smp.tickstar.com/peppol/');
  });
});

describe('parseBusinessCard', () => {
  const bc = parseBusinessCard(serviceGroup.businessCard);
  it('lit le nom, l\'adresse et le statut', () => {
    expect(bc.companyName).toBe("EARL BISONS D'AUVERGNE");
    expect(bc.address).toBe('LD LE PLAIX 03240 ROCLES');
    expect(bc.additionalInfo).toBe('FR_ASSUJETTI_ACTIVE');
    expect(bc.status).toBe('Assujetti actif');
    expect(bc.isActiveTaxpayer).toBe(true);
    expect(bc.countryCode).toBe('FR');
    expect(bc.registrationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('ignore les dates d\'inscription factices', () => {
    const bc = parseBusinessCard({ entity: [{ name: [{ name: 'X' }], regdate: '0001-01-01' }] });
    expect(bc.registrationDate).toBeNull();
  });
  it('renvoie null sans Business Card', () => {
    expect(parseBusinessCard(null)).toBeNull();
    expect(parseBusinessCard({ entity: [] })).toBeNull();
  });
});

describe('types de documents', () => {
  const types = parseDocumentTypes(serviceGroup.urls);
  it('liste les types et repère les formats français', () => {
    expect(types.length).toBeGreaterThan(5);
    expect(types.find((t) => t.niceName === 'France UBL Invoice CIUS')?.isFrench).toBe(true);
    expect(types.find((t) => t.niceName === 'Peppol BIS Billing UBL Invoice V3')?.isFrench).toBe(false);
  });
  it('choisit une facture française comme type de référence', () => {
    expect(chooseReferenceDocumentType(types).niceName).toBe('France UBL Invoice CIUS');
  });
  it('se rabat sur Peppol BIS Billing UBL Invoice V3, puis sur le premier', () => {
    const nonFr = types.filter((t) => !t.niceName.startsWith('France'));
    expect(chooseReferenceDocumentType(nonFr).niceName).toBe('Peppol BIS Billing UBL Invoice V3');
    const other = [{ niceName: 'Autre', documentTypeID: 'x' }];
    expect(chooseReferenceDocumentType(other).niceName).toBe('Autre');
    expect(chooseReferenceDocumentType([])).toBeNull();
  });
});

describe('extractEndpoints', () => {
  const endpoints = extractEndpoints(metadata);
  it('lit le certificat et le point d\'accès', () => {
    expect(endpoints.length).toBe(2); // un endpoint par process (regulated / non-regulated)
    const ep = endpoints[0];
    expect(ep.certificate.operator).toBe('Cecurity.com SA');
    expect(ep.certificate.popId).toBe('POP000717');
    expect(ep.serviceDescription).toBe('Cecurity (FR) Whitelabel AP');
    expect(new URL(ep.endpointUrl).hostname).toBe('ap.galaxygw.com');
    expect(ep.certificate.serial).toMatch(/^[0-9a-f]+$/);
  });
  it('détecte les processus de la réforme française', () => {
    const ids = endpoints.flatMap((e) => e.processIds);
    expect(ids).toContain('urn:peppol:france:billing:regulated');
    expect(ids).toContain('urn:peppol:france:billing:non-regulated');
    expect(detectFrenchReform(ids)).toEqual({ regulated: true, nonRegulated: true });
  });
  it('renvoie une liste vide sur une réponse inattendue', () => {
    expect(extractEndpoints(null)).toEqual([]);
    expect(extractEndpoints({ serviceinfo: {} })).toEqual([]);
  });
});

describe('dedupeByCertificate', () => {
  it('fusionne les endpoints partageant le même certificat (cas réel)', () => {
    const deduped = dedupeByCertificate(extractEndpoints(metadata));
    expect(deduped).toHaveLength(1);
    expect(deduped[0].processIds).toEqual([
      'urn:peppol:france:billing:regulated',
      'urn:peppol:france:billing:non-regulated',
    ]);
  });
  it('conserve des certificats distincts', () => {
    const mk = (serial, processId) => ({ processIds: [processId], endpointUrl: 'https://x', certificate: { serial } });
    const out = dedupeByCertificate([mk('aa', 'p1'), mk('bb', 'p2'), mk('aa', 'p3'), mk('aa', 'p1')]);
    expect(out).toHaveLength(2);
    expect(out[0].processIds).toEqual(['p1', 'p3']);
    expect(out[1].processIds).toEqual(['p2']);
  });
  it('ne modifie pas les objets d\'entrée', () => {
    const input = [{ processIds: ['p1'], certificate: { serial: 'aa' } }, { processIds: ['p2'], certificate: { serial: 'aa' } }];
    dedupeByCertificate(input);
    expect(input[0].processIds).toEqual(['p1']);
  });
});

describe('detectFrenchReform', () => {
  it('ne confond pas regulated et non-regulated', () => {
    expect(detectFrenchReform(['cenbii-procid-ubl::urn:peppol:france:billing:non-regulated'])).toEqual({ regulated: false, nonRegulated: true });
    expect(detectFrenchReform(['urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'])).toEqual({ regulated: false, nonRegulated: false });
  });
});

describe('isCertificateValid', () => {
  const cert = { validFrom: '2026-03-15T00:00:00', validTo: '2028-03-03T23:59:59' };
  it('valide / expiré selon la date', () => {
    expect(isCertificateValid(cert, new Date('2026-09-25T12:00:00Z'))).toBe(true);
    expect(isCertificateValid(cert, new Date('2028-03-04T00:00:01Z'))).toBe(false);
    expect(isCertificateValid(cert, new Date('2026-03-14T23:59:59Z'))).toBe(false);
    expect(isCertificateValid({}, new Date())).toBeNull();
  });
});

describe('buildResult + table de correspondance (cas réel complet)', () => {
  const types = parseDocumentTypes(serviceGroup.urls);
  const result = buildResult({
    candidate: { participantId: 'iso6523-actorid-upis::0225:750620585', shortId: '0225:750620585', scheme: '0225' },
    smpHostUri: existence.smpHostURI,
    serviceGroup: { documentTypes: types, businessCard: parseBusinessCard(serviceGroup.businessCard) },
    referenceDocumentType: chooseReferenceDocumentType(types),
    endpoints: extractEndpoints(metadata),
    now: new Date('2026-09-25T12:00:00Z'),
  });

  it('produit le résultat attendu', () => {
    expect(result).toMatchObject({
      companyName: "EARL BISONS D'AUVERGNE",
      address: 'LD LE PLAIX 03240 ROCLES',
      status: 'Assujetti actif',
      pa: { name: 'Cecurity.com SA', popId: 'POP000717', operator: 'Cecurity.com SA' },
      serviceDescription: 'Cecurity (FR) Whitelabel AP',
      whiteLabel: true,
      technicalHost: 'Tickstar',
      endpointHost: 'ap.galaxygw.com',
      smpHost: 'smp.tickstar.com',
      frenchReform: { regulated: true, nonRegulated: true },
      certificate: { isValid: true },
      referenceDocumentType: 'France UBL Invoice CIUS',
    });
    expect(result.accessPoints).toHaveLength(1);
    expect(result.documentTypes.some((d) => d.isFrench)).toBe(true);
  });

  it('enrichit avec la table par ID POP', () => {
    const table = { POP000717: { pa: 'Cecurity', note: 'eFacture (ISAGRI)' } };
    const enriched = applyKnownAccessPoint(result, table);
    expect(enriched.pa).toMatchObject({ name: 'Cecurity', knownName: 'Cecurity', note: 'eFacture (ISAGRI)', isKnown: true, matchedBy: 'popId' });
    // le résultat d'origine (en cache) n'est pas modifié
    expect(result.pa.knownName).toBeNull();
  });

  it('enrichit par nom d\'exploitant (O=) à défaut d\'ID POP', () => {
    const table = { POP999999: { pa: 'Cecurity', note: '' } };
    expect(applyKnownAccessPoint(result, table).pa).toMatchObject({ name: 'Cecurity', matchedBy: 'operator' });
  });

  it('garde le O= du certificat si le point d\'accès est inconnu', () => {
    expect(applyKnownAccessPoint(result, {}).pa).toMatchObject({ name: 'Cecurity.com SA', isKnown: false, knownName: null });
  });
});
