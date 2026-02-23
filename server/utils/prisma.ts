import { PrismaClient } from '~/generated/prisma/client'
import { PrismaBunSQLite } from '@synapsenwerkstatt/prisma-bun-sqlite-adapter'

const prismaClientSingleton = () => {
  const adapter = new PrismaBunSQLite({
    url: process.env.DATABASE_URL || 'file:./prisma/dev.db'
  })
  return new PrismaClient({ adapter })
}

// eslint-disable-next-line no-shadow-restricted-names
declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>
} & typeof global

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
