import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ClipboardCopy,
  Clock,
  Eye,
  Flag,
  Layers,
  Search,
  Server,
  ShieldCheck,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import { OfficialLinks } from '../result/primitives.jsx';

const FEATURES = [
  {
    icon: Search,
    title: 'Un SIRET ou un SIREN suffit',
    text: "La saisie est contrôlée en direct (longueur, clé de Luhn) : une faute de frappe est signalée avant même de lancer la recherche.",
  },
  {
    icon: Building2,
    title: 'La plateforme agréée identifiée',
    text: "PAradar lit le certificat du point d'accès qui reçoit les factures du client : nom de l'exploitant et identifiant Peppol (ID POP).",
  },
  {
    icon: Flag,
    title: 'Réforme française et statut',
    text: "Il indique si le client est inscrit pour la réforme française et s'il est publié comme assujetti actif.",
  },
  {
    icon: Server,
    title: 'Les marques blanches repérées',
    text: "Quand une plateforme s'appuie sur l'infrastructure d'un autre opérateur, PAradar indique chez qui le point d'accès est réellement hébergé.",
  },
  {
    icon: ClipboardCopy,
    title: 'Un résumé prêt pour le ticket',
    text: 'Un clic copie une synthèse datée (identifiant, inscription, plateforme) à coller telle quelle dans la demande.',
  },
  {
    icon: Layers,
    title: 'Des centaines de clients en une fois',
    text: "La recherche en lot traite jusqu'à 500 identifiants, filtre par plateforme et exporte le tout en CSV pour Excel.",
  },
];

const BENEFITS = [
  {
    icon: Clock,
    title: 'Rapide',
    text: "Une saisie, quelques secondes, une réponse. Plus besoin de passer d'un annuaire à l'autre ni de décoder des identifiants techniques.",
  },
  {
    icon: ShieldCheck,
    title: 'À jour',
    text: "L'inscription et le point d'accès sont lus en direct sur le réseau Peppol, au moment de la recherche. Un résultat est gardé 15 minutes ; le bouton ⟳ de la fiche force une nouvelle lecture.",
  },
  {
    icon: Eye,
    title: 'Lisible',
    text: "Les données brutes du réseau sont traduites en une réponse claire, compréhensible sans connaître Peppol.",
  },
  {
    icon: BadgeCheck,
    title: 'Justifiable',
    text: 'Chaque résultat est daté, détaillé et accompagné de liens vers les sites officiels pour vérifier.',
  },
  {
    icon: Wallet,
    title: 'Gratuit',
    text: "Aucun compte, aucun abonnement : PAradar s'appuie uniquement sur des données publiques et un hébergement gratuit.",
  },
];

const STEPS = [
  {
    title: "Vérification de l'identifiant",
    text: 'Le SIRET ou le SIREN est nettoyé et contrôlé, puis traduit en identifiants Peppol français (schéma 0225).',
  },
  {
    title: 'Recherche sur Peppol',
    text: "PAradar demande au registre central du réseau si le client est inscrit, et consulte l'annuaire Peppol pour retrouver ses établissements.",
  },
  {
    title: "Lecture du point d'accès",
    text: "Il interroge ensuite le serveur qui décrit l'inscription du client : documents acceptés, point d'accès et certificat de la plateforme.",
  },
];

const LIMITS = [
  "Ce n'est pas une source officielle : en cas de doute, l'annuaire de la facturation électronique (PPF) fait foi.",
  "Le point d'accès désigne l'opérateur technique qui reçoit les factures. C'est généralement la plateforme agréée, mais ce peut être un sous-traitant.",
  "Seul le réseau Peppol est consulté : un client absent de Peppol peut tout de même recevoir des factures électroniques par d'autres voies.",
  'PAradar dépend de services publics gratuits (peppol.helger.com, annuaire Peppol), sans garantie de disponibilité et limités en débit.',
];

/**
 * Onglet « À propos » : l'intérêt de PAradar expliqué à quelqu'un qui ne le connaît pas.
 * @param {{ onStart: () => void }} props
 */
