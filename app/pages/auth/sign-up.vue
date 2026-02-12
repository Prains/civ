<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'

const fields: AuthFormField[] = [
  {
    name: 'name',
    type: 'text',
    label: 'Name',
    placeholder: 'Your name',
    required: true
  },
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
    placeholder: 'Min 8 characters',
    required: true
  }
]

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters')
})

type Schema = z.output<typeof schema>

const error = ref('')

async function onSubmit(event: FormSubmitEvent<Schema>) {
  error.value = ''

  const { error: authError } = await authClient.signUp.email({
    name: event.data.name,
    email: event.data.email,
    password: event.data.password
  })

  if (authError) {
    error.value = authError.message ?? 'Sign up failed'
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
        :submit="{ label: 'Sign Up' }"
        title="Create an account"
        icon="i-lucide-user-plus"
        loading-auto
        @submit="onSubmit"
      >
        <template #description>
          Already have an account?
          <ULink
            to="/auth/sign-in"
            class="text-primary font-medium"
          >
            Sign in
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
