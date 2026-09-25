import { useEffect, useState } from 'react';

const KEY = 'paradar.theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

/**
 * Thème clair / sombre : suit le système par défaut, le bouton force l'un ou l'autre.
 * Préférence : 'system' | 'light' | 'dark' (stockée en clair, lue aussi par index.html).
 */
export function useTheme() {
  const [preference, setPreference] = useState(() => {
    try {
      return localStorage.getItem(KEY) || 'system';
    } catch {
      return 'system';
    }
  });
  const [systemDark, setSystemDark] = useState(() => media().matches);

  useEffect(() => {
    const mq = media();
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isDark = preference === 'dark' || (preference === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      if (preference === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, preference);
    } catch {
      /* ignore */
    }
  }, [isDark, preference]);

  // Le bouton bascule vers le thème opposé à celui affiché ;
  // revenir au thème du système rétablit le suivi automatique.
  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    setPreference(next === (systemDark ? 'dark' : 'light') ? 'system' : next);
  };

  return { isDark, preference, toggle };
}
