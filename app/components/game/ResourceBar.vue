<script setup lang="ts">
interface ResourceValues {
  food: number
  production: number
  gold: number
  science: number
  culture: number
}

defineProps<{
  resources: ResourceValues
  income: ResourceValues
  upkeep: ResourceValues
}>()

const resourceConfig = [
  { key: 'food' as const, icon: 'i-lucide-wheat', label: 'Еда' },
  { key: 'production' as const, icon: 'i-lucide-hammer', label: 'Производство' },
  { key: 'gold' as const, icon: 'i-lucide-coins', label: 'Золото' },
  { key: 'science' as const, icon: 'i-lucide-flask-conical', label: 'Наука' },
  { key: 'culture' as const, icon: 'i-lucide-palette', label: 'Культура' }
]

function netIncome(income: number, upkeep: number): number {
  return income - upkeep
}

function formatNet(value: number): string {
  if (value > 0) return `+${value}`
  return `${value}`
}
</script>

<template>
  <div class="flex items-center justify-evenly bg-neutral-900/90 backdrop-blur-sm px-4 py-2 border-b border-neutral-700/50">
    <UTooltip
      v-for="res in resourceConfig"
      :key="res.key"
      :text="res.label"
    >
      <div class="flex items-center gap-1.5 px-2">
        <UIcon
          :name="res.icon"
          class="size-4 text-neutral-300"
        />
        <span class="text-sm font-medium text-white tabular-nums">
          {{ resources[res.key] }}
        </span>
        <span
          class="text-xs tabular-nums"
          :class="[
            netIncome(income[res.key], upkeep[res.key]) > 0 ? 'text-green-400' : '',
            netIncome(income[res.key], upkeep[res.key]) < 0 ? 'text-red-400' : '',
            netIncome(income[res.key], upkeep[res.key]) === 0 ? 'text-neutral-500' : ''
          ]"
        >
          {{ formatNet(netIncome(income[res.key], upkeep[res.key])) }}
        </span>
      </div>
    </UTooltip>
  </div>
</template>
