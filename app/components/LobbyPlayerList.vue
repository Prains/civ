<script setup lang="ts">
const factionNames: Record<string, string> = {
  solar_empire: 'Солнечная Империя',
  merchant_league: 'Торговая Лига',
  forest_keepers: 'Хранители Леса',
  seekers: 'Искатели'
}

const props = defineProps<{
  players: Array<{ id: string, name: string, factionId?: string | null }>
  hostId?: string
}>()
</script>

<template>
  <ul class="space-y-2">
    <li
      v-for="player in props.players"
      :key="player.id"
      class="flex items-center gap-2"
    >
      <UIcon
        name="i-lucide-user"
        class="size-4 text-neutral-400"
      />
      <span>{{ player.name }}</span>
      <UBadge
        v-if="player.id === props.hostId"
        size="xs"
        color="primary"
        variant="subtle"
      >
        Хост
      </UBadge>
      <UBadge
        v-if="player.factionId"
        size="xs"
        variant="subtle"
        color="neutral"
      >
        {{ factionNames[player.factionId] ?? player.factionId }}
      </UBadge>
    </li>
  </ul>
</template>
