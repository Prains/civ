export const useListLobbies = () => {
  const orpc = useORPC()
  return useQuery(orpc.lobby.list.queryOptions({}))
}

export const useGetLobby = (lobbyId: MaybeRefOrGetter<string>) => {
  const orpc = useORPC()
  return useQuery(orpc.lobby.get.queryOptions({
    input: computed(() => ({ lobbyId: toValue(lobbyId) }))
  }))
}

export const useCreateLobby = () => {
  const orpc = useORPC()
  return useMutation(orpc.lobby.create.mutationOptions({}))
}

export const useJoinLobby = () => {
  const orpc = useORPC()
  return useMutation(orpc.lobby.join.mutationOptions({}))
}

export const useLeaveLobby = () => {
  const orpc = useORPC()
  return useMutation(orpc.lobby.leave.mutationOptions({}))
}

export const invalidateLobbies = (queryCache: ReturnType<typeof useQueryCache>) => {
  const orpc = useORPC()
  return queryCache.invalidateQueries({ key: orpc.lobby.key() })
}
