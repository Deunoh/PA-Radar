import { useMemo } from 'react';

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Coloration syntaxique JSON minimaliste (sans dépendance).
 * Le texte est échappé AVANT l'ajout des balises : aucun HTML de l'API ne peut être injecté.
 */
function highlight(json) {
  return escapeHtml(json).replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'text-amber-600 dark:text-amber-300'; // nombres
      if (match.startsWith('"')) {
        cls = match.trimEnd().endsWith(':') ? 'text-accent-700 dark:text-accent-300' : 'text-emerald-700 dark:text-emerald-300';
      } else if (/true|false/.test(match)) {
        cls = 'text-pink-600 dark:text-pink-300';
      } else if (match === 'null') {
        cls = 'text-slate-400';
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

export function JsonViewer({ data }) {
  const html = useMemo(() => highlight(JSON.stringify(data, null, 2)), [data]);
  return (
    <pre
      className="scrollbar-thin max-h-[28rem] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
