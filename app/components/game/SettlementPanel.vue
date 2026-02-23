<script setup lang="ts">
import type { GameSettlement, Resources, BuildingType, UnitType } from '#shared/game-types'
import { BUILDING_DEFS } from '#shared/building-defs'
import { UNIT_DEFS } from '#shared/unit-defs'

interface Props {
  settlement: GameSettlement
  resources: Resources
  gameId: string
}

interface Emits {
  (e: 'close'): void
  (e: 'build-building', payload: { settlementId: string, buildingType: BuildingType }): void
  (e: 'buy-unit', payload: { settlementId: string, unitType: UnitType }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const tierLabels: Record<string, string> = {
  outpost: 'Аванпост',
  settlement: 'Поселение',
  city: 'Город'
}

const tierColors: Record<string, 'neutral' | 'primary' | 'warning'> = {
  outpost: 'neutral',
  settlement: 'primary',
  city: 'warning'
}

const hpPercentage = computed(() =>
  Math.round((props.settlement.hp / props.settlement.maxHp) * 100)
)

const hpBarColor = computed(() => {
  if (hpPercentage.value > 60) return 'bg-green-500'
  if (hpPercentage.value > 30) return 'bg-yellow-500'
  return 'bg-red-500'
})

// --- Buildings ---

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

const availableBuildings = computed(() => {
  const allTypes: BuildingType[] = ['farm', 'lumber_mill', 'market', 'library', 'temple', 'barracks', 'walls']
  return allTypes.map((type) => {
    const def = BUILDING_DEFS[type]
    const alreadyBuilt = props.settlement.buildings.includes(type)
    const slotsUsed = props.settlement.buildings.length >= props.settlement.buildingSlots
    const canAfford = props.resources.production >= def.productionCost
    return {
      type,
      def,
      alreadyBuilt,
      slotsUsed,
      canAfford,
      disabled: alreadyBuilt || slotsUsed || !canAfford
    }
  })
})

function getBuildingEffectShort(type: BuildingType): string {
  const def = BUILDING_DEFS[type]
  if (def.income.food > 0) return `+${def.income.food} еда`
  if (def.income.production > 0) return `+${def.income.production} произв.`
  if (def.income.gold > 0) return `+${def.income.gold} золото`
  if (def.income.science > 0) return `+${def.income.science} наука`
  if (def.income.culture > 0) return `+${def.income.culture} культура`
  if (def.defenseBonus > 0) return `+${def.defenseBonus}% защита`
  if (def.unlocks.length > 0) return `${def.unlocks.join(', ')}`
  return ''
}

function getBuildingDisabledReason(b: { alreadyBuilt: boolean, slotsUsed: boolean, canAfford: boolean }): string {
  if (b.alreadyBuilt) return 'Уже построено'
  if (b.slotsUsed) return 'Нет свободных слотов'
  if (!b.canAfford) return 'Недостаточно производства'
  return ''
}

// --- Units ---

const unitIcons: Record<UnitType, string> = {
  scout: 'i-lucide-radar',
  gatherer: 'i-lucide-pickaxe',
  warrior: 'i-lucide-sword',
  settler: 'i-lucide-tent',
  builder: 'i-lucide-wrench'
}

const unitNames: Record<UnitType, string> = {
  scout: 'Разведчик',
  gatherer: 'Собиратель',
  warrior: 'Воин',
  settler: 'Поселенец',
  builder: 'Строитель'
}

const availableUnits = computed(() => {
  const allTypes: UnitType[] = ['scout', 'gatherer', 'warrior', 'settler', 'builder']
  return allTypes.map((type) => {
    const def = UNIT_DEFS[type]
    const canAffordGold = props.resources.gold >= def.goldCost
    const canAffordProd = props.resources.production >= def.productionCost
    const needsBarracks = type === 'warrior' && !props.settlement.buildings.includes('barracks')
    return {
      type,
      def,
      canAffordGold,
      canAffordProd,
      needsBarracks,
      disabled: !canAffordGold || !canAffordProd || needsBarracks
    }
  })
})

function getUnitDisabledReason(u: { canAffordGold: boolean, canAffordProd: boolean, needsBarracks: boolean }): string {
  if (u.needsBarracks) return 'Нужна казарма'
  if (!u.canAffordGold) return 'Недостаточно золота'
  if (!u.canAffordProd) return 'Недостаточно производства'
  return ''
}
</script>

<template>
  <div class="absolute right-4 top-16 z-10 w-80">
    <div class="bg-neutral-900/90 backdrop-blur-sm rounded-lg border border-neutral-700/50 overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-700/50">
        <div class="flex items-center gap-2 min-w-0">
          <UIcon
            v-if="settlement.isCapital"
            name="i-lucide-star"
            class="size-4 text-yellow-400 shrink-0"
          />
          <h3 class="text-sm font-semibold text-white truncate">
            {{ settlement.name }}
          </h3>
          <UBadge
            :color="tierColors[settlement.tier]"
            variant="subtle"
            size="xs"
          >
            {{ tierLabels[settlement.tier] }}
          </UBadge>
        </div>
        <UButton
          icon="i-lucide-x"
          variant="ghost"
          color="neutral"
          size="xs"
          @click="emit('close')"
        />
      </div>

      <!-- Content -->
      <div class="p-4 space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto">
        <!-- HP Bar -->
        <div class="space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-xs text-neutral-400">
              <UIcon
                name="i-lucide-heart"
                class="size-3.5 inline-block mr-1"
              />
              Прочность
            </span>
            <span class="text-xs font-mono text-neutral-300">
              {{ settlement.hp }} / {{ settlement.maxHp }}
            </span>
          </div>
          <div class="h-1.5 bg-neutral-700 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="hpBarColor"
              :style="{ width: `${hpPercentage}%` }"
            />
          </div>
        </div>

        <!-- Defense -->
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-shield"
            class="size-4 text-neutral-400"
          />
          <span class="text-xs text-neutral-300">Защита</span>
          <span class="text-xs font-mono font-medium text-white">
            {{ settlement.defense }}
          </span>
        </div>

        <!-- Coordinates -->
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-map-pin"
            class="size-4 text-neutral-400"
          />
          <span class="text-xs text-neutral-500">
            Координаты: {{ settlement.q }}, {{ settlement.r }}
          </span>
        </div>

        <USeparator />

        <!-- Current buildings -->
        <GameBuildingList
          :buildings="settlement.buildings"
          :max-slots="settlement.buildingSlots"
        />

        <USeparator />

        <!-- Build new building -->
        <div class="space-y-2">
          <span class="text-xs font-medium text-neutral-300 uppercase tracking-wide">
            Построить здание
          </span>

          <div class="space-y-1.5">
            <UTooltip
              v-for="b in availableBuildings"
              :key="b.type"
              :text="b.disabled ? getBuildingDisabledReason(b) : getBuildingEffectShort(b.type)"
            >
              <UButton
                block
                size="xs"
                :variant="b.disabled ? 'ghost' : 'soft'"
                :color="b.disabled ? 'neutral' : 'primary'"
                :disabled="b.disabled"
                class="justify-between"
                @click="emit('build-building', { settlementId: settlement.id, buildingType: b.type })"
              >
                <template #leading>
                  <UIcon
                    :name="buildingIcons[b.type]"
                    class="size-4"
                  />
                </template>
                <span class="flex-1 text-left">
                  {{ buildingNames[b.type] }}
                </span>
                <span class="text-[10px] font-mono opacity-70">
                  {{ b.def.productionCost }}
                  <UIcon
                    name="i-lucide-hammer"
                    class="size-3 inline-block"
                  />
                </span>
              </UButton>
            </UTooltip>
          </div>
        </div>

        <USeparator />

        <!-- Buy units -->
        <div class="space-y-2">
          <span class="text-xs font-medium text-neutral-300 uppercase tracking-wide">
            Нанять юнита
          </span>

          <div class="space-y-1.5">
            <UTooltip
              v-for="u in availableUnits"
              :key="u.type"
              :text="u.disabled ? getUnitDisabledReason(u) : `Сила: ${u.def.strength}, ХП: ${u.def.maxHp}`"
            >
              <UButton
                block
                size="xs"
                :variant="u.disabled ? 'ghost' : 'soft'"
                :color="u.disabled ? 'neutral' : 'primary'"
                :disabled="u.disabled"
                class="justify-between"
                @click="emit('buy-unit', { settlementId: settlement.id, unitType: u.type })"
              >
                <template #leading>
                  <UIcon
                    :name="unitIcons[u.type]"
                    class="size-4"
                  />
                </template>
                <span class="flex-1 text-left">
                  {{ unitNames[u.type] }}
                </span>
                <span class="text-[10px] font-mono opacity-70">
                  {{ u.def.goldCost }}
                  <UIcon
                    name="i-lucide-coins"
                    class="size-3 inline-block"
                  />
                  {{ u.def.productionCost }}
                  <UIcon
                    name="i-lucide-hammer"
                    class="size-3 inline-block"
                  />
                </span>
              </UButton>
            </UTooltip>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
