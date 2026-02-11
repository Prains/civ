import type { RpcClient } from '../plugins/rpc'

export function useRpc(): RpcClient {
  return useNuxtApp().$rpc as RpcClient
}
