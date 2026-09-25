/**
 * Tests de la source Helger avec un fetch simulé (aucun appel réseau).
 */
import { describe, it, expect } from 'vitest';
import { HelgerSource } from '../src/server/sources/helgerSource.js';

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('HelgerSource', () => {
  it('lit exists:false sur une réponse HTTP 404', async () => {
    const src = new HelgerSource({ minIntervalMs: 0, fetchImpl: async () => json(404, { exists: false }) });
    await expect(src.checkExistence('iso6523-actorid-upis::0002:750620585', { sml: 'peppolprod' })).resolves.toMatchObject({ exists: false });
  });

  it('encode l\'identifiant de participant dans l\'URL', async () => {
    let calledUrl;
    const src = new HelgerSource({
      baseUrl: 'https://api.test',
      minIntervalMs: 0,
      fetchImpl: async (url) => {
        calledUrl = url;
        return json(200, { exists: true, smpHostURI: 'https://smp.tickstar.com/peppol/' });
      },
    });
    const r = await src.checkExistence('iso6523-actorid-upis::0225:750620585', { sml: 'peppolprod' });
    expect(calledUrl).toBe('https://api.test/ppidexistence/peppolprod/iso6523-actorid-upis%3A%3A0225%3A750620585');
    expect(r).toMatchObject({ exists: true, smpHostUri: 'https://smp.tickstar.com/peppol/' });
  });

  it('réessaie après un 429 puis réussit', async () => {
    let calls = 0;
    const src = new HelgerSource({
      minIntervalMs: 0,
      fetchImpl: async () => (++calls === 1 ? json(429, {}, { 'Retry-After': '0' }) : json(200, { exists: true })),
    });
    await expect(src.checkExistence('x', { sml: 'peppolprod' })).resolves.toMatchObject({ exists: true });
    expect(calls).toBe(2);
  });

  it('signale UPSTREAM_RATE_LIMITED après plusieurs 429', async () => {
    const src = new HelgerSource({ minIntervalMs: 0, fetchImpl: async () => json(429, {}, { 'Retry-After': '0' }) });
    await expect(src.checkExistence('x', { sml: 'peppolprod' })).rejects.toMatchObject({ code: 'UPSTREAM_RATE_LIMITED' });
  });

  it('distingue API indisponible et SMP muet', async () => {
    const failing = async () => {
      throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    };
    const src = new HelgerSource({ minIntervalMs: 0, fetchImpl: failing });
    await expect(src.checkExistence('x', { sml: 'peppolprod' })).rejects.toMatchObject({ code: 'API_UNAVAILABLE' });
    await expect(src.getServiceGroup('x', { sml: 'peppolprod' })).rejects.toMatchObject({ code: 'SMP_UNREACHABLE' });
  });
});
