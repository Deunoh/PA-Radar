/**
 * Tests de lecture de l'annuaire Peppol, sur la réponse réelle enregistrée pour le SIREN 923409346
 * (MYGESPRO, inscrit uniquement à la maille établissement 0225:923409346_92340934600049).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseDirectorySearch, participantBelongsToSiren } from '../src/server/parsing/directoryParser.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/directory-923409346.json', import.meta.url), 'utf8'));

describe('participantBelongsToSiren', () => {
  it('reconnaît toutes les mailles du SIREN', () => {
    expect(participantBelongsToSiren('0225:923409346', '923409346')).toBe(true);
    expect(participantBelongsToSiren('0225:923409346_92340934600049', '923409346')).toBe(true);
    expect(participantBelongsToSiren('0225:380129866_oa_auto-factu', '380129866')).toBe(true);
    expect(participantBelongsToSiren('0002:923409346', '923409346')).toBe(true);
    expect(participantBelongsToSiren('0009:92340934600049', '923409346')).toBe(true);
  });
  it('écarte les faux positifs de la recherche plein texte', () => {
    expect(participantBelongsToSiren('0225:9234093460', '923409346')).toBe(false);
    expect(participantBelongsToSiren('0225:123923409346', '923409346')).toBe(false);
    expect(participantBelongsToSiren('0208:923409346', '923409346')).toBe(false);
    expect(participantBelongsToSiren('0009:923409346', '923409346')).toBe(false);
  });
});

describe('parseDirectorySearch (cas réel)', () => {
  it('trouve l\'inscription à la maille établissement', () => {
    const list = parseDirectorySearch(fixture, '923409346');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      scheme: '0225',
      value: '923409346_92340934600049',
      shortId: '0225:923409346_92340934600049',
      participantId: 'iso6523-actorid-upis::0225:923409346_92340934600049',
      label: 'Réforme FR · établissement (SIRET)',
      name: 'MYGESPRO',
    });
  });
  it('ignore les participants d\'un autre SIREN', () => {
    expect(parseDirectorySearch(fixture, '750620585')).toEqual([]);
    expect(parseDirectorySearch(null, '750620585')).toEqual([]);
  });
});
