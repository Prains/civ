import type { RpcClient } from '../plugins/rpc.client'

export function useRpc(): RpcClient {
  return useNuxtApp().$rpc as RpcClient
}
