<script setup lang="ts">
const route = useRoute()
const gameId = route.params.id as string

interface Tile {
  q: number
  r: number
  type: 'grass' | 'water' | 'mountain'
}

const tiles = ref<Tile[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  const controller = new AbortController()

  onBeforeUnmount(() => {
    controller.abort()
  })

  try {
    const iterator = await rpcClient.game.subscribe({ gameId }, {
      signal: controller.signal
    })

    for await (const event of iterator) {
      if (event.type === 'mapReady') {
        tiles.value = event.mapData.tiles as Tile[]
        loading.value = false
      }
    }
  } catch (e: unknown) {
    if (controller.signal.aborted) return
    error.value = e instanceof Error ? e.message : 'Соединение потеряно'
    loading.value = false
  }
})
</script>

<template>
  <div class="flex flex-col items-center gap-4 p-4">
    <h1 class="text-2xl font-bold">
      Игра
    </h1>

    <div
      v-if="error"
      class="text-red-500"
    >
      {{ error }}
    </div>

    <div
      v-else-if="loading"
      class="flex items-center gap-2"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin"
      />
      <span>Загрузка карты...</span>
    </div>

    <ClientOnly v-else>
      <HexMap :tiles="tiles" />
    </ClientOnly>
  </div>
</template>
