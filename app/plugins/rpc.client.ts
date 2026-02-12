import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RpcClient } from '~/utils/rpc'

export default defineNuxtPlugin(() => {
  const link = new RPCLink({
    url: `${window.location.origin}/api/rpc`,
    fetch: (input, init) => globalThis.fetch(input, { ...init, credentials: 'include' })
  })

  const rpc: RpcClient = createORPCClient(link)

  return {
    provide: {
      rpc
    }
  }
})
