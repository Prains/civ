<script setup lang="ts">
const sessionToken = useCookie('sessionToken')
const playerId = useCookie('playerId')

if (sessionToken.value) {
  await navigateTo('/lobbies')
}

const rpc = useRpc()
const name = ref('')
const loading = ref(false)
const error = ref('')

async function handleJoin() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    error.value = 'Name cannot be empty'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const result = await rpc.player.join({ name: trimmed })
    sessionToken.value = result.sessionToken
    playerId.value = result.player.id
    await navigateTo('/lobbies')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to join'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-[80vh]">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-xl font-bold text-center">
          Enter your name
        </h1>
      </template>

      <form
        class="flex flex-col gap-4"
        @submit.prevent="handleJoin"
      >
        <UInput
          v-model="name"
          placeholder="Your name"
          size="lg"
          autofocus
          :color="error ? 'error' : undefined"
        />
        <p
          v-if="error"
          class="text-sm text-red-500"
        >
          {{ error }}
        </p>
        <UButton
          type="submit"
          label="Enter"
          size="lg"
          block
          :loading="loading"
        />
      </form>
    </UCard>
  </div>
</template>
