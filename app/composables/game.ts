export const useStartGame = () => {
  return useMutation(orpc.game.start.mutationOptions({}))
}
