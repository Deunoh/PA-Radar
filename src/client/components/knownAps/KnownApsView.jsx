import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Save, X, Network } from 'lucide-react';
import { saveKnownAccessPoint, deleteKnownAccessPoint } from '../../api.js';
import { useToast } from '../../hooks/useToast.jsx';
import { cx } from '../../utils/format.js';

const EMPTY = { popId: '', pa: '', operator: '', note: '' };

/**
 * Onglet « Points d'accès connus » : table de correspondance ID POP → plateforme agréée.
 * @param {{ items: Array<{ popId: string, pa: string, note: string, operator: string }>, loading: boolean, onChange: (items: any[]) => void }} props
 */
export function KnownApsView({ items, loading, onChange }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null); // popId en cours de modification
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const reset = () => {
    setForm(EMPTY);
    setEditing(null);
    setError(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await saveKnownAccessPoint(form);
      onChange(res.items);
      toast(editing ? `${res.item.popId} mis à jour` : `${res.item.popId} ajouté`);
      reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const edit = (item) => {
    setForm({ popId: item.popId, pa: item.pa, operator: item.operator || '', note: item.note || '' });
    setEditing(item.popId);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (item) => {
    if (!window.confirm(`Supprimer ${item.popId} (${item.pa}) de la table ?`)) return;
    try {
      const res = await deleteKnownAccessPoint(item.popId);
      onChange(res.items);
      toast(`${item.popId} supprimé`);
      if (editing === item.popId) reset();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };

  const popIdExists = !editing && items.some((i) => i.popId === form.popId.trim().toUpperCase());

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pt-8 sm:px-6 sm:pt-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Points d'accès connus</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Table de correspondance entre l'identifiant du point d'accès Peppol (ID POP) et la plateforme agréée commerciale.
          Recherche par ID POP, puis à défaut par nom d'exploitant (O= du certificat).
        </p>
      </div>

      <form onSubmit={submit} className="card p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
          {editing ? <Pencil className="size-4 text-accent-500" /> : <Plus className="size-4 text-accent-500" />}
          {editing ? `Modifier ${editing}` : 'Ajouter une entrée'}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_1fr_1fr]">
          <Field label="ID POP" required>
            <input className="input font-mono uppercase" value={form.popId} onChange={set('popId')} placeholder="POP000717" disabled={Boolean(editing)} required pattern="[A-Za-z]{3}[0-9]{6}" title="3 lettres + 6 chiffres, ex. POP000717" />
          </Field>
          <Field label="Plateforme agréée" required>
            <input className="input" value={form.pa} onChange={set('pa')} placeholder="Cecurity" required />
          </Field>
          <Field label="Exploitant (O=) — optionnel">
            <input className="input" value={form.operator} onChange={set('operator')} placeholder="Cecurity.com SA" />
          </Field>
          <Field label="Note — optionnelle" className="sm:col-span-2 lg:col-span-3">
            <input className="input" value={form.note} onChange={set('note')} placeholder="ex. point d'accès marque blanche hébergé chez Tickstar" />
          </Field>
        </div>
        {popIdExists && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Cet ID POP existe déjà : l'entrée sera remplacée.</p>}
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          {(editing || form.popId || form.pa) && (
            <button type="button" className="btn-ghost" onClick={reset}>
              <X className="size-4" /> Annuler
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {editing ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        {loading ? (
          <p className="flex items-center gap-2 p-5 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Chargement…</p>
        ) : !items.length ? (
          <p className="flex items-center gap-2 p-5 text-sm text-slate-500"><Network className="size-4" /> La table est vide.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <li key={item.popId} className={cx('flex items-start gap-4 px-4 py-3.5 sm:px-5', editing === item.popId && 'bg-accent-50/50 dark:bg-accent-500/5')}>
                <span className="mt-0.5 w-24 shrink-0 font-mono text-[13px] text-slate-600 dark:text-slate-300">{item.popId}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {item.pa}
                    {item.operator && <span className="ml-2 text-xs font-normal text-slate-400">O= {item.operator}</span>}
                  </p>
                  {item.note && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{item.note}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="btn-ghost size-8 !p-0" onClick={() => edit(item)} title="Modifier" aria-label={`Modifier ${item.popId}`}>
                    <Pencil className="size-3.5" />
                  </button>
                  <button type="button" className="btn-ghost size-8 !p-0 hover:!text-red-600" onClick={() => remove(item)} title="Supprimer" aria-label={`Supprimer ${item.popId}`}>
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, className, children }) {
  return (
    <label className={cx('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
        {required && <span className="text-accent-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
