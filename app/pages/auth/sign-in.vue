<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'

const fields: AuthFormField[] = [
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'you@example.com',
    required: true
  },
  {
    name: 'password',
    type: 'password',
    label: 'Password',
    placeholder: 'Enter your password',
    required: true
  }
]

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required')
})

type Schema = z.output<typeof schema>

const error = ref('')

async function onSubmit(event: FormSubmitEvent<Schema>) {
  error.value = ''

  const { error: authError } = await authClient.signIn.email({
    email: event.data.email,
    password: event.data.password
  })

  if (authError) {
    error.value = authError.message ?? 'Invalid credentials'
    return
  }

  await navigateTo('/lobbies')
}
</script>

<template>
  <div class="flex items-center justify-center min-h-[80vh]">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        :fields="fields"
        :schema="schema"
        :submit="{ label: 'Sign In' }"
        title="Welcome back!"
        icon="i-lucide-lock"
        loading-auto
        @submit="onSubmit"
      >
        <template #description>
          Don't have an account?
          <ULink
            to="/auth/sign-up"
            class="text-primary font-medium"
          >
            Sign up
          </ULink>.
        </template>

        <template
          v-if="error"
          #validation
        >
          <UAlert
            color="error"
            icon="i-lucide-circle-alert"
            :title="error"
          />
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
