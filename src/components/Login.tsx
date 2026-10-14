import { useState, type FormEvent } from 'react'
import { useChat } from '../context/ChatContext'
import { MESSENGER_LABEL, MESSENGERS, type Messenger } from '../messengers'

export function Login() {
  const {
    login,
    enterDemo,
    loggingIn,
    loginError,
    messenger,
    setMessenger,
  } = useChat()
  const [idInstance, setIdInstance] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [apiUrl, setApiUrl] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await login(idInstance, apiToken, apiUrl || undefined)
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <span className="login-logo">{MESSENGER_LABEL[messenger]}</span>
          <p className="login-sub">Чат через GREEN-API</p>
        </div>

        <div className="messenger-switch" role="group" aria-label="Мессенджер">
          {MESSENGERS.map((m: Messenger) => (
            <button
              key={m}
              type="button"
              className={`messenger-chip${messenger === m ? ' active' : ''}`}
              onClick={() => setMessenger(m)}
            >
              {MESSENGER_LABEL[m]}
            </button>
          ))}
        </div>

        <label className="field">
          <span>idInstance</span>
          <input
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value)}
            placeholder="из кабинета GREEN-API"
            autoComplete="username"
            required
          />
        </label>

        <label className="field">
          <span>apiTokenInstance</span>
          <input
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="токен из кабинета"
            autoComplete="current-password"
            required
          />
        </label>

        <button
          type="button"
          className="linkish"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? 'Скрыть API URL' : 'Указать API URL вручную'}
        </button>

        {showAdvanced && (
          <label className="field">
            <span>API URL</span>
            <input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://1100.api.green-api.com"
            />
          </label>
        )}

        {loginError && <div className="form-error">{loginError}</div>}

        <button className="btn-primary" type="submit" disabled={loggingIn}>
          {loggingIn ? 'Входим…' : 'Войти'}
        </button>

        <button type="button" className="btn-ghost" onClick={enterDemo}>
          Демо без API
        </button>

        <p className="login-hint">
          Нужен инстанс {MESSENGER_LABEL[messenger]} из{' '}
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
            кабинета GREEN-API
          </a>
          . Тема и проверка номера зависят от выбранного мессенджера.
        </p>
      </form>
    </div>
  )
}
