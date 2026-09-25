import { useState } from 'react';
import { HelpCircle, Plus, Loader2 } from 'lucide-react';
import { saveKnownAccessPoint } from '../../api.js';
import { useToast } from '../../hooks/useToast.jsx';

/**
 * Proposition d'ajout à la table de correspondance quand l'ID POP est inconnu.
 */
export function UnknownPopPrompt({ popId, operator, onSaved }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pa, setPa] = useState(() => (operator || '').replace(/\s+(SA|SAS|SASU|SARL|GmbH|AB|BV|NV|Ltd\.?|Inc\.?)$/i, '').replace(/\.com$/i, ''));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveKnownAccessPoint({ popId, pa, note, operator });
      toast(`${popId} ajouté à la table`);
      onSaved?.();
    } catch (err) {
      toast(err.message, { tone: 'error', duration: 4000 });
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 text-sm dark:border-amber-500/20 dark:bg-amber-500/5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <HelpCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="flex-1 text-amber-900 dark:text-amber-200">
          Point d'accès inconnu (<span className="font-mono">{popId}</span>), l'ajouter à la table ?
        </p>
        {!open && (
          <button type="button" className="btn-secondary h-8 text-xs" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" /> Ajouter
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={submit} className="animate-fade mt-3 grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
          <input className="input" value={pa} onChange={(e) => setPa(e.target.value)} placeholder="Nom de la PA" required aria-label="Nom de la plateforme agréée" autoFocus />
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optionnelle)" aria-label="Note" />
          <button type="submit" className="btn-primary" disabled={saving || !pa.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />} Enregistrer
          </button>
        </form>
      )}
    </div>
  );
}
