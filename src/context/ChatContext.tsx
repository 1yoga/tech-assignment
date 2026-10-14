import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  deleteNotification,
  enableHttpApiReceiving,
  getStateInstance,
  receiveNotification,
  resolveApiUrl,
  resolveRecipient,
  sendMessage,
} from '../api/greenApi'
import {
  applyMessengerTheme,
  MESSENGER_LABEL,
  type Messenger,
} from '../messengers'
import type { Chat, ChatMessage, Credentials, MessageStatus } from '../types'
import { extractText } from '../utils/messages'
import {
  chatMatchesIdentity,
  formatPhoneLabel,
  isUsername,
  isValidRecipient,
  normalizePhone,
  phoneFromChatId,
  recipientErrorHint,
} from '../utils/phone'
import {
  clearCreds,
  loadChats,
  loadCreds,
  loadPreferredMessenger,
  saveChats,
  saveCreds,
  savePreferredMessenger,
} from '../utils/storage'

type ChatContextValue = {
  creds: Credentials | null
  messenger: Messenger
  chats: Chat[]
  activeChatId: string | null
  loginError: string | null
  loggingIn: boolean
  connectionError: string | null
  setMessenger: (messenger: Messenger) => void
  login: (idInstance: string, apiTokenInstance: string, apiUrl?: string) => Promise<void>
  enterDemo: () => void
  logout: () => void
  selectChat: (chatId: string | null) => void
  createChat: (phoneRaw: string) => Promise<void>
  send: (text: string) => Promise<void>
}

const ChatContext = createContext<ChatContextValue | null>(null)

const STATUS_RANK: Record<MessageStatus, number> = {
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
}

function sortChats(list: Chat[]) {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
}

function describeInstanceState(state: string, messenger: Messenger): string | null {
  if (state === 'authorized' || state === 'sleepMode') return null
  if (state === 'notAuthorized') {
    return `Инстанс не авторизован. Отсканируйте QR в кабинете GREEN-API (${MESSENGER_LABEL[messenger]}).`
  }
  if (state === 'blocked') {
    return 'Инстанс заблокирован. Проверьте кабинет GREEN-API.'
  }
  if (state === 'yellowCard') {
    return 'На инстансе ограничения (yellow card). Отправка может не работать.'
  }
  return `Инстанс в состоянии «${state}». Нужен authorized.`
}

function findLocalChat(
  list: Chat[],
  opts: { phone?: string | null; username?: string; chatId?: string },
): Chat | undefined {
  if (opts.chatId || opts.phone) {
    const byIdentity = list.find((c) =>
      chatMatchesIdentity(c, { chatId: opts.chatId, phone: opts.phone }),
    )
    if (byIdentity) return byIdentity
  }

  if (opts.username) {
    const needle = opts.username.replace(/^@/, '').toLowerCase()
    return list.find((c) => c.name.replace(/^@/, '').toLowerCase() === needle)
  }

  return undefined
}

function mergeMessages(a: ChatMessage[], b: ChatMessage[]) {
  const seen = new Set<string>()
  const out: ChatMessage[] = []
  for (const m of [...a, ...b].sort((x, y) => x.timestamp - y.timestamp)) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    out.push(m)
  }
  return out
}

