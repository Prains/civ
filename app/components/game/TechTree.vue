<script setup lang="ts">
import type { FactionId, TechNode, TechEffect } from '#shared/game-types'
import { TECH_TREE, getEpochTechs, getAvailableTechs } from '#shared/tech-tree'
import { FACTIONS } from '#shared/faction-defs'

interface Props {
  researchedTechs: string[]
  currentResearch: string | null
  researchProgress: number
  factionId: FactionId
  gameId: string
}

interface Emits {
  (e: 'start-research', techId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isOpen = ref(false)

const availableTechIds = computed(() => {
  const available = getAvailableTechs(props.researchedTechs, props.factionId)
  return new Set(available.map(t => t.id))
})

const researchedSet = computed(() => new Set(props.researchedTechs))

const epoch1Techs = computed(() => getEpochTechs(1))
const epoch2Techs = computed(() => getEpochTechs(2))
const epoch3Techs = computed(() => getEpochTechs(3))

const factionTechs = computed(() => {
  return Object.values(TECH_TREE).filter(t => t.factionOnly === props.factionId)
})

const factionName = computed(() => FACTIONS[props.factionId].name)

type TechStatus = 'researched' | 'current' | 'available' | 'locked'

function getTechStatus(techId: string): TechStatus {
  if (researchedSet.value.has(techId)) return 'researched'
  if (props.currentResearch === techId) return 'current'
  if (availableTechIds.value.has(techId)) return 'available'
  return 'locked'
}

function statusClasses(status: TechStatus): string {
  switch (status) {
    case 'researched':
      return 'border-green-500/70 bg-green-950/40 shadow-green-500/20 shadow-sm'
    case 'current':
      return 'border-primary-500/70 bg-primary-950/40 shadow-primary-500/20 shadow-sm animate-pulse'
    case 'available':
      return 'border-primary-500/50 bg-primary-950/20 hover:bg-primary-950/40 cursor-pointer hover:shadow-primary-500/20 hover:shadow-sm'
    case 'locked':
      return 'border-neutral-700/50 bg-neutral-900/40 opacity-60'
  }
}

function statusBadge(status: TechStatus): { label: string, color: 'success' | 'primary' | 'neutral' } {
  switch (status) {
    case 'researched':
      return { label: 'Изучено', color: 'success' }
    case 'current':
      return { label: 'Изучается...', color: 'primary' }
    case 'available':
      return { label: 'Доступно', color: 'primary' }
    case 'locked':
      return { label: 'Заблокировано', color: 'neutral' }
  }
}

function handleTechClick(tech: TechNode) {
  const status = getTechStatus(tech.id)
  if (status === 'available') {
    emit('start-research', tech.id)
  }
}

function currentProgress(tech: TechNode): number {
  if (props.currentResearch !== tech.id) return 0
  return Math.min(100, Math.round((props.researchProgress / tech.scienceCost) * 100))
}

function formatEffect(effect: TechEffect): string {
  switch (effect.type) {
    case 'unlock_building':
      return `Открывает здание: ${effect.target}`
    case 'unlock_unit':
      return `Открывает юнит: ${effect.target}`
    case 'unlock_improvement':
      return `Открывает улучшение: ${effect.target}`
    case 'modifier':
      return `${effect.target}: ${effect.value && effect.value > 1 ? '+' : ''}${effect.value}`
    case 'victory_progress':
      return `Прогресс к победе: ${effect.target}`
    default:
      return `${effect.type}: ${effect.target}`
  }
}

function prerequisiteNames(tech: TechNode): string {
  if (tech.requires.length === 0) return ''
  return tech.requires
    .map(id => TECH_TREE[id]?.name ?? id)
    .join(', ')
}

const epochs = computed(() => [
  { number: 1, label: 'Эпоха 1: Основы', techs: epoch1Techs.value },
  { number: 2, label: 'Эпоха 2: Развитие', techs: epoch2Techs.value },
  { number: 3, label: 'Эпоха 3: Расцвет', techs: epoch3Techs.value }
])
</script>

<template>
  <div class="absolute right-4 top-16 z-10">
    <UButton
      :icon="isOpen ? 'i-lucide-panel-right-close' : 'i-lucide-flask-conical'"
      variant="soft"
      color="neutral"
      size="sm"
      class="mb-2"
      @click="isOpen = !isOpen"
    >
      {{ isOpen ? '' : 'Технологии' }}
    </UButton>

    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 translate-x-4"
      enter-to-class="opacity-100 translate-x-0"
      leave-from-class="opacity-100 translate-x-0"
      leave-to-class="opacity-0 translate-x-4"
    >
      <div
        v-if="isOpen"
        class="w-[720px] max-h-[calc(100vh-8rem)] overflow-y-auto bg-neutral-900/95 backdrop-blur-sm rounded-lg border border-neutral-700/50 p-4 space-y-4"
      >
        <!-- Header -->
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-neutral-200 uppercase tracking-wide flex items-center gap-2">
            <UIcon
              name="i-lucide-flask-conical"
              class="size-4"
            />
            Древо технологий
          </h3>
          <div
            v-if="currentResearch"
            class="flex items-center gap-2"
          >
            <span class="text-xs text-neutral-400">Исследуется:</span>
            <UBadge
              color="primary"
              variant="subtle"
              size="xs"
            >
              {{ TECH_TREE[currentResearch]?.name }}
            </UBadge>
          </div>
        </div>

        <USeparator />

        <!-- Epoch rows -->
        <div
          v-for="epoch in epochs"
          :key="epoch.number"
          class="space-y-2"
        >
          <h4 class="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            {{ epoch.label }}
          </h4>

          <div class="grid grid-cols-4 gap-2">
            <UTooltip
              v-for="tech in epoch.techs"
              :key="tech.id"
            >
              <div
                class="relative rounded-lg border p-3 transition-all duration-150"
                :class="statusClasses(getTechStatus(tech.id))"
                @click="handleTechClick(tech)"
              >
                <!-- Tech name -->
                <div class="flex items-center justify-between gap-1 mb-1">
                  <span class="text-xs font-medium text-neutral-100 truncate">
                    {{ tech.name }}
                  </span>
                  <UIcon
                    v-if="getTechStatus(tech.id) === 'researched'"
                    name="i-lucide-check-circle"
                    class="size-3.5 text-green-400 shrink-0"
                  />
                </div>

                <!-- Science cost -->
                <div class="flex items-center gap-1 mb-1.5">
                  <UIcon
                    name="i-lucide-flask-conical"
                    class="size-3 text-neutral-400"
                  />
                  <span class="text-[10px] text-neutral-400 tabular-nums">
                    {{ tech.scienceCost }}
                  </span>
                </div>

                <!-- Status badge -->
                <UBadge
                  :color="statusBadge(getTechStatus(tech.id)).color"
                  variant="subtle"
                  size="xs"
                >
                  {{ statusBadge(getTechStatus(tech.id)).label }}
                </UBadge>

                <!-- Progress bar for current research -->
                <div
                  v-if="getTechStatus(tech.id) === 'current'"
                  class="mt-2"
                >
                  <UProgress
                    :model-value="currentProgress(tech)"
                    size="xs"
                    color="primary"
                  />
                  <span class="text-[10px] text-neutral-400 tabular-nums">
                    {{ researchProgress }} / {{ tech.scienceCost }}
                  </span>
                </div>
              </div>

              <!-- Tooltip content -->
              <template #content>
                <div class="max-w-xs space-y-1.5 p-1">
                  <div class="font-medium text-sm">
                    {{ tech.name }}
                  </div>
                  <div class="text-xs text-neutral-400 flex items-center gap-1">
                    <UIcon
                      name="i-lucide-flask-conical"
                      class="size-3"
                    />
                    Стоимость: {{ tech.scienceCost }}
                  </div>
                  <div
                    v-if="tech.requires.length > 0"
                    class="text-xs text-neutral-400"
                  >
                    Требуется: {{ prerequisiteNames(tech) }}
                  </div>
                  <USeparator class="my-1" />
                  <div class="space-y-0.5">
                    <div
                      v-for="(effect, idx) in tech.effects"
                      :key="idx"
                      class="text-xs text-neutral-300"
                    >
                      {{ formatEffect(effect) }}
                    </div>
                  </div>
                </div>
              </template>
            </UTooltip>
          </div>
        </div>

        <USeparator />

        <!-- Faction branch -->
        <div class="space-y-2">
          <h4 class="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <UIcon
              name="i-lucide-shield"
              class="size-3.5"
            />
            Ветка фракции: {{ factionName }}
          </h4>

          <div class="grid grid-cols-4 gap-2">
            <UTooltip
              v-for="tech in factionTechs"
              :key="tech.id"
            >
              <div
                class="relative rounded-lg border p-3 transition-all duration-150"
                :class="statusClasses(getTechStatus(tech.id))"
                @click="handleTechClick(tech)"
              >
                <!-- Tech name -->
                <div class="flex items-center justify-between gap-1 mb-1">
                  <span class="text-xs font-medium text-neutral-100 truncate">
                    {{ tech.name }}
                  </span>
                  <UIcon
                    v-if="getTechStatus(tech.id) === 'researched'"
                    name="i-lucide-check-circle"
                    class="size-3.5 text-green-400 shrink-0"
                  />
                </div>

                <!-- Science cost -->
                <div class="flex items-center gap-1 mb-1.5">
                  <UIcon
                    name="i-lucide-flask-conical"
                    class="size-3 text-neutral-400"
                  />
                  <span class="text-[10px] text-neutral-400 tabular-nums">
                    {{ tech.scienceCost }}
                  </span>
                </div>

                <!-- Prerequisite arrow indicator -->
                <div
                  v-if="tech.requires.length > 0"
                  class="flex items-center gap-0.5 mb-1"
                >
                  <UIcon
                    name="i-lucide-arrow-left"
                    class="size-2.5 text-neutral-500"
                  />
                  <span class="text-[9px] text-neutral-500 truncate">
                    {{ TECH_TREE[tech.requires[0]!]?.name }}
                  </span>
                </div>

                <!-- Status badge -->
                <UBadge
                  :color="statusBadge(getTechStatus(tech.id)).color"
                  variant="subtle"
                  size="xs"
                >
                  {{ statusBadge(getTechStatus(tech.id)).label }}
                </UBadge>

                <!-- Progress bar for current research -->
                <div
                  v-if="getTechStatus(tech.id) === 'current'"
                  class="mt-2"
                >
                  <UProgress
                    :model-value="currentProgress(tech)"
                    size="xs"
                    color="primary"
                  />
                  <span class="text-[10px] text-neutral-400 tabular-nums">
                    {{ researchProgress }} / {{ tech.scienceCost }}
                  </span>
                </div>
              </div>

              <!-- Tooltip content -->
              <template #content>
                <div class="max-w-xs space-y-1.5 p-1">
                  <div class="font-medium text-sm">
                    {{ tech.name }}
                  </div>
                  <UBadge
                    color="neutral"
                    variant="outline"
                    size="xs"
                  >
                    {{ factionName }}
                  </UBadge>
                  <div class="text-xs text-neutral-400 flex items-center gap-1">
                    <UIcon
                      name="i-lucide-flask-conical"
                      class="size-3"
                    />
                    Стоимость: {{ tech.scienceCost }}
                  </div>
                  <div
                    v-if="tech.requires.length > 0"
                    class="text-xs text-neutral-400"
                  >
                    Требуется: {{ prerequisiteNames(tech) }}
                  </div>
                  <USeparator class="my-1" />
                  <div class="space-y-0.5">
                    <div
                      v-for="(effect, idx) in tech.effects"
                      :key="idx"
                      class="text-xs text-neutral-300"
                    >
                      {{ formatEffect(effect) }}
                    </div>
                  </div>
                </div>
              </template>
            </UTooltip>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
