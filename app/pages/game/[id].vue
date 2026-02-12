<script setup lang="ts">
import type { HexMapData } from '~/utils/hex-map-data'

const route = useRoute()
const gameId = route.params.id as string

const mapData = ref<HexMapData>()
const loading = ref(true)
const error = ref('')

const controller = new AbortController()

onBeforeUnmount(() => {
  controller.abort()
})

onMounted(async () => {
  try {
    const iterator = await rpcClient.game.subscribe({ gameId }, {
      signal: controller.signal
    })

    for await (const event of iterator) {
      if (event.type === 'mapReady') {
        mapData.value = buildMapData(
          event.mapData.tiles as Array<{ q: number, r: number, type: string }>,
          event.mapData.width,
          event.mapData.height
        )
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
  <div class="w-screen h-screen">
    <div
      v-if="error"
      class="flex items-center justify-center h-full text-red-500"
    >
      {{ error }}
    </div>

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

    <HexMap
      v-else-if="mapData"
      :map-data="mapData"
    />
  </div>
</template>
