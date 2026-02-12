export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session } = await authClient.useSession(useFetch)

  const isAuthenticated = !!session.value

  const publicRoutes = ['/auth/sign-in', '/auth/sign-up']

  if (!isAuthenticated && !publicRoutes.includes(to.path)) {
    return navigateTo('/auth/sign-in')
  }

  if (isAuthenticated && [...publicRoutes, '/'].includes(to.path)) {
    return navigateTo('/lobbies')
  }
})
