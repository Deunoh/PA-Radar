/**
 * Tests de la source « avec secours » (Helger puis recherche directe).
 */
import { describe, it, expect } from 'vitest';
import { FallbackSource } from '../src/server/sources/fallbackSource.js';
import { PeppolSource } from '../src/server/sources/baseSource.js';
import { LookupError } from '../src/server/errors.js';

/** Source simulée : renvoie `reply` (ou lève l'erreur) et compte ses appels. */
function fake(label, reply) {
  const s = new PeppolSource();
  s.label = label;
  s.calls = 0;
  s.isAvailable = () => true;
  s.checkExistence = async () => {
    s.calls++;
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return s;
}

describe('FallbackSource', () => {
  it('utilise la source principale quand elle répond', async () => {
    const primary = fake('helger', { exists: true, from: 'helger' });
    const secondary = fake('direct', { exists: true, from: 'direct' });
    await expect(new FallbackSource(primary, secondary).checkExistence('x', {})).resolves.toMatchObject({ from: 'helger' });
    expect(secondary.calls).toBe(0);
  });

  it('passe au secours si la principale est en panne, puis la met de côté', async () => {
    const primary = fake('helger', new LookupError('API_UNAVAILABLE', 'panne'));
    const secondary = fake('direct', { exists: true, from: 'direct' });
    const src = new FallbackSource(primary, secondary);
    await expect(src.checkExistence('x', {})).resolves.toMatchObject({ from: 'direct' });
    await expect(src.checkExistence('y', {})).resolves.toMatchObject({ from: 'direct' });
    expect(primary.calls).toBe(1);
    expect(secondary.calls).toBe(2);
  });

  it('réessaie la principale une fois le délai écoulé', async () => {
    const primary = fake('helger', new LookupError('UPSTREAM_RATE_LIMITED', 'saturée'));
    const secondary = fake('direct', { exists: true });
    const src = new FallbackSource(primary, secondary, { cooldownMs: 0 });
    await src.checkExistence('x', {});
    await src.checkExistence('y', {});
    expect(primary.calls).toBe(2);
  });

  it('SMP muet : essaie le secours sans mettre la principale de côté', async () => {
    const primary = fake('helger', new LookupError('SMP_UNREACHABLE', 'SMP muet'));
    const secondary = fake('direct', { exists: true, from: 'direct' });
    const src = new FallbackSource(primary, secondary);
    await expect(src.checkExistence('x', {})).resolves.toMatchObject({ from: 'direct' });
    expect(src.primaryDown).toBe(false);
  });

  it('ne cache pas les erreurs « métier » de la principale', async () => {
    const primary = fake('helger', new LookupError('BAD_REQUEST', 'SML inconnu'));
    const secondary = fake('direct', { exists: true });
    await expect(new FallbackSource(primary, secondary).checkExistence('x', {})).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(secondary.calls).toBe(0);
  });

  it('remonte l\'erreur du secours si les deux échouent', async () => {
    const primary = fake('helger', new LookupError('API_UNAVAILABLE', 'panne helger'));
    const secondary = fake('direct', new LookupError('API_UNAVAILABLE', 'panne SML'));
    await expect(new FallbackSource(primary, secondary).checkExistence('x', {})).rejects.toThrow('panne SML');
  });
});
