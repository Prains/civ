<script setup lang="ts">
import type { BuildingType } from '#shared/game-types'
import { BUILDING_DEFS } from '#shared/building-defs'

interface Props {
  buildings: BuildingType[]
  maxSlots: number
}

const props = defineProps<Props>()

const remainingSlots = computed(() => props.maxSlots - props.buildings.length)

const buildingIcons: Record<BuildingType, string> = {
  farm: 'i-lucide-wheat',
  lumber_mill: 'i-lucide-axe',
  market: 'i-lucide-store',
  library: 'i-lucide-book-open',
  temple: 'i-lucide-church',
  barracks: 'i-lucide-swords',
  walls: 'i-lucide-brick-wall'
}

const buildingNames: Record<BuildingType, string> = {
  farm: 'Ферма',
  lumber_mill: 'Лесопилка',
  market: 'Рынок',
  library: 'Библиотека',
  temple: 'Храм',
  barracks: 'Казарма',
  walls: 'Стены'
}

function getBuildingEffect(type: BuildingType): string {
  const def = BUILDING_DEFS[type]
  const effects: string[] = []
  if (def.income.food > 0) effects.push(`+${def.income.food} еда`)
  if (def.income.production > 0) effects.push(`+${def.income.production} произв.`)
  if (def.income.gold > 0) effects.push(`+${def.income.gold} золото`)
  if (def.income.science > 0) effects.push(`+${def.income.science} наука`)
  if (def.income.culture > 0) effects.push(`+${def.income.culture} культура`)
  if (def.defenseBonus > 0) effects.push(`+${def.defenseBonus}% защита`)
  if (def.unlocks.length > 0) effects.push(`открывает: ${def.unlocks.join(', ')}`)
  return effects.join(', ')
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-xs font-medium text-neutral-300 uppercase tracking-wide">
        Здания
      </span>
      <span class="text-xs text-neutral-500">
        {{ buildings.length }} / {{ maxSlots }}
      </span>
    </div>

    <div
      v-if="buildings.length === 0"
      class="text-xs text-neutral-500 italic"
    >
      Нет построенных зданий
    </div>

    <div
      v-else
      class="flex flex-wrap gap-1.5"
    >
      <UTooltip
        v-for="building in buildings"
        :key="building"
        :text="`${buildingNames[building]}: ${getBuildingEffect(building)}`"
      >
        <UBadge
          color="primary"
          variant="subtle"
          size="sm"
        >
          <UIcon
            :name="buildingIcons[building]"
            class="size-3.5 mr-1"
          />
          {{ buildingNames[building] }}
        </UBadge>
      </UTooltip>
    </div>

    <div
      v-if="remainingSlots > 0"
      class="flex items-center gap-1"
    >
      <div
        v-for="i in remainingSlots"
        :key="i"
        class="size-6 rounded border border-dashed border-neutral-600 flex items-center justify-center"
      >
        <UIcon
          name="i-lucide-plus"
          class="size-3 text-neutral-600"
        />
      </div>
      <span class="text-[10px] text-neutral-500 ml-1">
        {{ remainingSlots }} свободных
      </span>
    </div>
  </div>
</template>
