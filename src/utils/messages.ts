import type { NotificationBody } from '../types'

export function extractText(body: NotificationBody): string | null {
  const data = body.messageData
  if (!data) return null

  if (data.typeMessage === 'textMessage' && data.textMessageData?.textMessage) {
    return data.textMessageData.textMessage
  }

  if (
    data.typeMessage === 'extendedTextMessage' &&
    data.extendedTextMessageData?.text
  ) {
    return data.extendedTextMessageData.text
  }

  if (data.typeMessage) {
    return `[${data.typeMessage}]`
  }

  return null
}

export function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function initials(name: string) {
  const parts = name.replace(/^\+/, '').trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || '?'
}
