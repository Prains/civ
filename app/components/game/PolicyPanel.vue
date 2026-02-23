<script setup lang="ts">
type CombatPolicy = 'aggressive' | 'defensive' | 'avoidance'

interface Policies {
  aggression: number
  expansion: number
  spending: number
  combatPolicy: CombatPolicy
}

interface Props {
  policies: Policies
  gameId: string
}

interface Emits {
  (e: 'update', policies: Policies): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isOpen = ref(true)

const aggression = ref(props.policies.aggression)
const expansion = ref(props.policies.expansion)
const spending = ref(props.policies.spending)
const combatPolicy = ref<CombatPolicy>(props.policies.combatPolicy)

watch(() => props.policies, (newPolicies) => {
  aggression.value = newPolicies.aggression
  expansion.value = newPolicies.expansion
  spending.value = newPolicies.spending
  combatPolicy.value = newPolicies.combatPolicy
})

const combatPolicyItems = [
  { label: 'Агрессивная', value: 'aggressive' as const },
  { label: 'Оборонительная', value: 'defensive' as const },
  { label: 'Избежание боя', value: 'avoidance' as const }
]

const debouncedEmit = useDebounceFn(() => {
  emit('update', {
    aggression: aggression.value,
    expansion: expansion.value,
    spending: spending.value,
    combatPolicy: combatPolicy.value
  })
}, 300)

watch([aggression, expansion, spending, combatPolicy], () => {
  debouncedEmit()
})

const sliders = [
  {
    model: aggression,
    label: 'Агрессия',
    minLabel: 'Оборона',
    maxLabel: 'Атака',
    icon: 'i-lucide-swords'
  },
  {
    model: expansion,
    label: 'Экспансия',
    minLabel: 'Развитие',
    maxLabel: 'Экспансия',
    icon: 'i-lucide-map'
  },
  {
    model: spending,
    label: 'Расходы',
    minLabel: 'Накопление',
    maxLabel: 'Расходы',
    icon: 'i-lucide-coins'
  }
]
</script>

<template>
  <div class="absolute left-4 top-16 z-10">
    <UButton
      :icon="isOpen ? 'i-lucide-panel-left-close' : 'i-lucide-settings-2'"
      variant="soft"
      color="neutral"
      size="sm"
      class="mb-2"
      @click="isOpen = !isOpen"
    >
      {{ isOpen ? '' : 'Политика' }}
    </UButton>

    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 -translate-x-4"
      enter-to-class="opacity-100 translate-x-0"
      leave-from-class="opacity-100 translate-x-0"
      leave-to-class="opacity-0 -translate-x-4"
    >
      <div
        v-if="isOpen"
        class="w-72 bg-neutral-900/90 backdrop-blur-sm rounded-lg border border-neutral-700/50 p-4 space-y-5"
      >
        <h3 class="text-sm font-semibold text-neutral-200 uppercase tracking-wide">
          Политика
        </h3>

        <div
          v-for="slider in sliders"
          :key="slider.label"
          class="space-y-2"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <UIcon
                :name="slider.icon"
                class="size-4 text-neutral-400"
              />
              <span class="text-xs font-medium text-neutral-300">
                {{ slider.label }}
              </span>
            </div>
            <span class="text-xs font-mono text-neutral-400">
              {{ slider.model.value }}
            </span>
          </div>

          <USlider
            v-model="slider.model.value"
            :min="0"
            :max="100"
            :step="1"
            size="sm"
            :tooltip="false"
          />

          <div class="flex justify-between">
            <span class="text-[10px] text-neutral-500">
              {{ slider.minLabel }}
            </span>
            <span class="text-[10px] text-neutral-500">
              {{ slider.maxLabel }}
            </span>
          </div>
        </div>

        <USeparator />

        <div class="space-y-2">
          <div class="flex items-center gap-1.5">
            <UIcon
              name="i-lucide-shield"
              class="size-4 text-neutral-400"
            />
            <span class="text-xs font-medium text-neutral-300">
              Боевая тактика
            </span>
          </div>

          <URadioGroup
            v-model="combatPolicy"
            :items="combatPolicyItems"
            value-key="value"
            label-key="label"
            size="sm"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>
