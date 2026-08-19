import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { synchronizeData, type SyncScope } from '../services/dataSync';

/** Shared imperative bridge for the few legacy screens that perform an async API action directly. */
export function useDataSync() {
  const queryClient = useQueryClient();
  return useCallback((scopes: readonly SyncScope[]) => synchronizeData(queryClient, scopes), [queryClient]);
}
