import { useCallback } from 'react';
import { useToast } from './useToast.jsx';

/** Copie dans le presse-papiers avec toast de confirmation. */
export function useCopy() {
  const toast = useToast();
  return useCallback(
    async (text, message = 'Copié dans le presse-papiers') => {
      try {
        await navigator.clipboard.writeText(text);
        toast(message);
        return true;
      } catch {
        // Repli pour les contextes non sécurisés (http hors localhost)
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        toast(ok ? message : 'Copie impossible', { tone: ok ? 'success' : 'error' });
        return ok;
      }
    },
    [toast],
  );
}
