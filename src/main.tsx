import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './context/ToastContext';
import { GlobalSearchProvider } from './context/GlobalSearchContext';
import './styles/index.css';

// The desktop API is local and remains available without internet access.
// React Query's default "online" network mode would pause localhost requests
// whenever Windows/Chromium reports that the computer is offline, leaving
// screens stuck with missing or zero-value data until they are remounted.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',
      retry: 2,
      retryDelay: (attempt) => Math.min(300 * 2 ** attempt, 1500),
      staleTime: 0,
      refetchOnMount: 'always',
      // The API runs inside this desktop application. Browser online/focus
      // events are unrelated to API availability and can otherwise cause
      // repeated background fetches that leave loading labels on screen.
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      // Always publish data and status changes to mounted screens. This is a
      // small desktop app, so correctness is more useful than tracked-property
      // render optimisation.
      notifyOnChangeProps: 'all'
    },
    mutations: {
      networkMode: 'always',
      retry: 0
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <GlobalSearchProvider>
            <ToastProvider><App /></ToastProvider>
          </GlobalSearchProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
