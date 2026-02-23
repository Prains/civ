<script setup lang="ts">
import type { GameEvent } from '#shared/game-types'

interface Props {
  events: GameEvent[]
}

const props = defineProps<Props>()

function formatEvent(event: GameEvent): { text: string, color: string, icon: string } {
  switch (event.type) {
    case 'techResearched':
      return { text: 'Исследована технология', color: 'info', icon: 'i-heroicons-academic-cap' }
    case 'lawPassed':
      return { text: 'Закон принят', color: 'success', icon: 'i-heroicons-scale' }
    case 'lawRejected':
      return { text: 'Закон отклонён', color: 'warning', icon: 'i-heroicons-x-circle' }
    case 'warDeclared':
      return { text: 'Объявлена война', color: 'error', icon: 'i-heroicons-fire' }
    case 'peaceDeclared':
      return { text: 'Заключён мир', color: 'success', icon: 'i-heroicons-hand-raised' }
    case 'settlementFounded':
      return { text: 'Основано поселение', color: 'info', icon: 'i-heroicons-building-office-2' }
    case 'combatResult':
      return { text: event.killed ? 'Юнит уничтожен' : `Бой: ${event.damage} урона`, color: 'warning', icon: 'i-heroicons-bolt' }
    case 'playerEliminated':
      return { text: 'Игрок выбыл', color: 'error', icon: 'i-heroicons-user-minus' }
    case 'victory':
      return { text: 'Победа!', color: 'success', icon: 'i-heroicons-trophy' }
    default:
      return { text: `Событие: ${event.type}`, color: 'neutral', icon: 'i-heroicons-bell' }
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <h3 class="text-sm font-semibold mb-2">Журнал событий</h3>
    <div class="flex-1 overflow-y-auto space-y-1">
      <div
        v-for="(event, index) in props.events.slice().reverse()"
        :key="index"
        class="flex items-center gap-2 text-xs p-1.5 rounded bg-neutral-800/50"
      >
        <UIcon :name="formatEvent(event).icon" class="w-4 h-4 shrink-0" />
        <span>{{ formatEvent(event).text }}</span>
      </div>
      <div v-if="props.events.length === 0" class="text-xs text-neutral-500 text-center py-4">
        Нет событий
      </div>
    </div>
  </div>
</template>
