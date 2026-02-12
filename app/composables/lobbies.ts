export const useListLobbies = () => {
  return useQuery(orpc.lobby.list.queryOptions({}))
}

export const useGetLobby = (lobbyId: MaybeRefOrGetter<string>) => {
  return useQuery(orpc.lobby.get.queryOptions({
    input: computed(() => ({ lobbyId: toValue(lobbyId) }))
  }))
}

export const useCreateLobby = () => {
  return useMutation(orpc.lobby.create.mutationOptions({}))
}

export const useJoinLobby = () => {
  return useMutation(orpc.lobby.join.mutationOptions({}))
}

export const useLeaveLobby = () => {
  return useMutation(orpc.lobby.leave.mutationOptions({}))
}

export const invalidateLobbies = (queryCache: ReturnType<typeof useQueryCache>) => {
  return queryCache.invalidateQueries({ key: orpc.lobby.key() })
}
