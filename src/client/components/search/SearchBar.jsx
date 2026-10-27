import { forwardRef, useLayoutEffect, useRef } from 'react';
import { Search, CheckCircle2, XCircle, Loader2, CornerDownLeft } from 'lucide-react';
import { formatIdentifier, validateIdentifier } from '../../../shared/identifiers.js';
import { cx } from '../../utils/format.js';

/**
 * État de validation en direct :
 *  - vide            → neutre
 *  - saisie partielle → neutre + indication
 *  - 9 ou 14 chiffres → valide / invalide (clé de Luhn)
 */
export function liveValidation(value) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return { state: 'empty', message: null };
  if (digits.length !== 9 && digits.length !== 14) {
    return {
      state: 'partial',
      message: digits.length < 9 ? `${digits.length}/9 chiffres pour un SIREN` : `${digits.length}/14 chiffres pour un SIRET`,
    };
  }
  const v = validateIdentifier(digits);
  if (!v.valid) return { state: 'invalid', message: v.error };
  return { state: 'valid', message: v.type === 'siret' ? `SIRET valide · SIREN ${formatIdentifier(v.siren)}` : 'SIREN valide' };
}

/**
 * Grand champ de recherche façon « barre de commande ».
 * Formate automatiquement la saisie (750 620 585 00018) en conservant la position du curseur.
 */
export const SearchBar = forwardRef(function SearchBar({ value, onChange, onSubmit, loading }, inputRef) {
  const caretDigits = useRef(null);
  const status = liveValidation(value);

  // Après reformatage, replace le curseur après le même nombre de chiffres qu'avant
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (caretDigits.current == null || !input) return;
    let pos = 0;
    let seen = 0;
    while (pos < value.length && seen < caretDigits.current) {
      if (/\d/.test(value[pos])) seen++;
      pos++;
    }
    input.setSelectionRange(pos, pos);
    caretDigits.current = null;
  }, [value, inputRef]);

  const handleChange = (e) => {
    const { value: raw, selectionStart } = e.target;
    caretDigits.current = raw.slice(0, selectionStart ?? raw.length).replace(/\D/g, '').length;
    onChange(formatIdentifier(raw));
  };

  const StatusIcon = { valid: CheckCircle2, invalid: XCircle }[status.state];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="w-full"
    >
      <div
        className={cx(
          'group relative flex items-center gap-3 rounded-2xl border bg-white px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(15,23,42,0.1)] transition',
          'focus-within:ring-4 dark:bg-slate-900 dark:shadow-none',
          status.state === 'invalid'
            ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-500/10 dark:border-red-500/50'
            : 'border-slate-200 focus-within:border-accent-500 focus-within:ring-accent-500/15 dark:border-slate-700',
        )}
      >
        {loading ? (
          <Loader2 className="size-5 shrink-0 animate-spin text-accent-500" />
        ) : (
          <Search className="size-5 shrink-0 text-slate-400" />
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          placeholder="SIRET ou SIREN…"
          aria-label="SIRET ou SIREN"
          aria-invalid={status.state === 'invalid'}
          aria-describedby="search-hint"
          className="h-14 min-w-0 flex-1 bg-transparent font-mono text-lg tracking-wide text-slate-900 outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 sm:h-16 sm:text-xl dark:text-white"
        />
        {StatusIcon && (
          <StatusIcon
            className={cx('animate-fade size-5 shrink-0', status.state === 'valid' ? 'text-emerald-500' : 'text-red-500')}
            aria-hidden
          />
        )}
        {value && (
          <button
            type="submit"
            disabled={loading || status.state !== 'valid'}
            className="btn-primary hidden h-9 sm:inline-flex"
          >
            Rechercher <CornerDownLeft className="size-3.5 opacity-70" />
          </button>
        )}
      </div>
      <div className="flex min-h-7 items-center justify-between gap-3 px-1 pt-2 text-sm">
        <p
          id="search-hint"
          className={cx(
            'transition-colors',
            status.state === 'invalid' && 'text-red-600 dark:text-red-400',
            status.state === 'valid' && 'text-emerald-600 dark:text-emerald-400',
            (status.state === 'partial' || status.state === 'empty') && 'text-slate-400',
          )}
        >
          {status.message || 'Saisissez un SIREN (9 chiffres) ou un SIRET (14 chiffres)'}
        </p>
        <button type="submit" disabled={loading || status.state !== 'valid'} className="btn-primary h-9 sm:hidden">
          Rechercher
        </button>
      </div>
    </form>
  );
});
