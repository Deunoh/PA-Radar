import { Mail } from 'lucide-react';

/** Adresse de contact affichée publiquement (éditeur, demandes liées aux données personnelles). */
export const LEGAL_CONTACT = 'deunoh.tv@gmail.com';

/** Date de la dernière mise à jour de cette page, à changer à chaque modification du texte. */
const LAST_UPDATE = '13 novembre 2026';

/**
 * Page « Mentions légales et données personnelles » (loi LCEN, article 6, et RGPD, article 13).
 * L'éditeur est un particulier qui reste anonyme, comme le permet la LCEN aux éditeurs non professionnels.
 */
export function LegalView() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 pt-10 sm:px-6 sm:pt-14">
      <section>
        <p className="text-xs font-medium tracking-wide text-accent-600 uppercase dark:text-accent-400">Informations légales</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Mentions légales et données personnelles</h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Dernière mise à jour : {LAST_UPDATE}</p>
      </section>

      <Section title="Éditeur">
        <P>
          PAradar est édité par un particulier, à titre non professionnel et gratuit. Conformément à l'article 6 de la loi
          n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN), l'éditeur a choisi de ne pas
          rendre public son nom ; ses coordonnées ont été communiquées à l'hébergeur.
        </P>
        <ContactLine />
      </Section>

      <Section title="Hébergeur">
        <address className="card p-4 text-sm leading-relaxed not-italic text-slate-600 sm:p-5 dark:text-slate-300">
          <strong className="font-medium text-slate-900 dark:text-white">Cloudflare, Inc.</strong>
          <br />
          101 Townsend Street, San Francisco, CA 94107, États-Unis
          <br />
          Téléphone : +1 888 993 5273 ·{' '}
          <a className="link" href="https://www.cloudflare.com" target="_blank" rel="noreferrer">
            www.cloudflare.com
          </a>
        </address>
      </Section>

      <Section title="Nature du service">
        <P>
          PAradar est un outil gratuit qui indique, à partir d'un SIRET ou d'un SIREN, l'inscription d'une entreprise sur
          le réseau Peppol et le point d'accès qui reçoit ses factures. Les informations proviennent de sources publiques :
          le registre et l'annuaire du réseau Peppol, les serveurs des opérateurs Peppol et le service peppol.helger.com.
        </P>
        <P>
          PAradar n'est pas une source officielle et ne garantit ni l'exactitude, ni l'exhaustivité, ni la disponibilité
          de ces informations. En cas de doute, l'annuaire de la facturation électronique (Portail Public de Facturation)
          fait foi. Les liens vers d'autres sites et les logos de ces sites appartiennent à leurs propriétaires respectifs.
        </P>
        <P>
          Peppol est le réseau de facturation électronique géré par OpenPeppol AISBL. PAradar est un outil indépendant :
          il n'est ni affilié à OpenPeppol, ni approuvé par lui, et le nom Peppol n'y est employé que pour désigner ce
          réseau.
        </P>
      </Section>

      <Section title="Données personnelles">
        <P>
          PAradar ne demande aucun compte et n'utilise <strong className="font-medium text-slate-900 dark:text-white">ni
          cookie, ni outil de mesure d'audience, ni publicité</strong>. Les SIRET et SIREN recherchés peuvent toutefois
          concerner des entrepreneurs individuels, et donc des personnes physiques ; voici ce qu'il en advient.
        </P>

        <h3 className="mt-6 font-medium">Sur votre appareil</h3>
        <P>
          Vos dix dernières recherches et vos réglages (thème, réseau Peppol, référence de la recherche en lot) sont
          enregistrés dans le stockage local de votre navigateur. Ils ne sont jamais envoyés à PAradar. Vous pouvez effacer
          l'historique avec le bouton prévu à cet effet, ou toutes ces données depuis les réglages de votre navigateur.
        </P>

        <h3 className="mt-6 font-medium">Sur le serveur</h3>
        <ul className="mt-2 space-y-2 leading-relaxed text-slate-600 dark:text-slate-300">
          <Li>L'identifiant recherché est reçu pour effectuer la recherche ; le résultat est gardé en mémoire 15 minutes pour répondre plus vite à une même recherche.</Li>
          <Li>Votre adresse IP est gardée en mémoire une minute pour limiter le nombre de recherches par personne et protéger le service contre les abus.</Li>
          <Li>L'hébergeur tient des journaux techniques (requêtes reçues, dont l'identifiant recherché, et informations de connexion), conservés quelques jours pour diagnostiquer les pannes.</Li>
          <Li>Rien de tout cela n'est vendu, cédé, ni utilisé à d'autres fins.</Li>
        </ul>

        <h3 className="mt-6 font-medium">Services interrogés</h3>
        <P>
          Pour répondre, le serveur de PAradar transmet l'identifiant recherché à peppol.helger.com, à l'annuaire Peppol
          (directory.peppol.eu), au registre Peppol (par une requête DNS via le résolveur de Cloudflare) et au serveur de
          l'opérateur Peppol de l'entreprise. Ces requêtes partent du serveur : votre adresse IP ne leur est pas transmise.
        </P>

        <h3 className="mt-6 font-medium">Base légale, transferts et durées</h3>
        <P>
          Ces traitements reposent sur l'intérêt légitime de l'éditeur à fournir le service et à le protéger (article 6.1.f
          du RGPD). L'hébergeur, Cloudflare, est établi aux États-Unis ; les transferts de données s'appuient sur le cadre
          de protection des données UE–États-Unis (Data Privacy Framework) et les garanties contractuelles de Cloudflare.
          Les durées de conservation sont celles indiquées ci-dessus.
        </P>

        <h3 className="mt-6 font-medium">Vos droits</h3>
        <P>
          Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation et d'opposition sur les données
          qui vous concernent. Pour l'exercer, écrivez à l'adresse ci-dessous. Vous pouvez aussi adresser une réclamation à
          la CNIL (
          <a className="link" href="https://www.cnil.fr" target="_blank" rel="noreferrer">
            www.cnil.fr
          </a>
          ).
        </P>
        <ContactLine />
      </Section>
    </div>
  );
}

function ContactLine() {
  return (
    <p className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <Mail className="size-4 shrink-0 text-accent-600 dark:text-accent-400" />
      Contact :{' '}
      <a className="link" href={`mailto:${LEGAL_CONTACT}`}>
        {LEGAL_CONTACT}
      </a>
    </p>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function P({ children }) {
  return <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">{children}</p>;
}

function Li({ children }) {
  return (
    <li className="flex gap-2">
      <span className="mt-2.5 size-1 shrink-0 rounded-full bg-slate-400" />
      <span>{children}</span>
    </li>
  );
}
