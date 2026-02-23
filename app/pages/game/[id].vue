<script setup lang="ts">
const route = useRoute()
const gameId = route.params.id as string
const toast = useToast()

const session = authClient.useSession()
const { mapData: rawMapData, playerState, loading, error } = useGameState(gameId)

const hexMapData = computed(() => {
  if (!rawMapData.value) return null
  return buildMapData(
    rawMapData.value.terrain,
    rawMapData.value.elevation,
    rawMapData.value.width,
    rawMapData.value.height
  )
})

const currentPlayerId = computed(() => session.value.data?.user.id ?? '')

// --- Game mutations ---
const { mutateAsync: requestPause } = useRequestPause()
const { mutateAsync: requestResume } = useRequestResume()
const { mutateAsync: setSpeed } = useSetSpeed()

// --- Event handlers ---
async function onPause() {
  try {
    await requestPause({ gameId })
  } catch (e: unknown) {
    toast.add({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Не удалось поставить на паузу', color: 'error' })
  }
}

async function onResume() {
  try {
    await requestResume({ gameId })
  } catch (e: unknown) {
    toast.add({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Не удалось возобновить', color: 'error' })
  }
}

async function onSpeedChange(speed: number) {
  try {
    await setSpeed({ gameId, speed })
  } catch (e: unknown) {
    toast.add({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Не удалось изменить скорость', color: 'error' })
  }
}
</script>

<template>
  <div class="relative w-screen h-screen overflow-hidden">
    <!-- Error state -->
    <div
      v-if="error"
      class="flex items-center justify-center h-full text-red-500"
    >
      {{ error }}
    </div>

    <!-- Loading state -->
    <div
      v-else-if="loading"
      class="flex items-center justify-center h-full gap-2"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin"
      />
      <span>Загрузка карты...</span>
    </div>

    <!-- Game view -->
    <template v-else-if="hexMapData && playerState">
      <!-- Layer 0: HexMap canvas (fullscreen) -->
      <HexMap
        :map-data="hexMapData"
        :player-state="playerState"
        :current-player-id="currentPlayerId"
        @select-settlement="() => {}"
        @deselect="() => {}"
      />

      <!-- Layer 1: HUD bar -->
      <GameHud
        class="absolute top-0 left-0 right-0 z-10"
        :paused="playerState.paused"
        :speed="playerState.speed"
        :tick="playerState.tick"
        @pause="onPause"
        @resume="onResume"
        @speed-change="onSpeedChange"
      />
    </template>
  </div>
</template>
