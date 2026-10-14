import type { Messenger } from '../messengers'

export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')

  if (digits.startsWith('8') && digits.length === 11) {
    digits = '7' + digits.slice(1)
  }

  return digits
}

export function isUsername(raw: string): boolean {
  return /^@[a-zA-Z][\w\d_]{3,31}$/.test(raw.trim())
}

export function isValidPhone(digits: string, messenger: Messenger = 'max'): boolean {
  if (messenger === 'max') {
    if (digits.startsWith('7') && digits.length === 11) return true
    if (digits.startsWith('375') && digits.length === 12) return true
    return false
  }

  return digits.length >= 10 && digits.length <= 15
}

export function isValidRecipient(raw: string, messenger: Messenger): boolean {
  const trimmed = raw.trim()
  if (messenger === 'telegram' && isUsername(trimmed)) return true
  return isValidPhone(normalizePhone(trimmed), messenger)
}

export function formatPhoneLabel(digits: string): string {
  if (digits.startsWith('7') && digits.length === 11) {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`
  }
  if (digits.startsWith('375') && digits.length === 12) {
    return `+375 ${digits.slice(3, 5)} ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`
  }
  return `+${digits}`
}

export function phoneFromChatId(chatId: string): string | undefined {
  const wa = chatId.match(/^(\d{10,15})@c\.us$/i)
  if (wa) return wa[1]
  if (/^\d{10,15}$/.test(chatId)) return chatId
  return undefined
}

export function samePhone(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  return normalizePhone(a) === normalizePhone(b)
}

export function chatMatchesIdentity(
  chat: { chatId: string; phone?: string },
  opts: { chatId?: string; phone?: string | null },
): boolean {
  if (opts.chatId && chat.chatId === opts.chatId) return true
  const chatPhone = chat.phone || phoneFromChatId(chat.chatId)
  if (opts.phone && chatPhone && samePhone(chatPhone, opts.phone)) return true
  if (opts.chatId) {
    const fromId = phoneFromChatId(opts.chatId)
    if (fromId && chatPhone && samePhone(chatPhone, fromId)) return true
  }
  return false
}

export function recipientHint(messenger: Messenger): string {
  if (messenger === 'max') {
    return 'Номер получателя в MAX — Россия (+7) или Беларусь (+375)'
  }
  if (messenger === 'telegram') {
    return 'Номер в международном формате или @username в Telegram'
  }
  return 'Номер получателя WhatsApp в международном формате'
}

export function recipientErrorHint(messenger: Messenger): string {
  if (messenger === 'max') return 'Нужен номер РФ (+7) или РБ (+375)'
  if (messenger === 'telegram') {
    return 'Нужен номер в международном формате или @username'
  }
  return 'Нужен номер в международном формате'
}
