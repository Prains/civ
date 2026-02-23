export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session } = await authClient.useSession(useFetch)
  const isAuthenticated = !!session.value

  if (isAuthenticated) {
    const isAnonymous = !!session.value?.user?.isAnonymous
    const authPages = ['/auth/sign-in', '/auth/sign-up']

    // Anonymous users can access auth pages to bind a real account
    if (authPages.includes(to.path)) {
      return isAnonymous ? undefined : navigateTo('/lobbies')
    }

    if (to.path === '/') {
      return navigateTo('/lobbies')
    }

    return
  }

  // Allow direct access to auth pages
  if (['/auth/sign-in', '/auth/sign-up'].includes(to.path)) {
    return
  }

  // Auto sign-in anonymously
  const { error } = await authClient.signIn.anonymous()
  if (error) {
    return navigateTo('/auth/sign-in')
  }

  if (to.path !== '/lobbies') {
    return navigateTo('/lobbies')
  }
})
