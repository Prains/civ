<script setup lang="ts">
import type { AdvisorType } from '~/shared/game-types'

interface Props {
  advisor: { type: AdvisorType, loyalty: number }
}

const props = defineProps<Props>()

const advisorNames: Record<AdvisorType, string> = {
  general: 'Генерал',
  treasurer: 'Казначей',
  priest: 'Жрец',
  scholar: 'Учёный',
  tribune: 'Трибун'
}

const advisorDomains: Record<AdvisorType, string> = {
  general: 'Военное дело',
  treasurer: 'Экономика',
  priest: 'Религия',
  scholar: 'Наука',
  tribune: 'Народ'
}

const advisorIcons: Record<AdvisorType, string> = {
  general: 'i-lucide-swords',
  treasurer: 'i-lucide-coins',
  priest: 'i-lucide-church',
  scholar: 'i-lucide-book-open',
  tribune: 'i-lucide-users'
}

const loyaltyColor = computed(() => {
  if (props.advisor.loyalty >= 70) return 'bg-green-500'
  if (props.advisor.loyalty >= 30) return 'bg-yellow-500'
  return 'bg-red-500'
})

const loyaltyLabel = computed(() => {
  if (props.advisor.loyalty >= 70) return 'Верен'
  if (props.advisor.loyalty >= 30) return 'Нейтрален'
  return 'Нелоялен'
})

const loyaltyTextColor = computed(() => {
  if (props.advisor.loyalty >= 70) return 'text-green-400'
  if (props.advisor.loyalty >= 30) return 'text-yellow-400'
  return 'text-red-400'
})
</script>

<template>
  <div class="flex flex-col items-center gap-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700/50 p-3 min-w-[100px]">
    <UIcon
      :name="advisorIcons[advisor.type]"
      class="size-6 text-neutral-300"
    />

    <span class="text-xs font-semibold text-neutral-200">
      {{ advisorNames[advisor.type] }}
    </span>

    <span class="text-[10px] text-neutral-500">
      {{ advisorDomains[advisor.type] }}
    </span>

    <UTooltip :text="`${loyaltyLabel}: ${advisor.loyalty}/100`">
      <div class="w-full space-y-0.5">
        <div class="h-1.5 w-full rounded-full bg-neutral-700 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="loyaltyColor"
            :style="{ width: `${advisor.loyalty}%` }"
          />
        </div>
        <div class="flex items-center justify-between">
          <span
            class="text-[10px] font-medium"
            :class="loyaltyTextColor"
          >
            {{ loyaltyLabel }}
          </span>
          <span class="text-[10px] text-neutral-500 tabular-nums">
            {{ advisor.loyalty }}
          </span>
        </div>
      </div>
    </UTooltip>
  </div>
</template>
