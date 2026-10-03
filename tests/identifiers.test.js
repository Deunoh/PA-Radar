import { describe, it, expect } from 'vitest';
import {
  cleanIdentifier,
  luhnCheck,
  validateIdentifier,
  formatIdentifier,
  buildParticipantId,
  buildCandidates,
  splitIdentifierList,
  describeFrenchAddressing,
} from '../src/shared/identifiers.js';

describe('cleanIdentifier', () => {
  it('retire espaces, points, tirets et espaces insécables', () => {
    expect(cleanIdentifier(' 750 620.585-00018 ')).toBe('75062058500018');
    expect(cleanIdentifier('750 620 585')).toBe('750620585');
  });
});

describe('luhnCheck', () => {
  it('accepte des SIREN / SIRET valides', () => {
    expect(luhnCheck('750620585')).toBe(true);
    expect(luhnCheck('75062058500018')).toBe(true);
    expect(luhnCheck('732829320')).toBe(true);
  });
  it('refuse une clé erronée', () => {
    expect(luhnCheck('750620586')).toBe(false);
    expect(luhnCheck('75062058500019')).toBe(false);
  });
  it('refuse les caractères non numériques', () => {
    expect(luhnCheck('75062058A')).toBe(false);
  });
});

describe('validateIdentifier', () => {
  it('reconnaît un SIRET et en déduit le SIREN', () => {
    const v = validateIdentifier('750 620 585 00018');
    expect(v).toMatchObject({ valid: true, type: 'siret', siren: '750620585', siret: '75062058500018', error: null });
  });
  it('reconnaît un SIREN', () => {
    expect(validateIdentifier('750.620.585')).toMatchObject({ valid: true, type: 'siren', siren: '750620585', siret: null });
  });
  it('signale une saisie vide', () => {
    expect(validateIdentifier('  ').error).toBe('Veuillez saisir un SIRET ou un SIREN');
  });
  it('signale des caractères non numériques', () => {
    expect(validateIdentifier('ABC123456').error).toBe("L'identifiant ne doit contenir que des chiffres");
  });
  it('signale une longueur incorrecte', () => {
    expect(validateIdentifier('75062058').error).toBe('Le SIREN doit contenir 9 chiffres');
    expect(validateIdentifier('7506205850001').error).toBe('Le SIRET doit contenir 14 chiffres');
    expect(validateIdentifier('750620585000181').error).toBe('Le SIRET doit contenir 14 chiffres');
  });
  it('signale une clé de contrôle invalide', () => {
    expect(validateIdentifier('750620586').error).toBe('Clé de contrôle invalide');
    expect(validateIdentifier('75062058500019').error).toBe('Clé de contrôle invalide');
  });
  it('accepte les SIRET de La Poste (règle spécifique)', () => {
    // 356 000 000 00015 : Luhn KO, mais somme des chiffres = 20 (multiple de 5)
    expect(luhnCheck('35600000000015')).toBe(false);
    expect(validateIdentifier('35600000000015').valid).toBe(true);
    expect(validateIdentifier('35600000000011').valid).toBe(false);
  });
});

describe('formatIdentifier', () => {
  it('groupe les chiffres 3-3-3-5', () => {
    expect(formatIdentifier('75062058500018')).toBe('750 620 585 00018');
    expect(formatIdentifier('750620585')).toBe('750 620 585');
    expect(formatIdentifier('7506')).toBe('750 6');
  });
  it('ignore les caractères non numériques et tronque à 14 chiffres', () => {
    expect(formatIdentifier('750-620-585-00018-99')).toBe('750 620 585 00018');
  });
});

describe('construction des identifiants Peppol', () => {
  it('buildParticipantId', () => {
    expect(buildParticipantId('0225', '750620585')).toBe('iso6523-actorid-upis::0225:750620585');
  });
  it('à partir d\'un SIRET : 0225 établissement, 0225 SIREN, 0002 puis 0009', () => {
    const c = buildCandidates({ siren: '750620585', siret: '75062058500018' });
    expect(c.map((x) => x.participantId)).toEqual([
      'iso6523-actorid-upis::0225:750620585_75062058500018',
      'iso6523-actorid-upis::0225:750620585',
      'iso6523-actorid-upis::0002:750620585',
      'iso6523-actorid-upis::0009:75062058500018',
    ]);
  });
  it('à partir d\'un SIREN : pas de candidat 0009', () => {
    const c = buildCandidates({ siren: '750620585' });
    expect(c.map((x) => x.shortId)).toEqual(['0225:750620585', '0002:750620585']);
  });
});

describe('splitIdentifierList', () => {
  it('accepte lignes, virgules, points-virgules et espaces', () => {
    const text = '75062058500018\n732829320, 552100554;542051180 356000000';
    expect(splitIdentifierList(text)).toEqual(['75062058500018', '732829320', '552100554', '542051180', '356000000']);
  });
  it('conserve un identifiant formaté avec espaces et retire les doublons', () => {
    expect(splitIdentifierList('750 620 585 00018\n75062058500018\n750 620 585')).toEqual(['75062058500018', '750620585']);
  });
});

describe('describeFrenchAddressing (4 formats d\'adresse de la réforme FR)', () => {
  it('SIREN', () => {
    expect(describeFrenchAddressing('750620585')).toMatchObject({ level: 'siren', format: 'SIREN', siret: null, extra: null });
  });
  it('SIREN_SIRET', () => {
    expect(describeFrenchAddressing('923409346_92340934600049')).toMatchObject({ level: 'siret', format: 'SIREN_SIRET', siren: '923409346', siret: '92340934600049' });
  });
  it('SIREN_SIRET_CODEROUTAGE', () => {
    expect(describeFrenchAddressing('923409346_92340934600049_compta')).toMatchObject({ level: 'routing', format: 'SIREN_SIRET_CODEROUTAGE', siret: '92340934600049', routingCode: 'compta' });
  });
  it('SIREN_SUFFIXE (suffixes contenant tirets ou soulignés, ou chiffres)', () => {
    expect(describeFrenchAddressing('380129866_oa_auto-factu')).toMatchObject({ level: 'suffix', format: 'SIREN_SUFFIXE', siret: null, suffix: 'oa_auto-factu' });
    expect(describeFrenchAddressing('380129866_achatpub_507807949')).toMatchObject({ level: 'suffix', suffix: 'achatpub_507807949' });
  });
});
