import { RPCHandler } from '@orpc/server/fetch'
import { toWebRequest } from 'h3'
import { router } from '../../rpc/router'
import type { BaseContext } from '../../rpc/router'

const handler = new RPCHandler(router)

export default defineEventHandler(async (event) => {
  const request = toWebRequest(event)

  const { matched, response } = await handler.handle(request, {
    prefix: '/api/rpc',
    context: {
      sessionToken: getHeader(event, 'x-session-token') ?? null
    } satisfies BaseContext
  })

  if (matched) {
    return response
  }

  throw createError({ statusCode: 404, message: 'Not found' })
})
