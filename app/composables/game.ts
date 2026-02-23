import type { ClientPlayerState, GameEvent } from '#shared/game-types'

export const useStartGame = () => {
  return useMutation(orpc.game.start.mutationOptions({}))
}

export const useGameState = (gameId: string) => {
  const playerState = ref<ClientPlayerState | null>(null)
  const mapData = ref<{ width: number, height: number, terrain: number[], elevation: number[] } | null>(null)
  const loading = ref(true)
  const error = ref('')
  const gameEvents = ref<GameEvent[]>([])
  const controller = new AbortController()

  const MAX_EVENTS = 100

  function addEvent(event: GameEvent) {
    gameEvents.value.push(event)
    if (gameEvents.value.length > MAX_EVENTS) {
      gameEvents.value.shift()
    }
  }

  function showEventToast(event: GameEvent) {
    const toast = useToast()
    switch (event.type) {
      case 'techResearched':
        toast.add({ title: 'Технология исследована', color: 'info' })
        break
      case 'lawPassed':
        toast.add({ title: 'Закон принят', color: 'success' })
        break
      case 'lawRejected':
        toast.add({ title: 'Закон отклонён', color: 'warning' })
        break
      case 'warDeclared':
        toast.add({ title: 'Объявлена война!', color: 'error' })
        break
      case 'peaceDeclared':
        toast.add({ title: 'Заключён мир', color: 'success' })
        break
      case 'playerEliminated':
        toast.add({ title: 'Игрок выбыл из игры', color: 'warning' })
        break
      case 'victory':
        toast.add({ title: 'Победа!', description: `Тип победы: ${event.victoryType}`, color: 'success' })
        break
    }
  }

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
        } else {
          addEvent(event)
          showEventToast(event)
        }
      }
    } catch (e: unknown) {
      if (controller.signal.aborted) return
      error.value = e instanceof Error ? e.message : 'Connection lost'
      loading.value = false
    }
  })

  onBeforeUnmount(() => controller.abort())

  return { playerState, mapData, loading, error, gameEvents }
}

// Mutation composables for game actions
export const useBuyUnit = () => {
  return useMutation(orpc.gameActions.buyUnit.mutationOptions({}))
}

export const useBuildBuilding = () => {
  return useMutation(orpc.gameActions.buildBuilding.mutationOptions({}))
}

export const useSetPolicies = () => {
  return useMutation(orpc.gameActions.setPolicies.mutationOptions({}))
}

export const useStartResearch = () => {
  return useMutation(orpc.gameActions.startResearch.mutationOptions({}))
}

export const useProposeLaw = () => {
  return useMutation(orpc.gameActions.proposeLaw.mutationOptions({}))
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
