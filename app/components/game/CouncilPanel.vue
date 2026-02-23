<script setup lang="ts">
import type { AdvisorType, FactionId } from '#shared/game-types'

interface Props {
  advisors: { type: AdvisorType, loyalty: number }[]
  passedLaws: string[]
  factionId: FactionId
  culture: number
  gameId: string
}

interface Emits {
  (e: 'propose-law', payload: { lawId: string, targetPlayerId?: string }): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const isLawTreeOpen = ref(false)

function handlePropose(payload: { lawId: string, targetPlayerId?: string }) {
  emit('propose-law', payload)
  isLawTreeOpen.value = false
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-neutral-200 uppercase tracking-wide">
        Совет
      </h3>
    </div>

    <div class="flex flex-wrap gap-2 justify-center">
      <GameAdvisorCard
        v-for="advisor in advisors"
        :key="advisor.type"
        :advisor="advisor"
      />
    </div>

    <div class="flex justify-center">
      <UButton
        icon="i-lucide-scroll-text"
        variant="soft"
        color="primary"
        size="sm"
        @click="isLawTreeOpen = !isLawTreeOpen"
      >
        {{ isLawTreeOpen ? 'Скрыть законы' : 'Предложить закон' }}
      </UButton>
    </div>

    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="isLawTreeOpen"
        class="rounded-lg border border-neutral-700/50 bg-neutral-900/80 p-4"
      >
        <div class="mb-3 flex items-center justify-between">
          <span class="text-xs font-medium text-neutral-300">
            Древо законов
          </span>
          <div class="flex items-center gap-1">
            <UIcon
              name="i-lucide-palette"
              class="size-3 text-neutral-400"
            />
            <span class="text-xs text-neutral-400 tabular-nums">
              {{ culture }} культуры
            </span>
          </div>
        </div>

        <GameLawTree
          :passed-laws="passedLaws"
          :faction-id="factionId"
          :culture="culture"
          @propose="handlePropose"
        />
      </div>
    </Transition>
  </div>
</template>
