import type { RouterClient } from '@orpc/server'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createORPCVueColadaUtils } from '@orpc/vue-colada'
import type { router } from '../../server/rpc/router'

export type RpcClient = RouterClient<typeof router>

const link = new RPCLink({
  url: '/api/rpc',
  fetch: (input, init) => globalThis.fetch(input, { ...init, credentials: 'include' })
})

export const rpcClient: RpcClient = createORPCClient(link)

export const orpc = createORPCVueColadaUtils(rpcClient)
