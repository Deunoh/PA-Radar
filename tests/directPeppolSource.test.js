/**
 * Tests de la recherche Peppol directe avec un fetch simulé (aucun appel réseau),
 * sur de vraies réponses de SMP (tests/fixtures/direct/).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DirectPeppolSource, smlDnsName, smpUrlFromNaptr } from '../src/server/sources/directPeppolSource.js';

const fixture = (name) => readFileSync(new URL(`./fixtures/direct/${name}`, import.meta.url), 'utf8');
const PID = 'iso6523-actorid-upis::0225:552032534_danonesender';
const SMP = 'https://smp.tickstar.com/peppol/';
const opts = { sml: 'peppolprod' };

const dns = (status, answers = []) => ({ Status: status, Answer: answers.map((data) => ({ type: 35, data })) });
const naptr = (url) => `100 10 "U" "Meta:SMP" "!.*!${url}!" .`;

/** fetch simulé : associe un fragment d'URL à une réponse (objet → JSON, chaîne → XML, nombre → statut seul). */
function fakeFetch(routes, calls = []) {
  return async (url) => {
    calls.push(url);
    for (const [pattern, reply] of routes) {
      if (!url.includes(pattern)) continue;
      if (reply instanceof Error) throw reply;
      if (typeof reply === 'number') return new Response('', { status: reply });
      if (typeof reply === 'string') return new Response(reply, { status: 200 });
      return new Response(JSON.stringify(reply), { status: 200 });
    }
    return new Response('', { status: 404 });
  };
}

const source = (routes, calls) =>
  new DirectPeppolSource({ fetchImpl: fakeFetch(routes, calls), now: () => new Date('2026-11-08T12:00:00Z') });

describe('nom DNS et NAPTR', () => {
  it('calcule le nom DNS vérifié sur le vrai SML (valeur en minuscules, sans le schéma)', async () => {
    const expected = 'TTMZAW74FF2MBJO2X7G2JZ5ZB6WQKAMD3KDJE4P36A75AZMSR34Q.iso6523-actorid-upis.participant.sml.prod.tech.peppol.org';
    await expect(smlDnsName(PID, 'participant.sml.prod.tech.peppol.org')).resolves.toBe(expected);
    await expect(smlDnsName('iso6523-actorid-upis::0225:552032534_DANONESENDER', 'participant.sml.prod.tech.peppol.org')).resolves.toBe(expected);
  });

  it('lit l\'URL du SMP dans un enregistrement NAPTR', () => {
    expect(smpUrlFromNaptr(naptr(SMP))).toBe(SMP);
    expect(smpUrlFromNaptr('100 10 "U" "Meta:SMP" "!^.*$!https://smp.exemple!" .')).toBe('https://smp.exemple');
    expect(smpUrlFromNaptr('100 10 "U" "Autre" "!.*!https://x!" .')).toBeNull();
  });
});

describe('DirectPeppolSource.checkExistence', () => {
  it('trouve le SMP d\'un participant inscrit', async () => {
    const calls = [];
    const r = await source([['dns-query', dns(0, [naptr(SMP)])]], calls).checkExistence(PID, opts);
    expect(r).toMatchObject({ exists: true, smpHostUri: SMP });
    expect(calls[0]).toContain('participant.sml.prod.tech.peppol.org');
    expect(calls[0]).toContain('type=NAPTR');
  });

  it('interroge le SML de test pour peppoltest', async () => {
    const calls = [];
    await source([['dns-query', dns(3)]], calls).checkExistence(PID, { sml: 'peppoltest' });
    expect(calls[0]).toContain('participant.sml.test.tech.peppol.org');
  });

  it('NXDOMAIN signifie « non inscrit », pas une erreur', async () => {
    await expect(source([['dns-query', dns(3)]]).checkExistence(PID, opts)).resolves.toMatchObject({ exists: false, smpHostUri: null });
  });

  it('une panne DNS ou réseau devient API_UNAVAILABLE', async () => {
    await expect(source([['dns-query', dns(2)]]).checkExistence(PID, opts)).rejects.toMatchObject({ code: 'API_UNAVAILABLE' });
    await expect(source([['dns-query', new TypeError('fetch failed')]]).checkExistence(PID, opts)).rejects.toMatchObject({
      code: 'API_UNAVAILABLE',
    });
  });

  it('ne refait pas la requête DNS entre les étapes d\'une recherche', async () => {
    const calls = [];
    const src = source([['dns-query', dns(0, [naptr(SMP)])]], calls);
    await src.checkExistence(PID, opts);
    await src.checkExistence(PID, opts);
    expect(calls.filter((u) => u.includes('dns-query'))).toHaveLength(1);
  });
});

