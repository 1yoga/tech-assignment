export type Messenger = 'max' | 'whatsapp' | 'telegram'

export const MESSENGERS: Messenger[] = ['max', 'whatsapp', 'telegram']

export const MESSENGER_LABEL: Record<Messenger, string> = {
  max: 'MAX',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
}

export function isMessenger(value: unknown): value is Messenger {
  return value === 'max' || value === 'whatsapp' || value === 'telegram'
}

export function applyMessengerTheme(messenger: Messenger) {
  document.documentElement.dataset.messenger = messenger
}
