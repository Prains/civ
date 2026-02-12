<script setup lang="ts">
const session = authClient.useSession()
const { data: lobbies, isPending: loading } = useListLobbies()
const { mutateAsync: createLobbyAsync, isLoading: creating } = useCreateLobby()
const { mutateAsync: joinLobbyAsync } = useJoinLobby()

async function createLobby() {
  const lobby = await createLobbyAsync()
  await navigateTo(`/lobbies/${lobby.id}`)
}

async function joinLobby(lobbyId: string) {
  await joinLobbyAsync({ lobbyId })
  await navigateTo(`/lobbies/${lobbyId}`)
}

async function handleSignOut() {
  await authClient.signOut()
  await navigateTo('/auth/sign-in')
}
</script>

<template>
  <div class="mx-auto max-w-2xl p-6">
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold">
          Lobbies
        </h1>
        <UBadge
          v-if="session.data?.user"
          variant="subtle"
        >
          {{ session.data.user.name }}
        </UBadge>
      </div>
      <div class="flex gap-2">
        <UButton
          icon="i-lucide-plus"
          label="Create Lobby"
          :loading="creating"
          @click="createLobby"
        />
        <UButton
          icon="i-lucide-log-out"
          color="neutral"
          variant="ghost"
          @click="handleSignOut"
        />
      </div>
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
      v-else-if="(lobbies ?? []).length === 0"
      class="py-12 text-center text-neutral-500"
    >
      No lobbies available. Create one to get started.
    </div>

    <div
      v-else
      class="space-y-3"
    >
      <UCard
        v-for="lobby in lobbies ?? []"
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
