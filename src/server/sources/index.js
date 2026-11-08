/**
 * Registre des sources de données. La source utilisée est choisie par PEPPOL_SOURCE (config.peppolSource) :
 * par défaut Helger, avec la recherche Peppol directe en secours s'il ne répond pas.
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

const fallback = new FallbackSource(sources.helger, sources.direct);

/** Source utilisée par défaut pour la résolution Peppol. */
export function getDefaultSource() {
  if (config.peppolSource === 'helger') return sources.helger;
  if (config.peppolSource === 'direct') return sources.direct;
  return fallback;
}
