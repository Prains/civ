export const useJoinPlayer = () => {
  const orpc = useORPC()
  return useMutation(orpc.player.join.mutationOptions({}))
}
