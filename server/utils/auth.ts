import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { anonymous } from 'better-auth/plugins'
import prisma from './prisma'

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  emailAndPassword: { enabled: true },
  plugins: [
    anonymous({ emailDomainName: 'anon.civ.local' })
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60
    }
  }
})
