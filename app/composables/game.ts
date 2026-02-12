export const useStartGame = () => {
  const orpc = useORPC()
  return useMutation(orpc.game.start.mutationOptions({}))
}
