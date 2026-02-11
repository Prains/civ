import { PrismaClient } from '~/generated/prisma/client'

const prismaClientSingleton = () => {
  // @ts-expect-error -- Prisma v7 generated type requires options but runtime allows empty call
  return new PrismaClient()
}

// eslint-disable-next-line no-shadow-restricted-names
declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>
} & typeof global

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
