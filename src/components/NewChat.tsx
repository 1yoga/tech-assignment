import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useChat } from '../context/ChatContext'
import { MESSENGER_LABEL } from '../messengers'
import { recipientHint } from '../utils/phone'

type Props = {
  open: boolean
  onClose: () => void
}

export function NewChat({ open, onClose }: Props) {
  const { createChat, messenger } = useChat()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function close() {
    setPhone('')
    setError(null)
    setLoading(false)
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setPhone('')
      setError(null)
      setLoading(false)
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const label = MESSENGER_LABEL[messenger]
  const placeholder =
    messenger === 'telegram' ? '+7 999 123-45-67 или @username' : '+7 999 123-45-67'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await createChat(phone)
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не получилось создать чат')
      setLoading(false)
    }
  }

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <form className="modal" onSubmit={onSubmit} role="dialog" aria-modal="true">
        <h2>Новый чат · {label}</h2>
        <p className="modal-desc">{recipientHint(messenger)}</p>
        <label className="field">
          <span>{messenger === 'telegram' ? 'Телефон или username' : 'Телефон'}</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={close}>
            Отмена
          </button>
          <button type="submit" className="btn-primary" disabled={loading || !phone.trim()}>
            {loading ? 'Проверяем…' : 'Создать'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
