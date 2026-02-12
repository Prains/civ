export default defineNuxtRouteMiddleware(async (to) => {
  const session = authClient.useSession()

  // On first load, wait for session fetch to complete
  if (session.value.isPending) {
    await until(() => session.value.isPending).toBe(false)
  }

  const isAuthenticated = !!session.value.data

  const publicRoutes = ['/auth/sign-in', '/auth/sign-up']

  if (!isAuthenticated && !publicRoutes.includes(to.path)) {
    return navigateTo('/auth/sign-in')
  }

  if (isAuthenticated && [...publicRoutes, '/'].includes(to.path)) {
    return navigateTo('/lobbies')
  }
})
