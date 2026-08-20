/**
 * Loading UI must not outlive the query it represents.
 * If cached/current data exists, render it even while a background refetch runs.
 * If the request failed and nothing is cached, show an error — never an infinite spinner.
 */
export function isInitialLoad(isPending: boolean, data: unknown) {
  return isPending && data === undefined;
}

export function isFailedLoad(isError: boolean, data: unknown) {
  return isError && data === undefined;
}
