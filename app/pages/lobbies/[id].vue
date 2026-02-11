<script setup lang="ts">
const sessionToken = useCookie('sessionToken')
const playerId = useCookie('playerId')

if (!sessionToken.value) {
  navigateTo('/')
}

const route = useRoute()
const rpc = useRpc()
const lobbyId = route.params.id as string

const players = ref<Array<{ id: string, name: string }>>([])
const hostId = ref('')
const loading = ref(true)
const abortController = new AbortController()

async function fetchLobby() {
  try {
    const lobby = await rpc.lobby.get({ lobbyId })
    hostId.value = lobby.hostId
    players.value = lobby.players
  } finally {
    loading.value = false
  }
}

async function subscribeToLobby() {
  try {
    const iterator = await rpc.lobby.subscribe(
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

async function startGame() {
  const result = await rpc.game.start({ lobbyId })
  await navigateTo(`/game/${result.gameId}`)
}

async function leaveLobby() {
  await rpc.lobby.leave()
  await navigateTo('/lobbies')
}

const isHost = computed(() => playerId.value === hostId.value)

onMounted(() => {
  fetchLobby()
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
          Lobby Room
        </h1>
        <p class="text-sm text-neutral-500">
          {{ lobbyId.slice(0, 8) }}
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          v-if="isHost"
          icon="i-lucide-play"
          label="Start Game"
          @click="startGame"
        />
        <UButton
          icon="i-lucide-log-out"
          label="Leave"
          color="neutral"
          variant="outline"
          @click="leaveLobby"
        />
      </div>
    </div>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">
            Players
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
        Waiting for players...
      </div>

      <LobbyPlayerList
        v-else
        :players="players"
        :host-id="hostId"
      />
    </UCard>
  </div>
</template>
