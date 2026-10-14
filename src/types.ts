import type { Messenger } from './messengers'

export type Credentials = {
  idInstance: string
  apiTokenInstance: string
  apiUrl: string
  messenger: Messenger
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'

export type ChatMessage = {
  id: string
  chatId: string
  text: string
  direction: 'outgoing' | 'incoming'
  timestamp: number
  status?: MessageStatus
}

export type Chat = {
  chatId: string
  phone?: string
  name: string
  messages: ChatMessage[]
  unread: number
  updatedAt: number
}

export type NotificationBody = {
  typeWebhook?: string
  timestamp?: number
  idMessage?: string
  chatId?: string
  status?: string
  description?: string
  senderData?: {
    chatId?: string
    sender?: string
    senderName?: string
    chatName?: string
    senderPhoneNumber?: number
  }
  messageData?: {
    typeMessage?: string
    textMessageData?: {
      textMessage?: string
    }
    extendedTextMessageData?: {
      text?: string
    }
  }
}
