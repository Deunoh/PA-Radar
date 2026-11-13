import { useCallback, useState } from 'react';
import { Search, Layers, Info } from 'lucide-react';
import { Header, MobileNav } from './components/layout/Header.jsx';
import { Disclaimer } from './components/layout/Disclaimer.jsx';
import { SearchView } from './components/search/SearchView.jsx';
import { BatchView } from './components/batch/BatchView.jsx';
import { AboutView } from './components/about/AboutView.jsx';
import { LegalView } from './components/legal/LegalView.jsx';
import { useTheme } from './hooks/useTheme.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';

const TABS = [
  { id: 'search', label: 'Recherche', shortLabel: 'Recherche', icon: Search },
  { id: 'batch', label: 'Recherche en lot', shortLabel: 'En lot', icon: Layers },
  { id: 'about', label: 'À propos', shortLabel: 'À propos', icon: Info },
];

export default function App() {
  const { isDark, toggle } = useTheme();
  const [tab, setTab] = useState('search');
  const [sml, setSml] = useLocalStorage('paradar.sml', 'peppolprod');
  const [pendingId, setPendingId] = useState(null);

  // Ouvre un identifiant dans l'onglet de recherche unitaire (depuis le tableau de lot)
  const openInSearch = useCallback((id) => {
    setPendingId(id);
    setTab('search');
    window.scrollTo({ top: 0 });
  }, []);
  const consumePending = useCallback(() => setPendingId(null), []);
  // Onglets hors du menu (mentions légales), ouverts depuis le pied de page ou « À propos »
  const showTab = useCallback((id) => {
    setTab(id);
    window.scrollTo({ top: 0 });
  }, []);

  return (
    // Sur mobile, marge basse pour la barre d'onglets fixe (et la zone du geste d'accueil des iPhone)
    <div className="flex min-h-screen flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
      <Header tabs={TABS} activeTab={tab} onTabChange={setTab} isDark={isDark} onToggleTheme={toggle} sml={sml} onSmlChange={setSml} />
      <main className="flex-1">
        {/* Les vues restent montées pour conserver leur état (lot en cours, résultat affiché…) */}
        <div hidden={tab !== 'search'}>
          <SearchView sml={sml} pendingId={pendingId} onPendingConsumed={consumePending} />
        </div>
        <div hidden={tab !== 'batch'}>
          <BatchView sml={sml} onOpen={openInSearch} />
        </div>
        <div hidden={tab !== 'about'}>
          <AboutView onStart={() => showTab('search')} onShowLegal={() => showTab('legal')} />
        </div>
        <div hidden={tab !== 'legal'}>
          <LegalView />
        </div>
      </main>
      <Disclaimer onShowLegal={() => showTab('legal')} />
      <MobileNav tabs={TABS} activeTab={tab} onTabChange={showTab} />
    </div>
  );
}
