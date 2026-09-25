import { useCallback, useEffect, useState } from 'react';
import { Search, Layers, Network } from 'lucide-react';
import { Header } from './components/layout/Header.jsx';
import { Disclaimer } from './components/layout/Disclaimer.jsx';
import { SearchView } from './components/search/SearchView.jsx';
import { BatchView } from './components/batch/BatchView.jsx';
import { KnownApsView } from './components/knownAps/KnownApsView.jsx';
import { useTheme } from './hooks/useTheme.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { getKnownAccessPoints } from './api.js';

const TABS = [
  { id: 'search', label: 'Recherche', icon: Search },
  { id: 'batch', label: 'Recherche en lot', icon: Layers },
  { id: 'known', label: "Points d'accès connus", icon: Network },
];

export default function App() {
  const { isDark, toggle } = useTheme();
  const [tab, setTab] = useState('search');
  const [sml, setSml] = useLocalStorage('paradar.sml', 'peppolprod');
  const [pendingId, setPendingId] = useState(null);
  const [known, setKnown] = useState({ items: [], loading: true });

  const loadKnown = useCallback(() => {
    getKnownAccessPoints()
      .then((res) => setKnown({ items: res.items, loading: false }))
      .catch(() => setKnown((k) => ({ ...k, loading: false })));
  }, []);
  useEffect(loadKnown, [loadKnown]);

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
          <SearchView sml={sml} pendingId={pendingId} onPendingConsumed={consumePending} onKnownChanged={loadKnown} />
        </div>
        <div hidden={tab !== 'batch'}>
          <BatchView sml={sml} onOpen={openInSearch} />
        </div>
        <div hidden={tab !== 'known'}>
          <KnownApsView items={known.items} loading={known.loading} onChange={(items) => setKnown({ items, loading: false })} />
        </div>
      </main>
      <Disclaimer />
    </div>
  );
}
