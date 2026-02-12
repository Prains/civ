<script setup lang="ts">
const session = authClient.useSession()

const route = useRoute()
const lobbyId = route.params.id as string

const { data: lobby, isPending: loading } = useGetLobby(lobbyId)

const players = ref<Array<{ id: string, name: string }>>([])
const hostId = ref('')

watch(lobby, (val) => {
  if (val) {
    hostId.value = val.hostId
    players.value = val.players
  }
}, { immediate: true })

const client = useRpcClient()
const abortController = new AbortController()

async function subscribeToLobby() {
  try {
    const iterator = await client.lobby.subscribe(
      { lobbyId },
      { signal: abortController.signal }
    )

    for await (const event of iterator) {
      if (event.type === 'playerJoined') {
        const exists = players.value.some(p => p.id === event.player.id)
        if (!exists) {
          players.value.push(event.player)
        }
      } else if (event.type === 'playerLeft') {
        players.value = players.value.filter(p => p.id !== event.playerId)
      } else if (event.type === 'gameStarted') {
        await navigateTo(`/game/${event.gameId}`)
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error('Subscription error:', err)
    }
  }
}

const { mutateAsync: startGameAsync } = useStartGame()
const { mutateAsync: leaveLobbyAsync } = useLeaveLobby()

async function handleStart() {
  const result = await startGameAsync({ lobbyId })
  await navigateTo(`/game/${result.gameId}`)
}

async function handleLeave() {
  await leaveLobbyAsync()
  await navigateTo('/lobbies')
}

const isHost = computed(() => session.value.data?.user.id === hostId.value)

onMounted(() => {
  subscribeToLobby()
})

onUnmounted(() => {
  abortController.abort()
})
</script>

<template>
  <div class="mx-auto max-w-2xl p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">
          Комната лобби
        </h1>
        <p class="text-sm text-neutral-500">
          {{ lobbyId.slice(0, 8) }}
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          v-if="isHost"
          icon="i-lucide-play"
          label="Начать игру"
          @click="handleStart"
        />
        <UButton
          icon="i-lucide-log-out"
          label="Выйти"
          color="neutral"
          variant="outline"
          @click="handleLeave"
        />
      </div>
    </div>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">
            Игроки
          </h2>
          <UBadge variant="subtle">
            {{ players.length }}
          </UBadge>
        </div>
      </template>

      <div
        v-if="loading"
        class="flex justify-center py-4"
      >
        <UIcon
          name="i-lucide-loader"
          class="size-6 animate-spin text-neutral-400"
        />
      </div>

      <div
        v-else-if="players.length === 0"
        class="py-4 text-center text-neutral-500"
      >
        Ожидание игроков...
      </div>

      <LobbyPlayerList
        v-else
        :players="players"
        :host-id="hostId"
      />
    </UCard>
  </div>
</template>
