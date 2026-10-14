import { useState } from 'react'
import { useChat } from '../context/ChatContext'
import { MESSENGER_LABEL } from '../messengers'
import { formatTime, initials } from '../utils/messages'
import { NewChat } from './NewChat'

export function Sidebar() {
  const { chats, activeChatId, selectChat, logout, connectionError, messenger } =
    useChat()
  const [newChatOpen, setNewChatOpen] = useState(false)

  return (
    <aside className="sidebar">
      <header className="sidebar-head">
        <div className="sidebar-title">
          <span className="brand-mark">{MESSENGER_LABEL[messenger]}</span>
          <span>Чаты</span>
        </div>
        <div className="sidebar-actions">
          <button
            type="button"
            className="icon-btn text"
            title="Новый чат"
            aria-label="Новый чат"
            onClick={() => setNewChatOpen(true)}
          >
            + чат
          </button>
          <button type="button" className="icon-btn text" title="Выйти" onClick={logout}>
            выйти
          </button>
        </div>
      </header>

      {connectionError && (
        <div className="banner warn">{connectionError}</div>
      )}

      <div className="chat-list">
        {chats.length === 0 && (
          <div className="empty-list">
            Пока нет чатов.
            <button type="button" className="linkish" onClick={() => setNewChatOpen(true)}>
              Написать по номеру
            </button>
          </div>
        )}

        {chats.map((chat) => {
          const last = chat.messages[chat.messages.length - 1]
          return (
            <button
              key={chat.chatId}
              type="button"
              className={`chat-item${activeChatId === chat.chatId ? ' active' : ''}`}
              onClick={() => selectChat(chat.chatId)}
            >
              <div className="avatar">{initials(chat.name)}</div>
              <div className="chat-item-body">
                <div className="chat-item-row">
                  <span className="chat-name">{chat.name}</span>
                  {last && (
                    <span className="chat-time">{formatTime(last.timestamp)}</span>
                  )}
                </div>
                <div className="chat-item-row">
                  <span className="chat-preview">
                    {last
                      ? `${last.direction === 'outgoing' ? 'Вы: ' : ''}${last.text}`
                      : 'Нет сообщений'}
                  </span>
                  {chat.unread > 0 && (
                    <span className="badge">{chat.unread}</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <NewChat open={newChatOpen} onClose={() => setNewChatOpen(false)} />
    </aside>
  )
}
