import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type GlobalSearchContextValue = { query: string; setQuery: (value: string) => void; activeModule: string; setActiveModule: (value: string) => void; clear: () => void };
const GlobalSearchContext = createContext<GlobalSearchContextValue | undefined>(undefined);

export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('');
  const [activeModule, setActiveModule] = useState('');
  const clear = useCallback(() => setQuery(''), []);
  const value = useMemo(() => ({ query, setQuery, activeModule, setActiveModule, clear }), [query, activeModule, clear]);
  return <GlobalSearchContext.Provider value={value}>{children}</GlobalSearchContext.Provider>;
}

export function useGlobalSearch() {
  const context = useContext(GlobalSearchContext);
  if (!context) throw new Error('useGlobalSearch must be used within GlobalSearchProvider');
  return context;
}
