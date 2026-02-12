<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'

const fields: AuthFormField[] = [
  {
    name: 'name',
    type: 'text',
    label: 'Имя',
    placeholder: 'Ваше имя',
    required: true
  },
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
    placeholder: 'Мин. 8 символов',
    required: true
  }
]

const schema = z.object({
  name: z.string().min(1, 'Введите имя'),
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Минимум 8 символов')
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
    error.value = authError.message ?? 'Ошибка регистрации'
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
        :submit="{ label: 'Зарегистрироваться' }"
        title="Создать аккаунт"
        icon="i-lucide-user-plus"
        loading-auto
        @submit="onSubmit"
      >
        <template #description>
          Уже есть аккаунт?
          <ULink
            to="/auth/sign-in"
            class="text-primary font-medium"
          >
            Войти
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
