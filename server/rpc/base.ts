import { ORPCError, os } from '@orpc/server'
import { auth } from '../utils/auth'

type AuthSession = typeof auth.$Infer.Session

export interface BaseContext {
  headers: Headers
}

export interface AuthedContext extends BaseContext {
  user: AuthSession['user']
  session: AuthSession['session']
}

export const publicProcedure = os.$context<BaseContext>()

export const authedProcedure = publicProcedure.use(async ({ context, next }) => {
  const session = await auth.api.getSession({
    headers: context.headers
  })

  if (!session) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Необходима авторизация' })
  }

  return next({ context: { user: session.user, session: session.session } })
})