export function AboutView({ onStart }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12 px-4 pt-10 sm:px-6 sm:pt-14">
      {/* ——— Introduction ——— */}
      <section>
        <p className="text-xs font-medium tracking-wide text-accent-600 uppercase dark:text-accent-400">À propos</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Savoir en quelques secondes qui reçoit les factures d'un client
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          Depuis la réforme de la facturation électronique, une question revient sans cesse au support :{' '}
          <strong className="font-semibold text-slate-900 dark:text-white">
            par quelle plateforme agréée ce client reçoit-il ses factures ?
          </strong>{' '}
          PAradar y répond à partir d'un simple SIRET ou SIREN.
        </p>
        <button type="button" onClick={onStart} className="btn-primary mt-6 h-10">
          Essayer une recherche <ArrowRight className="size-4" />
        </button>
      </section>

      {/* ——— Contexte ——— */}
      <Section title="Le contexte">
        <div className="space-y-4 leading-relaxed text-slate-600 dark:text-slate-300">
          <p>
            Avec la réforme, chaque entreprise française doit pouvoir recevoir ses factures sous forme électronique,
            par l'intermédiaire d'une <strong className="font-medium text-slate-900 dark:text-white">plateforme agréée</strong>{' '}
            (PA) qu'elle a choisie. Les plateformes s'échangent les factures entre elles par le{' '}
            <strong className="font-medium text-slate-900 dark:text-white">réseau Peppol</strong>, un réseau européen où
            chaque entreprise est inscrite auprès d'un point d'accès.
          </p>
          <p>
            Quand un client signale qu'une facture n'arrive pas, ou qu'il faut savoir où lui envoyer une facture, la
            première chose à établir est donc : est-il inscrit, et chez quelle plateforme ?
          </p>
        </div>
      </Section>

      {/* ——— Le problème ——— */}
      <Section title="Le problème sans PAradar">
        <p className="leading-relaxed text-slate-600 dark:text-slate-300">
          La réponse existe, mais elle est éparpillée et technique. Il faut chercher l'entreprise dans l'annuaire
          Peppol sous des identifiants codés, retrouver le serveur qui décrit son inscription, lire le certificat du
          point d'accès, puis recouper avec les annuaires officiels, un client à la fois. Et la plateforme affichée
          n'est pas toujours celle qui héberge réellement le point d'accès.
        </p>
        <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">
          Résultat : de longues minutes par demande, un risque d'erreur, et une réponse difficile à justifier dans le
          ticket.
        </p>
      </Section>

      {/* ——— Ce que fait PAradar ——— */}
      <Section title="Ce que fait PAradar">
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-4">
              <span className="grid size-9 place-items-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400">
                <Icon className="size-[18px]" />
              </span>
              <h3 className="mt-3 font-medium">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ——— Plus-value ——— */}
      <Section title="La plus-value">
        <ul className="card divide-y divide-slate-100 dark:divide-slate-800">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4 p-4 sm:p-5">
              <Icon className="mt-0.5 size-5 shrink-0 text-accent-600 dark:text-accent-400" />
              <div>
                <h3 className="font-medium">{title}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* ——— Fonctionnement ——— */}
      <Section title="Comment ça marche">
        <ol className="space-y-4">
          {STEPS.map(({ title, text }, i) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-600 text-sm font-semibold text-white dark:bg-accent-500">
                {i + 1}
              </span>
              <div>
                <h3 className="font-medium">{title}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* ——— Limites ——— */}
      <Section title="Ce qu'il faut garder en tête">
        <ul className="space-y-3 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 sm:p-5 dark:border-amber-500/20 dark:bg-amber-500/5">
          {LIMITS.map((text) => (
            <li key={text} className="flex gap-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              {text}
            </li>
          ))}
        </ul>
      </Section>

      {/* ——— Sites officiels ——— */}
      <Section title="Pour vérifier">
        <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Chaque fiche résultat propose ces liens, ouverts directement sur l'entreprise recherchée quand c'est possible.
        </p>
        <div className="flex flex-wrap gap-2">
          <OfficialLinks />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
