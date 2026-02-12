export default defineNuxtRouteMiddleware(async (to) => {
  const session = authClient.useSession()

  // On first load, wait for session fetch to complete
  if (session.isPending.value) {
    await until(session.isPending).toBe(false)
  }

  const isAuthenticated = !!session.data.value

  const publicRoutes = ['/auth/sign-in', '/auth/sign-up']

  if (!isAuthenticated && !publicRoutes.includes(to.path)) {
    return navigateTo('/auth/sign-in')
  }

  if (isAuthenticated && [...publicRoutes, '/'].includes(to.path)) {
    return navigateTo('/lobbies')
  }
})
