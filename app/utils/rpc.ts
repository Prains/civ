import type { RouterClient } from '@orpc/server'
import { createORPCVueColadaUtils } from '@orpc/vue-colada'
import type { router } from '../../server/rpc/router'

export type RpcClient = RouterClient<typeof router>

/**
 * Vue Colada utils — provides .queryOptions(), .mutationOptions(), .key() for all procedures.
 * Must be called after plugin initialization (in components/composables, not at module scope).
 */
export function useORPC() {
  const client = useNuxtApp().$rpc as RpcClient
  return createORPCVueColadaUtils(client)
}

/**
 * Raw oRPC client for imperative (non-reactive) calls.
 */
export function useRpcClient(): RpcClient {
  return useNuxtApp().$rpc as RpcClient
}
