import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useChat } from '../context/ChatContext'
import { MESSENGER_LABEL } from '../messengers'
import type { MessageStatus } from '../types'
import { formatTime, initials } from '../utils/messages'
import { NewChat } from './NewChat'

const STATUS_TITLE: Record<MessageStatus, string> = {
  sending: 'Отправляется',
  sent: 'Отправлено',
  delivered: 'Доставлено',
  read: 'Прочитано',
  failed: 'Ошибка',
}

function StatusTicks({ status }: { status?: MessageStatus }) {
  if (!status) return null
  if (status === 'sending') {
    return <span className="ticks" title={STATUS_TITLE.sending}>…</span>
  }
  if (status === 'failed') {
    return <span className="ticks fail" title={STATUS_TITLE.failed}>!</span>
  }
  const double = status === 'delivered' || status === 'read'
  return (
    <span
      className={`ticks${double ? ' double' : ''}${status === 'read' ? ' read' : ''}`}
      title={STATUS_TITLE[status]}
      aria-label={STATUS_TITLE[status]}
    >
      <span className="tick">✓</span>
      {double && <span className="tick">✓</span>}
    </span>
  )
}

function Composer({
  chatId,
  text,
  onChange,
  onSent,
}: {
  chatId: string
  text: string
  onChange: (value: string) => void
  onSent: () => void
}) {
  const { send } = useChat()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submitMessage() {
    if (!text.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      await send(text)
      onSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не отправилось')
    } finally {
      setSending(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void submitMessage()
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submitMessage()
    }
  }

  return (
    <>
      {error && <div className="banner error">{error}</div>}
      <form className="composer" onSubmit={onSubmit}>
        <textarea
          key={chatId}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Сообщение"
          rows={1}
        />
        <button
          type="submit"
          className="send-btn"
          disabled={sending || !text.trim()}
          aria-label="Отправить"
        >
          ➤
        </button>
      </form>
    </>
  )
}

export function ChatView() {
  const { chats, activeChatId, messenger, selectChat } = useChat()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [newChatOpen, setNewChatOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const chat = chats.find((c) => c.chatId === activeChatId)
  const text = activeChatId ? (drafts[activeChatId] ?? '') : ''

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat?.messages.length, activeChatId])

  function setDraft(value: string) {
    if (!activeChatId) return
    setDrafts((prev) => ({ ...prev, [activeChatId]: value }))
  }

  function clearDraft(chatId: string) {
    setDrafts((prev) => {
      if (!(chatId in prev)) return prev
      const next = { ...prev }
      delete next[chatId]
      return next
    })
  }

  if (!chat || !activeChatId) {
    return (
      <section className="chat-view empty-view">
        <div className="empty-hero">
          <span className="brand-mark lg">{MESSENGER_LABEL[messenger]}</span>
          <p>Выберите чат или создайте новый по номеру телефона</p>
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 14 }}
            onClick={() => setNewChatOpen(true)}
          >
            Новый чат
          </button>
        </div>
        <NewChat open={newChatOpen} onClose={() => setNewChatOpen(false)} />
      </section>
    )
  }

  return (
    <section className="chat-view">
      <header className="chat-head">
        <button
          type="button"
          className="icon-btn text back-btn"
          onClick={() => selectChat(null)}
          aria-label="К списку чатов"
        >
          ←
        </button>
        <div className="avatar sm">{initials(chat.name)}</div>
        <div className="chat-head-info">
          <div className="chat-head-name">{chat.name}</div>
          {chat.phone && <div className="chat-head-sub">{chat.phone}</div>}
        </div>
      </header>

      <div className="messages">
        {chat.messages.length === 0 && (
          <div className="messages-empty">Напишите первое сообщение</div>
        )}
        {chat.messages.map((m) => (
          <div key={m.id} className={`bubble-row ${m.direction}`}>
            <div
              className={`bubble ${m.direction} ${m.status === 'failed' ? 'failed' : ''}`}
            >
              <div className="bubble-text">{m.text}</div>
              <div className="bubble-meta">
                <span>{formatTime(m.timestamp)}</span>
                {m.direction === 'outgoing' && <StatusTicks status={m.status} />}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <Composer
        key={activeChatId}
        chatId={activeChatId}
        text={text}
        onChange={setDraft}
        onSent={() => clearDraft(activeChatId)}
      />
    </section>
  )
}