describe('DirectPeppolSource.getServiceGroup', () => {
  const dnsRoute = ['dns-query', dns(0, [naptr(SMP)])];

  it('lit les types de documents et la Business Card', async () => {
    const r = await source([
      dnsRoute,
      ['/businesscard/', fixture('businesscard-0225-552032534_danonesender.xml')],
      ['smp.tickstar.com', fixture('servicegroup-0225-552032534_danonesender.xml')],
    ]).getServiceGroup(PID, opts);
    expect(r.documentTypes).toHaveLength(10);
    expect(r.documentTypes.filter((d) => d.isFrench)).toHaveLength(8);
    expect(r.businessCard).toMatchObject({ companyName: 'DANONE', countryCode: 'FR', registrationDate: '2026-09-01' });
    expect(r.raw.businessCard.entity[0].name[0].name).toBe('DANONE');
  });

  it('continue sans Business Card si le SMP n\'en publie pas', async () => {
    const r = await source([
      dnsRoute,
      ['/businesscard/', 404],
      ['smp.tickstar.com', fixture('servicegroup-0225-552032534_danonesender.xml')],
    ]).getServiceGroup(PID, opts);
    expect(r.businessCard).toBeNull();
    expect(r.documentTypes).toHaveLength(10);
  });

  it('SMP muet ou absent → SMP_UNREACHABLE', async () => {
    await expect(source([dnsRoute, ['smp.tickstar.com', 404]]).getServiceGroup(PID, opts)).rejects.toMatchObject({ code: 'SMP_UNREACHABLE' });
    const timeout = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    await expect(source([dnsRoute, ['smp.tickstar.com', timeout]]).getServiceGroup(PID, opts)).rejects.toMatchObject({
      code: 'SMP_UNREACHABLE',
    });
    await expect(source([dnsRoute, ['smp.tickstar.com', '<html>erreur</html>']]).getServiceGroup(PID, opts)).rejects.toMatchObject({
      code: 'SMP_UNREACHABLE',
    });
  });
});

describe('DirectPeppolSource.getServiceMetadata', () => {
  const DOC = 'busdox-docid-qns::urn:peppol:doctype:pdf+xml##urn:cen.eu:en16931:2017#conformant#urn:peppol:france:billing:Factur-X:1.0::D22B';

  it('lit le point d\'accès et son certificat', async () => {
    const calls = [];
    const r = await source(
      [
        ['dns-query', dns(0, [naptr(SMP)])],
        ['/services/', fixture('servicemetadata-0225-552032534_danonesender-facturx.xml')],
      ],
      calls,
    ).getServiceMetadata(PID, DOC, opts);
    expect(calls[1]).toBe(`https://smp.tickstar.com/peppol/${encodeURIComponent(PID)}/services/${encodeURIComponent(DOC)}`);
    expect(r.endpoints).toHaveLength(1);
    expect(r.endpoints[0]).toMatchObject({
      processIds: ['urn:peppol:france:billing:regulated'],
      transportProfile: 'peppol-transport-as4-v2_0',
      activationDate: '2026-02-09T00:00:00',
      certificate: { operator: 'SAP SE', popId: 'PDE000237', validTo: '2028-02-29T23:59:59', validByDate: true },
    });
  });

  it('suit une redirection vers un autre SMP', async () => {
    const redirect = `<SignedServiceMetadata><ServiceMetadata><Redirect href="https://autre-smp.exemple/doc"/></ServiceMetadata></SignedServiceMetadata>`;
    const r = await source([
      ['dns-query', dns(0, [naptr(SMP)])],
      ['autre-smp.exemple', fixture('servicemetadata-0225-552032534_danonesender-facturx.xml')],
      ['/services/', redirect],
    ]).getServiceMetadata(PID, DOC, opts);
    expect(r.endpoints[0].certificate.operator).toBe('SAP SE');
  });
});
