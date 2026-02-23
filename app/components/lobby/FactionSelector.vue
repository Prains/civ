<script setup lang="ts">
import { FACTIONS } from '#shared/faction-defs'

defineProps<{
  selectedFactionId: string | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', factionId: string): void
}>()

const factionDisplayData: Record<string, { nameRu: string, philosophyRu: string, bonusSummary: string }> = {
  solar_empire: {
    nameRu: 'Солнечная Империя',
    philosophyRu: 'Экспансия и завоевание',
    bonusSummary: '+20% производство, -10% наука'
  },
  merchant_league: {
    nameRu: 'Торговая Лига',
    philosophyRu: 'Золото решает все',
    bonusSummary: '+30% золото, -15% боевая сила'
  },
  forest_keepers: {
    nameRu: 'Хранители Леса',
    philosophyRu: 'Качество важнее количества',
    bonusSummary: '+20% культура, +15% защита'
  },
  seekers: {
    nameRu: 'Искатели',
    philosophyRu: 'Наука и прогресс',
    bonusSummary: '+30% наука, -15% производство'
  }
}

const factions = Object.values(FACTIONS).map(f => ({
  ...f,
  display: factionDisplayData[f.id] as { nameRu: string, philosophyRu: string, bonusSummary: string }
}))
</script>

<template>
  <div class="grid grid-cols-2 gap-3">
    <UCard
      v-for="faction in factions"
      :key="faction.id"
      class="cursor-pointer transition-colors"
      :class="[
        selectedFactionId === faction.id
          ? 'ring-2 ring-primary'
          : 'hover:ring-1 hover:ring-neutral-300 dark:hover:ring-neutral-600'
      ]"
      :ui="{
        root: disabled ? 'opacity-60 pointer-events-none' : ''
      }"
      @click="!disabled && emit('select', faction.id)"
    >
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">
            {{ faction.display.nameRu }}
          </h3>
          <UIcon
            v-if="selectedFactionId === faction.id"
            name="i-lucide-check-circle"
            class="size-4 text-primary"
          />
        </div>
        <p class="text-xs text-neutral-500">
          {{ faction.display.philosophyRu }}
        </p>
        <UBadge
          size="xs"
          variant="subtle"
          color="neutral"
        >
          {{ faction.display.bonusSummary }}
        </UBadge>
      </div>
    </UCard>
  </div>
</template>
