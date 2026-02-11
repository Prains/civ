import type { RouterClient } from '@orpc/server'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { router } from '../../server/rpc/router'

export type RpcClient = RouterClient<typeof router>

export default defineNuxtPlugin(() => {
  const sessionToken = useCookie('sessionToken')

  const link = new RPCLink({
    url: `${window.location.origin}/api/rpc`,
    headers: () => {
      const token = sessionToken.value
      return token ? { 'x-session-token': token } : {}
    }
  })

  const rpc: RpcClient = createORPCClient(link)

  return {
    provide: {
      rpc
    }
  }
})
