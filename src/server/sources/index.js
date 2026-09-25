/**
 * Registre des sources de données. La source active est « helger » ;
 * les deux autres sont déclarées pour préparer leur implémentation.
 */
import { HelgerSource } from './helgerSource.js';
import { PpfSource } from './ppfSource.js';
import { DirectPeppolSource } from './directPeppolSource.js';

export const sources = {
  helger: new HelgerSource(),
  direct: new DirectPeppolSource(),
  ppf: new PpfSource(),
};

/** Source utilisée par défaut pour la résolution Peppol. */
export function getDefaultSource() {
  return sources.helger;
}
