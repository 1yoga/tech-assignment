import type { Credentials, NotificationBody } from '../types'

function buildUrl(creds: Credentials, method: string, extra = '') {
  return `${creds.apiUrl}/waInstance${creds.idInstance}/${method}/${creds.apiTokenInstance}${extra}`
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase()
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined),
  }
  if (options?.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  let res: Response
  try {
    res = await fetch(url, { ...options, method, headers })
  } catch {
    throw new Error('Нет сети или API недоступен')
  }

  const text = await res.text().catch(() => '')

  if (!res.ok) {
    throw new Error(text || `Ошибка API: ${res.status}`)
  }

  if (!text || text === 'null') return null as T

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Некорректный ответ API')
  }
}

export function resolveApiUrl(idInstance: string, custom?: string) {
  const trimmed = custom?.trim()
  if (trimmed) return trimmed.replace(/\/$/, '')

  const prefix = idInstance.trim().slice(0, 4)
  return `https://${prefix}.api.green-api.com`
}

export async function getStateInstance(creds: Credentials) {
  return request<{ stateInstance: string }>(buildUrl(creds, 'getStateInstance'))
}

export async function enableHttpApiReceiving(creds: Credentials) {
  return request<{ saveSettings: boolean }>(buildUrl(creds, 'setSettings'), {
    method: 'POST',
    body: JSON.stringify({
      webhookUrl: '',
      incomingWebhook: 'yes',
      outgoingWebhook: 'yes',
    }),
  })
}

export async function checkAccount(
  creds: Credentials,
  params: { phoneNumber?: number; username?: string },
) {
  return request<{
    exist: boolean
    chatId?: string
    username?: string
  }>(buildUrl(creds, 'checkAccount'), {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function checkWhatsapp(creds: Credentials, phoneNumber: number) {
  return request<{
    existsWhatsapp: boolean
    chatId?: string
  }>(buildUrl(creds, 'checkWhatsapp'), {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  })
}

export async function resolveRecipient(
  creds: Credentials,
  phoneDigits: string | null,
  username?: string,
): Promise<{ chatId: string; nameHint?: string }> {
  if (creds.messenger === 'whatsapp') {
    if (!phoneDigits) throw new Error('Для WhatsApp нужен номер телефона')
    const result = await checkWhatsapp(creds, Number(phoneDigits))
    if (!result.existsWhatsapp) {
      throw new Error('На этом номере нет WhatsApp')
    }
    return {
      chatId: result.chatId || `${phoneDigits}@c.us`,
    }
  }

  const params = username
    ? { username }
    : { phoneNumber: Number(phoneDigits) }

  const result = await checkAccount(creds, params)
  if (!result.exist || !result.chatId) {
    const label = creds.messenger === 'telegram' ? 'Telegram' : 'MAX'
    throw new Error(
      username
        ? `Аккаунт ${label} с таким username не найден`
        : `На этом номере нет аккаунта ${label}`,
    )
  }

  return {
    chatId: result.chatId,
    nameHint: result.username || undefined,
  }
}

export async function sendMessage(creds: Credentials, chatId: string, message: string) {
  return request<{ idMessage: string }>(buildUrl(creds, 'sendMessage'), {
    method: 'POST',
    body: JSON.stringify({ chatId, message }),
  })
}

export type ReceiveResult = {
  receiptId: number
  body: NotificationBody
} | null

export async function receiveNotification(creds: Credentials, receiveTimeout = 5) {
  return request<ReceiveResult>(
    buildUrl(creds, 'receiveNotification', `?receiveTimeout=${receiveTimeout}`),
  )
}

export async function deleteNotification(creds: Credentials, receiptId: number) {
  return request<{ result: boolean }>(
    buildUrl(creds, 'deleteNotification', `/${receiptId}`),
    { method: 'DELETE' },
  )
}
