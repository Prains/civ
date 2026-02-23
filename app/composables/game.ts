import type { ClientPlayerState } from '#shared/game-types'

export const useStartGame = () => {
  return useMutation(orpc.game.start.mutationOptions({}))
}

export const useGameState = (gameId: string) => {
  const playerState = ref<ClientPlayerState | null>(null)
  const mapData = ref<{ width: number, height: number, terrain: number[], elevation: number[] } | null>(null)
  const loading = ref(true)
  const error = ref('')
  const controller = new AbortController()

  onMounted(async () => {
    try {
      const iterator = await rpcClient.game.subscribe({ gameId }, { signal: controller.signal })
      for await (const event of iterator) {
        if (event.type === 'mapReady') {
          mapData.value = event.mapData
          loading.value = false
        } else if (event.type === 'tick') {
          playerState.value = event.playerState
          loading.value = false
        }
      }
    } catch (e: unknown) {
      if (controller.signal.aborted) return
      error.value = e instanceof Error ? e.message : 'Connection lost'
      loading.value = false
    }
  })

  onBeforeUnmount(() => controller.abort())

  return { playerState, mapData, loading, error }
}

export const useRequestPause = () => {
  return useMutation(orpc.gameActions.requestPause.mutationOptions({}))
}

export const useRequestResume = () => {
  return useMutation(orpc.gameActions.requestResume.mutationOptions({}))
}

export const useSetSpeed = () => {
  return useMutation(orpc.gameActions.setSpeed.mutationOptions({}))
}
