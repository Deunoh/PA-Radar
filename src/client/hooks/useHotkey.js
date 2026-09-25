import { useEffect } from 'react';

/**
 * Raccourci ⌘K (macOS) / Ctrl+K (autres) et variantes.
 * @param {string} key touche (ex. 'k')
 * @param {(e: KeyboardEvent) => void} handler
 */
export function useModHotkey(key, handler) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [key, handler]);
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
