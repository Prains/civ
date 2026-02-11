<script setup lang="ts">
const sessionToken = useCookie('sessionToken')

if (!sessionToken.value) {
  navigateTo('/')
}

const rpc = useRpc()
const lobbies = ref<Array<{ id: string, hostId: string, playerCount: number, createdAt: Date }>>([])
const loading = ref(true)
const creating = ref(false)

async function fetchLobbies() {
  try {
    lobbies.value = await rpc.lobby.list()
  } finally {
    loading.value = false
  }
}

async function createLobby() {
  creating.value = true
  try {
    const lobby = await rpc.lobby.create()
    await navigateTo(`/lobbies/${lobby.id}`)
  } finally {
    creating.value = false
  }
}

async function joinLobby(lobbyId: string) {
  await rpc.lobby.join({ lobbyId })
  await navigateTo(`/lobbies/${lobbyId}`)
}

onMounted(() => {
  fetchLobbies()
})
</script>

<template>
  <div class="mx-auto max-w-2xl p-6">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">
        Lobbies
      </h1>
      <UButton
        icon="i-lucide-plus"
        label="Create Lobby"
        :loading="creating"
        @click="createLobby"
      />
    </div>

    <div
      v-if="loading"
      class="flex justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader"
        class="size-8 animate-spin text-neutral-400"
      />
    </div>

    <div
      v-else-if="lobbies.length === 0"
      class="py-12 text-center text-neutral-500"
    >
      No lobbies available. Create one to get started.
    </div>

    <div
      v-else
      class="space-y-3"
    >
      <UCard
        v-for="lobby in lobbies"
        :key="lobby.id"
        class="cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800"
        @click="joinLobby(lobby.id)"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">
              Lobby
            </p>
            <p class="text-sm text-neutral-500">
              {{ lobby.id.slice(0, 8) }}
            </p>
          </div>
          <UBadge variant="subtle">
            {{ lobby.playerCount }} {{ lobby.playerCount === 1 ? 'player' : 'players' }}
          </UBadge>
        </div>
      </UCard>
    </div>
  </div>
</template>
