import { useCallback, useState } from 'react';
import { Search, Layers, Info } from 'lucide-react';
import { Header } from './components/layout/Header.jsx';
import { Disclaimer } from './components/layout/Disclaimer.jsx';
import { SearchView } from './components/search/SearchView.jsx';
import { BatchView } from './components/batch/BatchView.jsx';
import { AboutView } from './components/about/AboutView.jsx';
import { useTheme } from './hooks/useTheme.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';

const TABS = [
  { id: 'search', label: 'Recherche', icon: Search },
  { id: 'batch', label: 'Recherche en lot', icon: Layers },
  { id: 'about', label: 'À propos', icon: Info },
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

  return (
    <div className="flex min-h-screen flex-col">
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
          <AboutView onStart={() => { setTab('search'); window.scrollTo({ top: 0 }); }} />
        </div>
      </main>
      <Disclaimer />
    </div>
  );
}