function mapOutgoingStatus(raw?: string): MessageStatus | undefined {
  if (raw === 'sent' || raw === 'delivered' || raw === 'read' || raw === 'failed') {
    return raw
  }
  if (raw === 'noAccount') return 'failed'
  return undefined
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const saved = loadCreds()
  const [creds, setCreds] = useState<Credentials | null>(() => saved)
  const [messenger, setMessengerState] = useState<Messenger>(
    () => saved?.messenger ?? loadPreferredMessenger(),
  )
  const [chats, setChats] = useState<Chat[]>(() =>
    saved ? loadChats(saved.idInstance) : [],
  )
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const chatsRef = useRef(chats)
  const activeRef = useRef(activeChatId)
  const stopPolling = useRef(false)
  const logoutRef = useRef<() => void>(() => {})

  useEffect(() => {
    chatsRef.current = chats
  }, [chats])

  useEffect(() => {
    activeRef.current = activeChatId
  }, [activeChatId])

  useEffect(() => {
    applyMessengerTheme(messenger)
  }, [messenger])

  useEffect(() => {
    if (!creds || creds.apiUrl.startsWith('demo:')) return
    const timer = window.setTimeout(() => {
      saveChats(creds.idInstance, chats)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [chats, creds])

  const setMessenger = useCallback((next: Messenger) => {
    setMessengerState(next)
    savePreferredMessenger(next)
  }, [])

  const logout = useCallback(() => {
    stopPolling.current = true
    clearCreds()
    setCreds(null)
    setChats([])
    setActiveChatId(null)
    setConnectionError(null)
  }, [])

  useEffect(() => {
    logoutRef.current = logout
  }, [logout])

  const upsertIncoming = useCallback(
    (
      chatId: string,
      message: ChatMessage,
      senderName?: string,
      phone?: string,
    ) => {
      const normalizedPhone = phone ? normalizePhone(phone) : undefined

      setChats((prev) => {
        const existing =
          prev.find((c) => c.chatId === chatId) ||
          prev.find((c) =>
            chatMatchesIdentity(c, { chatId, phone: normalizedPhone }),
          )

        if (!existing) {
          const chat: Chat = {
            chatId,
            phone: normalizedPhone,
            name:
              senderName ||
              (normalizedPhone ? formatPhoneLabel(normalizedPhone) : chatId),
            messages: [message],
            unread: activeRef.current === chatId ? 0 : 1,
            updatedAt: message.timestamp,
          }
          return sortChats([chat, ...prev])
        }

        const oldId = existing.chatId
        if (existing.messages.some((m) => m.id === message.id)) {
          if (
            oldId === chatId &&
            (!senderName || existing.name === senderName) &&
            (!normalizedPhone || existing.phone === normalizedPhone)
          ) {
            return prev
          }
        }

        if (oldId !== chatId && activeRef.current === oldId) {
          setActiveChatId(chatId)
        }

        const mergedMessages = existing.messages.some((m) => m.id === message.id)
          ? existing.messages.map((m) =>
              m.id === message.id ? message : { ...m, chatId },
            )
          : mergeMessages(
              existing.messages.map((m) => ({ ...m, chatId })),
              [message],
            )

        const wasOpen =
          activeRef.current === oldId || activeRef.current === chatId

        const merged: Chat = {
          ...existing,
          chatId,
          phone: normalizedPhone || existing.phone,
          name: senderName || existing.name,
          messages: mergedMessages,
          unread: wasOpen ? 0 : existing.unread + (existing.messages.some((m) => m.id === message.id) ? 0 : 1),
          updatedAt: message.timestamp,
        }

        return sortChats([
          merged,
          ...prev.filter((c) => c.chatId !== oldId && c.chatId !== chatId),
        ])
      })
    },
    [],
  )

  const applyOutgoingStatus = useCallback(
    (idMessage: string, status: MessageStatus) => {
      setChats((prev) =>
        prev.map((c) => {
          const idx = c.messages.findIndex((m) => m.id === idMessage)
          if (idx < 0) return c
          const current = c.messages[idx]
          if (
            current.status &&
            STATUS_RANK[status] < STATUS_RANK[current.status] &&
            status !== 'failed'
          ) {
            return c
          }
          const messages = c.messages.slice()
          messages[idx] = { ...current, status }
          return { ...c, messages }
        }),
      )
    },
    [],
  )

  useEffect(() => {
    if (!creds || creds.apiUrl.startsWith('demo:')) return

    let cancelled = false
    let pauseMs = 1000
    stopPolling.current = false

    async function loop() {
      while (!cancelled && !stopPolling.current && creds) {
        try {
          const note = await receiveNotification(creds, 20)
          if (cancelled || stopPolling.current) break

          if (!note) {
            setConnectionError(null)
            pauseMs = 1000
            continue
          }

          const { receiptId, body } = note
          const type = body.typeWebhook

          if (type === 'incomingMessageReceived') {
            const chatId = body.senderData?.chatId
            const text = extractText(body)
            if (chatId && text && body.idMessage) {
              const phone =
                body.senderData?.senderPhoneNumber != null
                  ? String(body.senderData.senderPhoneNumber)
                  : phoneFromChatId(chatId) ||
                    phoneFromChatId(body.senderData?.sender || '')

              upsertIncoming(
                chatId,
                {
                  id: body.idMessage,
                  chatId,
                  text,
                  direction: 'incoming',
                  timestamp: (body.timestamp || Date.now() / 1000) * 1000,
                },
                body.senderData?.senderName || body.senderData?.chatName,
                phone,
              )
            }
          } else if (type === 'outgoingMessageStatus' && body.idMessage) {
            const mapped = mapOutgoingStatus(body.status)
            if (mapped) {
              applyOutgoingStatus(body.idMessage, mapped)
            }
          }

          try {
            await deleteNotification(creds, receiptId)
          } catch {
            // ignore
          }

          setConnectionError(null)
          pauseMs = 1000
        } catch (e) {
          if (cancelled || stopPolling.current) break
          const msg = e instanceof Error ? e.message : 'Ошибка сети'

          if (/401|403|unauthorized|forbidden/i.test(msg)) {
            setConnectionError('Сессия недействительна — выходим…')
            stopPolling.current = true
            window.setTimeout(() => logoutRef.current(), 800)
            break
          }
          if (/webhook url is set/i.test(msg)) {
            setConnectionError(
              'В кабинете заполнен webhookUrl — очистите его, иначе HTTP API не отдаёт входящие.',
            )
            await new Promise((r) => setTimeout(r, 8000))
            continue
          }
          setConnectionError('Нет связи с GREEN-API, пробую снова…')
          await new Promise((r) => setTimeout(r, pauseMs))
          pauseMs = Math.min(pauseMs * 2, 15000)
        }
      }
    }

    loop()

    return () => {
      cancelled = true
      stopPolling.current = true
    }
  }, [creds, upsertIncoming, applyOutgoingStatus])

  const login = useCallback(
    async (idInstance: string, apiTokenInstance: string, apiUrl?: string) => {
      setLoggingIn(true)
      setLoginError(null)

      const next: Credentials = {
        idInstance: idInstance.trim(),
        apiTokenInstance: apiTokenInstance.trim(),
        apiUrl: resolveApiUrl(idInstance, apiUrl),
        messenger,
      }

      try {
        const state = await getStateInstance(next)
        const stateError = describeInstanceState(state.stateInstance, messenger)
        if (stateError) {
          setLoginError(stateError)
          return
        }

        try {
          await enableHttpApiReceiving(next)
        } catch {
          // ignore
        }

        saveCreds(next)
        setCreds(next)
        setChats(loadChats(next.idInstance))
        setActiveChatId(null)
        setConnectionError(null)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Не удалось войти'
        const network =
          /нет сети|api недоступен|failed to fetch|networkerror|load failed/i.test(
            msg,
          ) || e instanceof TypeError
        setLoginError(
          network
            ? 'Не удалось достучаться до API. Проверьте idInstance или укажите API URL вручную.'
            : msg,
        )
      } finally {
        setLoggingIn(false)
      }
    },
    [messenger],
  )

  const enterDemo = useCallback(() => {
    const demoCreds: Credentials = {
      idInstance: 'demo',
      apiTokenInstance: 'demo',
      apiUrl: 'demo://local',
      messenger,
    }
    const now = Date.now()
    const label = MESSENGER_LABEL[messenger]
    setCreds(demoCreds)
    setChats([
      {
        chatId: '10000001',
        phone: '79991234567',
        name: '+7 999 123-45-67',
        unread: 1,
        updatedAt: now,
        messages: [
          {
            id: 'd1',
            chatId: '10000001',
            text: `Привет! Это демо ${label}.`,
            direction: 'incoming',
            timestamp: now - 120000,
          },
          {
            id: 'd2',
            chatId: '10000001',
            text: 'Можно потыкать интерфейс без GREEN-API',
            direction: 'outgoing',
            timestamp: now - 60000,
            status: 'delivered',
          },
          {
            id: 'd3',
            chatId: '10000001',
            text: 'Для реальной переписки войди со своими данными инстанса',
            direction: 'incoming',
            timestamp: now - 10000,
          },
        ],
      },
    ])
    setActiveChatId('10000001')
    setLoginError(null)
    setConnectionError(null)
  }, [messenger])

  const selectChat = useCallback((chatId: string | null) => {
    setActiveChatId(chatId)
    if (!chatId) return
    setChats((prev) =>
      prev.map((c) => (c.chatId === chatId ? { ...c, unread: 0 } : c)),
    )
  }, [])

  const createChat = useCallback(
    async (raw: string) => {
      if (!creds) return

      const trimmed = raw.trim()
      if (!isValidRecipient(trimmed, creds.messenger)) {
        throw new Error(recipientErrorHint(creds.messenger))
      }

      const username =
        creds.messenger === 'telegram' && isUsername(trimmed)
          ? trimmed
          : undefined
      const phone = username ? null : normalizePhone(trimmed)

      const local = findLocalChat(chatsRef.current, { phone, username })
      if (local) {
        setActiveChatId(local.chatId)
        return
      }

      let chatId = phone || username || trimmed
      let nameHint: string | undefined

      if (!creds.apiUrl.startsWith('demo:')) {
        const resolved = await resolveRecipient(creds, phone, username)
        chatId = resolved.chatId
        nameHint = resolved.nameHint
      } else {
        chatId = `demo-${phone || username}`
      }

      const already = findLocalChat(chatsRef.current, { chatId, phone, username })
      if (already) {
        setChats((prev) =>
          prev.map((c) =>
            c.chatId === already.chatId
              ? {
                  ...c,
                  phone: c.phone || phone || undefined,
                  name: nameHint || c.name,
                }
              : c,
          ),
        )
        setActiveChatId(already.chatId)
        return
      }

      const chat: Chat = {
        chatId,
        phone: phone || undefined,
        name: nameHint || (phone ? formatPhoneLabel(phone) : trimmed),
        messages: [],
        unread: 0,
        updatedAt: Date.now(),
      }

      setChats((prev) => sortChats([chat, ...prev]))
      setActiveChatId(chat.chatId)
    },
    [creds],
  )

  const send = useCallback(
    async (text: string) => {
      if (!creds || !activeChatId) return
      const trimmed = text.trim()
      if (!trimmed) return

      const chatId = activeChatId
      const tempId = `local-${Date.now()}`
      const message: ChatMessage = {
        id: tempId,
        chatId,
        text: trimmed,
        direction: 'outgoing',
        timestamp: Date.now(),
        status: 'sending',
      }

      setChats((prev) =>
        sortChats(
          prev.map((c) =>
            c.chatId === chatId
              ? {
                  ...c,
                  messages: [...c.messages, message],
                  updatedAt: message.timestamp,
                }
              : c,
          ),
        ),
      )

      if (creds.apiUrl.startsWith('demo:')) {
        setChats((prev) =>
          prev.map((c) => {
            if (c.chatId !== chatId) return c
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === tempId ? { ...m, status: 'sent' as const } : m,
              ),
            }
          }),
        )
        window.setTimeout(() => {
          const reply: ChatMessage = {
            id: `demo-in-${Date.now()}`,
            chatId,
            text: 'Ок, увидел (демо)',
            direction: 'incoming',
            timestamp: Date.now(),
          }
          setChats((prev) =>
            sortChats(
              prev.map((c) => {
                if (c.chatId !== chatId) return c
                return {
                  ...c,
                  messages: [...c.messages, reply],
                  unread: activeRef.current === chatId ? 0 : c.unread + 1,
                  updatedAt: reply.timestamp,
                }
              }),
            ),
          )
        }, 700)
        return
      }

      try {
        const res = await sendMessage(creds, chatId, trimmed)
        setChats((prev) =>
          prev.map((c) => {
            if (c.chatId !== chatId) return c
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === tempId
                  ? { ...m, id: res.idMessage, status: 'sent' as const }
                  : m,
              ),
            }
          }),
        )
      } catch (e) {
        setChats((prev) =>
          prev.map((c) => {
            if (c.chatId !== chatId) return c
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === tempId ? { ...m, status: 'failed' as const } : m,
              ),
            }
          }),
        )
        throw e
      }
    },
    [creds, activeChatId],
  )

  const value = useMemo(
    () => ({
      creds,
      messenger,
      chats,
      activeChatId,
      loginError,
      loggingIn,
      connectionError,
      setMessenger,
      login,
      enterDemo,
      logout,
      selectChat,
      createChat,
      send,
    }),
    [
      creds,
      messenger,
      chats,
      activeChatId,
      loginError,
      loggingIn,
      connectionError,
      setMessenger,
      login,
      enterDemo,
      logout,
      selectChat,
      createChat,
      send,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat вне провайдера')
  return ctx
}
