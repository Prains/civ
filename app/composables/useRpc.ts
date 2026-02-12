/**
 * @deprecated Use `useORPC()` for reactive queries/mutations, or `useRpcClient()` for imperative calls.
 */
export function useRpc() {
  return useRpcClient()
}
