/**
 * Test d'intégration du service de recherche avec une source simulée
 * qui renvoie les réponses réelles enregistrées (cas EARL BISONS D'AUVERGNE).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LookupService } from '../src/server/services/lookupService.js';
import { PeppolSource } from '../src/server/sources/baseSource.js';
import { parseDocumentTypes, parseBusinessCard, extractEndpoints } from '../src/server/parsing/helgerParser.js';

const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const existence = load('existence-0225.json');
const serviceGroup = load('smpquery-0225.json');
const metadata = load('endpoint-0225-france-invoice.json');

class FakeSource extends PeppolSource {
  label = 'fake';
  calls = 0;
  async checkExistence(participantId) {
    this.calls++;
    const exists = participantId === existence.participantID;
    return { exists, smpHostUri: exists ? existence.smpHostURI : null, raw: { exists } };
  }
  async getServiceGroup() {
    this.calls++;
    return { documentTypes: parseDocumentTypes(serviceGroup.urls), businessCard: parseBusinessCard(serviceGroup.businessCard), raw: serviceGroup };
  }
  async getServiceMetadata(_p, documentTypeId) {
    this.calls++;
    expect(documentTypeId).toContain('urn:peppol:france:billing:cius');
    return { endpoints: extractEndpoints(metadata), raw: metadata };
  }
}

describe('LookupService', () => {
  it('résout le cas réel de bout en bout', async () => {
    const source = new FakeSource();
    const service = new LookupService({ source, cacheTtlMs: 60_000 });
    const res = await service.lookup('750 620 585 00018');

    expect(res.siren).toBe('750620585');
    expect(res.candidates.map((c) => [c.shortId, c.exists])).toEqual([
      ['0225:750620585_75062058500018', false],
      ['0225:750620585', true],
      ['0002:750620585', false],
      ['0009:75062058500018', false],
    ]);
    expect(res.result).toMatchObject({
      companyName: "EARL BISONS D'AUVERGNE",
      pa: { name: 'Cecurity.com SA', popId: 'POP000717', operator: 'Cecurity.com SA' },
      technicalHost: 'Tickstar',
      frenchReform: { regulated: true, nonRegulated: true },
    });
    expect(Object.keys(res.raw.serviceMetadata)).toEqual(['0225:750620585']);

    // Deuxième appel : servi par le cache, aucun nouvel appel à la source
    const callsBefore = source.calls;
    const again = await service.lookup('75062058500018');
    expect(again.cached).toBe(true);
    expect(source.calls).toBe(callsBefore);
  });

  it('découvre via l\'annuaire une inscription à la maille établissement (SIREN seul saisi)', async () => {
    const target = 'iso6523-actorid-upis::0225:923409346_92340934600049';
    class DirectorySource extends FakeSource {
      async checkExistence(participantId) {
        this.calls++;
        const exists = participantId === target;
        return { exists, smpHostUri: exists ? 'https://smp.tickstar.com/peppol/' : null, raw: { exists } };
      }
      async searchDirectory(siren) {
        const json = JSON.parse(readFileSync(new URL('./fixtures/directory-923409346.json', import.meta.url), 'utf8'));
        const { parseDirectorySearch } = await import('../src/server/parsing/directoryParser.js');
        return { participants: parseDirectorySearch(json, siren), total: 1, raw: json };
      }
    }
    const service = new LookupService({ source: new DirectorySource() });
    const res = await service.lookup('923409346');
    expect(res.directory).toMatchObject({ searched: true, ok: true, found: 1 });
    expect(res.candidates.map((c) => [c.shortId, c.exists, c.origin])).toEqual([
      ['0225:923409346', false, 'constructed'],
      ['0002:923409346', false, 'constructed'],
      ['0225:923409346_92340934600049', true, 'directory'],
    ]);
    expect(res.result).toMatchObject({
      participantShortId: '0225:923409346_92340934600049',
      foundVia: 'directory',
      addressing: { level: 'siret', siret: '92340934600049' },
      smpHost: 'smp.tickstar.com',
    });
  });

  it('ne bloque pas la recherche si l\'annuaire est injoignable', async () => {
    class BrokenDirectory extends FakeSource {
      async searchDirectory() {
        throw new Error('Annuaire Peppol injoignable');
      }
    }
    const service = new LookupService({ source: new BrokenDirectory() });
    const res = await service.lookup('750620585');
    expect(res.result?.pa.popId).toBe('POP000717');
    expect(res.directory).toMatchObject({ ok: false, error: 'Annuaire Peppol injoignable' });
  });

  it('renvoie result: null quand aucun candidat n\'existe', async () => {
    const service = new LookupService({ source: new FakeSource() });
    const res = await service.lookup('732829320');
    expect(res.result).toBeNull();
    expect(res.candidates).toHaveLength(2);
  });

  it('rejette un identifiant invalide avec un message clair', async () => {
    const service = new LookupService({ source: new FakeSource() });
    await expect(service.lookup('75062058500019')).rejects.toMatchObject({ code: 'INVALID_ID', message: 'Clé de contrôle invalide' });
  });
});
