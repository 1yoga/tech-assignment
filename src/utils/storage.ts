import { isMessenger, type Messenger } from '../messengers'
import type { Chat, Credentials } from '../types'

const CREDS_KEY = 'max_chat_creds'
const MESSENGER_KEY = 'max_chat_messenger'
const chatsKey = (id: string) => `max_chat_history_${id}`

export function saveCreds(creds: Credentials) {
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds))
  localStorage.setItem(MESSENGER_KEY, creds.messenger)
}

export function loadCreds(): Credentials | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Credentials>
    if (!parsed.idInstance || !parsed.apiTokenInstance || !parsed.apiUrl) {
      return null
    }
    return {
      idInstance: parsed.idInstance,
      apiTokenInstance: parsed.apiTokenInstance,
      apiUrl: parsed.apiUrl,
      messenger: isMessenger(parsed.messenger) ? parsed.messenger : 'max',
    }
  } catch {
    return null
  }
}

export function savePreferredMessenger(messenger: Messenger) {
  localStorage.setItem(MESSENGER_KEY, messenger)
}

export function loadPreferredMessenger(): Messenger {
  const raw = localStorage.getItem(MESSENGER_KEY)
  return isMessenger(raw) ? raw : 'max'
}

export function clearCreds() {
  localStorage.removeItem(CREDS_KEY)
}

export function saveChats(idInstance: string, chats: Chat[]) {
  const trimmed = chats.map((c) => ({
    ...c,
    messages: c.messages.slice(-300),
  }))
  localStorage.setItem(chatsKey(idInstance), JSON.stringify(trimmed))
}

export function loadChats(idInstance: string): Chat[] {
  try {
    const raw = localStorage.getItem(chatsKey(idInstance))
    if (!raw) return []
    return JSON.parse(raw) as Chat[]
  } catch {
    return []
  }
}
