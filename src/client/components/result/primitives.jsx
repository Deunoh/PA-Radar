/**
 * Petits composants réutilisables : bouton copier, badge, section repliable, liens de vérification.
 */
import { useState } from 'react';
import { Check, Copy, ChevronRight, ExternalLink } from 'lucide-react';
import { useCopy } from '../../hooks/useCopy.js';
import { cx } from '../../utils/format.js';
import peppolCheckIcon from '../../assets/peppolcheck.svg';
import annuaireIcon from '../../assets/annuaire-entreprises.svg';
import chorusProIcon from '../../assets/chorus-pro.png';

export function CopyButton({ value, label = 'Copier', message, className }) {
  const copy = useCopy();
  const [done, setDone] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={async (e) => {
        e.stopPropagation();
        if (await copy(String(value), message)) {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        }
      }}
      className={cx(
        'grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200',
        className,
      )}
    >
      {done ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </button>
  );
}

const BADGE_TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  blue: 'bg-accent-50 text-accent-700 ring-accent-600/15 dark:bg-accent-500/10 dark:text-accent-300 dark:ring-accent-400/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  red: 'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/15',
};

export function Badge({ tone = 'slate', icon: Icon, children, className }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', BADGE_TONES[tone], className)}>
      {Icon && <Icon className="size-3.5" />}
      {children}
    </span>
  );
}

/** Section repliable (bordure supérieure, en-tête cliquable). */
export function Collapsible({ title, icon: Icon, count, defaultOpen = false, actions, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-2 px-5 sm:px-7">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 py-3.5 text-left text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <ChevronRight className={cx('size-4 text-slate-400 transition-transform duration-200', open && 'rotate-90')} />
          {Icon && <Icon className="size-4 text-slate-400" />}
          {title}
          {count != null && <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">{count}</span>}
        </button>
        {open && actions}
      </div>
      <div className={cx('grid transition-[grid-template-rows] duration-300 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="px-5 pb-5 sm:px-7">{children}</div>
        </div>
      </div>
    </section>
  );
}

/**
 * Boutons vers les sites officiels de vérification, avec leur logo :
 *  - PeppolCheck.fr, qui n'a de page qu'au niveau du SIREN (0225:SIREN), pas de l'établissement ;
 *  - l'Annuaire des Entreprises, sur la fiche de l'établissement si un SIRET a été saisi ;
 *  - l'annuaire de la facturation électronique (Chorus Pro), qui n'accepte pas d'identifiant dans
 *    l'adresse : l'identifiant saisi (SIRET, sinon SIREN) est copié au clic pour être collé dans sa recherche.
 */
export function VerificationLinks({ siren, siret }) {
  if (!siren) return null;
  return (
    <>
      <OfficialLink
        href={`https://peppolcheck.fr/0225:${siren}`}
        icon={peppolCheckIcon}
        label="PeppolCheck.fr"
      />
      <OfficialLink
        href={
          siret
            ? `https://annuaire-entreprises.data.gouv.fr/etablissement/${siret}`
            : `https://annuaire-entreprises.data.gouv.fr/entreprise/${siren}`
        }
        icon={annuaireIcon}
        label="Annuaire des Entreprises"
      />
      <OfficialLink
        href="https://facturation.chorus-pro.gouv.fr/annuaire"
        icon={chorusProIcon}
        label="Annuaire Chorus Pro"
        title={`Ouvrir l'annuaire de la facturation électronique (Chorus Pro) : le ${siret ? 'SIRET' : 'SIREN'} est copié, collez-le dans la recherche`}
        copyValue={siret || siren}
        copyLabel={siret ? 'SIRET' : 'SIREN'}
      />
    </>
  );
}

/** Les mêmes sites, sur leur page d'accueil (onglet « À propos »). */
export function OfficialLinks() {
  return (
    <>
      <OfficialLink href="https://peppolcheck.fr/" icon={peppolCheckIcon} label="PeppolCheck.fr" title="PeppolCheck.fr (nouvel onglet)" />
      <OfficialLink
        href="https://annuaire-entreprises.data.gouv.fr/"
        icon={annuaireIcon}
        label="Annuaire des Entreprises"
        title="Annuaire des Entreprises (nouvel onglet)"
      />
      <OfficialLink
        href="https://facturation.chorus-pro.gouv.fr/annuaire"
        icon={chorusProIcon}
        label="Annuaire Chorus Pro"
        title="Annuaire de la facturation électronique, Chorus Pro (nouvel onglet)"
      />
    </>
  );
}

function OfficialLink({ href, icon, label, title, copyValue, copyLabel }) {
  const copy = useCopy();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title || `Vérifier sur ${label} (nouvel onglet)`}
      onClick={copyValue ? () => copy(copyValue, `${copyLabel} ${copyValue} copié : collez-le dans la recherche Chorus Pro`) : undefined}
      className="btn-secondary h-9 gap-2 whitespace-nowrap !pl-2"
    >
      <img src={icon} alt="" className="size-5 rounded-md bg-white ring-1 ring-slate-200 dark:ring-slate-700" />
      {label}
      <ExternalLink className="size-3.5 text-slate-400" />
    </a>
  );
}
