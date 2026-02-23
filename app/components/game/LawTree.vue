<script setup lang="ts">
import type { FactionId, LawNode } from '~/shared/game-types'
import { LAW_TREE, getAvailableLaws } from '~/shared/law-tree'

interface Props {
  passedLaws: string[]
  factionId: FactionId
  culture: number
}

interface Emits {
  (e: 'propose', payload: { lawId: string, targetPlayerId?: string }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

type LawBranch = LawNode['branch']

const branchNames: Record<LawBranch, string> = {
  economy: 'Экономика',
  military: 'Военное дело',
  society: 'Общество',
  diplomacy: 'Дипломатия',
  faction_unique: 'Уникальные законы'
}

const branchIcons: Record<LawBranch, string> = {
  economy: 'i-lucide-coins',
  military: 'i-lucide-swords',
  society: 'i-lucide-users',
  diplomacy: 'i-lucide-handshake',
  faction_unique: 'i-lucide-star'
}

const branchOrder: LawBranch[] = ['economy', 'military', 'society', 'diplomacy', 'faction_unique']

const availableLawIds = computed(() => {
  const available = getAvailableLaws(props.passedLaws, props.factionId)
  return new Set(available.map(l => l.id))
})

const lawsByBranch = computed(() => {
  const result: Record<LawBranch, LawNode[]> = {
    economy: [],
    military: [],
    society: [],
    diplomacy: [],
    faction_unique: []
  }

  for (const law of Object.values(LAW_TREE)) {
    // Skip faction laws that don't belong to current faction
    if (law.factionOnly && law.factionOnly !== props.factionId) continue
    result[law.branch].push(law)
  }

  return result
})

function getLawStatus(law: LawNode): 'passed' | 'available' | 'locked' {
  if (props.passedLaws.includes(law.id)) return 'passed'
  if (availableLawIds.value.has(law.id)) return 'available'
  return 'locked'
}

function canAfford(law: LawNode): boolean {
  return props.culture >= law.cultureCost
}

function handlePropose(law: LawNode) {
  if (getLawStatus(law) !== 'available') return
  if (!canAfford(law)) return
  emit('propose', { lawId: law.id })
}

const statusClasses: Record<string, string> = {
  passed: 'border-green-500/50 bg-green-500/10',
  available: 'border-blue-500/50 bg-blue-500/10 cursor-pointer hover:bg-blue-500/20',
  locked: 'border-neutral-700/50 bg-neutral-800/50 opacity-50'
}

const statusBadgeColor: Record<string, 'success' | 'info' | 'neutral'> = {
  passed: 'success',
  available: 'info',
  locked: 'neutral'
}

const statusLabels: Record<string, string> = {
  passed: 'Принят',
  available: 'Доступен',
  locked: 'Заблокирован'
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="branch in branchOrder"
      :key="branch"
      class="space-y-2"
    >
      <template v-if="lawsByBranch[branch].length > 0">
        <div class="flex items-center gap-1.5">
          <UIcon
            :name="branchIcons[branch]"
            class="size-4 text-neutral-400"
          />
          <span class="text-xs font-semibold text-neutral-300 uppercase tracking-wide">
            {{ branchNames[branch] }}
          </span>
        </div>

        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="law in lawsByBranch[branch]"
            :key="law.id"
            class="rounded-lg border p-3 transition-colors"
            :class="[
              statusClasses[getLawStatus(law)],
              getLawStatus(law) === 'available' && !canAfford(law) ? 'opacity-60 cursor-not-allowed' : ''
            ]"
            @click="handlePropose(law)"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="text-sm font-medium text-neutral-200">
                {{ law.name }}
              </span>
              <UBadge
                :color="statusBadgeColor[getLawStatus(law)]"
                variant="subtle"
                size="xs"
              >
                {{ statusLabels[getLawStatus(law)] }}
              </UBadge>
            </div>

            <div class="mt-1.5 flex items-center gap-1">
              <UIcon
                name="i-lucide-palette"
                class="size-3 text-neutral-400"
              />
              <span
                class="text-xs tabular-nums"
                :class="canAfford(law) ? 'text-neutral-400' : 'text-red-400'"
              >
                {{ law.cultureCost }} культуры
              </span>
            </div>

            <div
              v-if="law.requires.length > 0"
              class="mt-1 text-[10px] text-neutral-500"
            >
              Требует: {{ law.requires.join(', ') }}
            </div>

            <div class="mt-2 space-y-0.5">
              <div
                v-for="(effect, idx) in law.effects"
                :key="idx"
                class="text-[11px] text-neutral-400"
              >
                {{ effect.description }}
              </div>
            </div>

            <div
              v-if="law.targetPlayer"
              class="mt-1.5 flex items-center gap-1"
            >
              <UIcon
                name="i-lucide-target"
                class="size-3 text-amber-400"
              />
              <span class="text-[10px] text-amber-400">
                Требует выбора цели
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
