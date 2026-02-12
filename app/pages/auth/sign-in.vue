<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'

const fields: AuthFormField[] = [
  {
    name: 'email',
    type: 'email',
    label: 'Эл. почта',
    placeholder: 'you@example.com',
    required: true
  },
  {
    name: 'password',
    type: 'password',
    label: 'Пароль',
    placeholder: 'Введите пароль',
    required: true
  }
]

const schema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль')
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
    error.value = authError.message ?? 'Неверные данные для входа'
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
        :submit="{ label: 'Войти' }"
        title="С возвращением!"
        icon="i-lucide-lock"
        loading-auto
        @submit="onSubmit"
      >
        <template #description>
          Нет аккаунта?
          <ULink
            to="/auth/sign-up"
            class="text-primary font-medium"
          >
            Зарегистрироваться
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
