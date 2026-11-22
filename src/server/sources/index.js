/**
 * Registre des sources de données. La source utilisée est choisie par PEPPOL_SOURCE (config.peppolSource) :
 * par défaut la recherche Peppol directe (SML + SMP), avec peppol.helger.com en secours.
 * Les deux produisent exactement les mêmes informations (scripts/compare-sources.mjs) ; la recherche
 * directe est bien plus rapide car elle n'a pas la limite d'environ une requête par seconde de Helger.
 */
import { config } from '../config.js';
import { HelgerSource } from './helgerSource.js';
import { PpfSource } from './ppfSource.js';
import { DirectPeppolSource } from './directPeppolSource.js';
import { FallbackSource } from './fallbackSource.js';

export const sources = {
  helger: new HelgerSource(),
  direct: new DirectPeppolSource(),
  ppf: new PpfSource(),
};

const directThenHelger = new FallbackSource(sources.direct, sources.helger);
const helgerThenDirect = new FallbackSource(sources.helger, sources.direct);

/** Source utilisée par défaut pour la résolution Peppol. */
export function getDefaultSource() {
  if (config.peppolSource === 'helger') return sources.helger;
  if (config.peppolSource === 'direct') return sources.direct;
  if (config.peppolSource === 'helger-puis-direct') return helgerThenDirect;
  return directThenHelger;
}
