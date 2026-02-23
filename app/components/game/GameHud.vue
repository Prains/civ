<script setup lang="ts">
defineProps<{
  paused: boolean
  speed: number
  tick: number
}>()

const emit = defineEmits<{
  (e: 'pause' | 'resume'): void
  (e: 'speed-change', speed: number): void
}>()

const speedOptions = [0.5, 1, 2, 3]
</script>

<template>
  <div class="absolute inset-0 pointer-events-none z-10">
    <!-- Bottom controls -->
    <div class="absolute bottom-4 left-4 flex items-center gap-2 pointer-events-auto">
      <!-- Pause / Resume -->
      <UButton
        :icon="paused ? 'i-lucide-play' : 'i-lucide-pause'"
        :color="paused ? 'primary' : 'neutral'"
        variant="solid"
        size="sm"
        @click="paused ? emit('resume') : emit('pause')"
      >
        {{ paused ? 'Продолжить' : 'Пауза' }}
      </UButton>

      <!-- Speed controls -->
      <div class="flex items-center gap-1 bg-neutral-900/90 backdrop-blur-sm rounded-lg px-2 py-1 border border-neutral-700/50">
        <UButton
          v-for="s in speedOptions"
          :key="s"
          :variant="speed === s ? 'solid' : 'ghost'"
          :color="speed === s ? 'primary' : 'neutral'"
          size="xs"
          @click="emit('speed-change', s)"
        >
          {{ s }}x
        </UButton>
      </div>

      <!-- Tick display -->
      <UBadge
        color="neutral"
        variant="subtle"
        size="md"
      >
        <UIcon
          name="i-lucide-clock"
          class="size-3.5 mr-1"
        />
        Ход {{ tick }}
      </UBadge>
    </div>
  </div>
</template>
