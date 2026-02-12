<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required')
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  email: '',
  password: ''
})

const error = ref('')
const loading = ref(false)

async function handleSubmit(event: FormSubmitEvent<Schema>) {
  error.value = ''
  loading.value = true

  try {
    const { error: authError } = await authClient.signIn.email({
      email: event.data.email,
      password: event.data.password
    })

    if (authError) {
      error.value = authError.message ?? 'Invalid credentials'
      return
    }

    await navigateTo('/lobbies')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Sign in failed'
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
          Sign In
        </h1>
      </template>

      <UForm
        :state="state"
        :schema="schema"
        class="flex flex-col gap-4"
        @submit="handleSubmit"
      >
        <UFormField
          label="Email"
          name="email"
          required
        >
          <UInput
            v-model="state.email"
            type="email"
            placeholder="you@example.com"
            autofocus
          />
        </UFormField>

        <UFormField
          label="Password"
          name="password"
          required
        >
          <UInput
            v-model="state.password"
            type="password"
          />
        </UFormField>

        <p
          v-if="error"
          class="text-sm text-red-500"
        >
          {{ error }}
        </p>

        <UButton
          type="submit"
          label="Sign In"
          size="lg"
          block
          :loading="loading"
        />

        <p class="text-sm text-center text-neutral-500">
          Don't have an account?
          <NuxtLink
            to="/auth/sign-up"
            class="text-primary hover:underline"
          >
            Sign up
          </NuxtLink>
        </p>
      </UForm>
    </UCard>
  </div>
</template>
