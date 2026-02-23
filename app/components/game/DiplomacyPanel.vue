<script setup lang="ts">
import type { DiplomaticStatus, DiplomacyState } from '~/shared/game-types'

interface Props {
  diplomacy: DiplomacyState[]
  currentPlayerId: string
  gameId: string
}

interface Emits {
  (e: 'propose-war' | 'propose-peace', targetPlayerId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isOpen = ref(true)

function getDiplomacyWith(targetId: string): DiplomaticStatus {
  const entry = props.diplomacy.find(d =>
    (d.player1Id === props.currentPlayerId && d.player2Id === targetId)
    || (d.player1Id === targetId && d.player2Id === props.currentPlayerId)
  )
  return entry?.status ?? 'peace'
}

const otherPlayers = computed(() => {
  const playerIds = new Set<string>()
  for (const d of props.diplomacy) {
    if (d.player1Id === props.currentPlayerId) {
      playerIds.add(d.player2Id)
    } else if (d.player2Id === props.currentPlayerId) {
      playerIds.add(d.player1Id)
    }
  }
  return [...playerIds].map(id => ({
    id,
    status: getDiplomacyWith(id)
  }))
})

const statusConfig: Record<DiplomaticStatus, { label: string, color: 'success' | 'warning' | 'error' }> = {
  peace: { label: 'Мир', color: 'success' },
  tension: { label: 'Напряжение', color: 'warning' },
  war: { label: 'Война', color: 'error' }
}
</script>

<template>
  <div class="absolute right-4 top-16 z-10">
    <UButton
      :icon="isOpen ? 'i-lucide-panel-right-close' : 'i-lucide-handshake'"
      variant="soft"
      color="neutral"
      size="sm"
      class="mb-2"
      @click="isOpen = !isOpen"
    >
      {{ isOpen ? '' : 'Дипломатия' }}
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
        class="w-72 bg-neutral-900/90 backdrop-blur-sm rounded-lg border border-neutral-700/50 p-4 space-y-4"
      >
        <h3 class="text-sm font-semibold text-neutral-200 uppercase tracking-wide">
          Дипломатия
        </h3>

        <div
          v-if="otherPlayers.length === 0"
          class="text-xs text-neutral-500"
        >
          Нет известных игроков
        </div>

        <div
          v-for="player in otherPlayers"
          :key="player.id"
          class="flex items-center justify-between gap-2 rounded-md bg-neutral-800/60 px-3 py-2"
        >
          <div class="flex items-center gap-2 min-w-0">
            <UIcon
              name="i-lucide-user"
              class="size-4 text-neutral-400 shrink-0"
            />
            <span class="text-xs font-medium text-neutral-200 truncate">
              {{ player.id }}
            </span>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <UBadge
              :color="statusConfig[player.status].color"
              variant="subtle"
              size="sm"
            >
              {{ statusConfig[player.status].label }}
            </UBadge>

            <UButton
              v-if="player.status !== 'war'"
              icon="i-lucide-swords"
              variant="soft"
              color="error"
              size="xs"
              @click="emit('propose-war', player.id)"
            >
              Объявить войну
            </UButton>

            <UButton
              v-if="player.status === 'war'"
              icon="i-lucide-hand-heart"
              variant="soft"
              color="success"
              size="xs"
              @click="emit('propose-peace', player.id)"
            >
              Предложить мир
            </UButton>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
