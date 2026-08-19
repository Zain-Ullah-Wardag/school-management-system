import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { synchronizeData, type SyncScope } from '../services/dataSync';

type MutationToastOptions<TData, TVariables> = {
  success?: string;
  /** Business resources affected by this mutation. Required for every mutation. */
  sync: SyncScope[];
  /** Runs only after active affected screens have received their synchronized refetch. */
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
};

/**
 * The common mutation boundary for the application.
 *
 * API mutations are not allowed to leave a success toast behind while their
 * mounted list/detail/summary queries are stale. The central data-sync map
 * invalidates every related resource family and awaits active refetches first.
 */
export function useMutationToast<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: MutationToastOptions<TData, TVariables>
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      await synchronizeData(queryClient, options.sync);
      await options.onSuccess?.(data, variables);
      if (options.success) toast('success', options.success);
    },
    onError: (error) => toast('error', 'Action could not be completed', apiError(error))
  });
}
