# Чат GREEN-API

Тестовое на React: веб-чат через GREEN-API (MAX / WhatsApp / Telegram).

Логин по `idInstance` и `apiTokenInstance`, чат по номеру, текстовые сообщения. UI простой, для MAX ориентир — [web.max.ru](https://web.max.ru/).

## Запуск

Node.js 18+.

```bash
npm install
npm run dev
```

Откроется http://localhost:4732

Есть кнопка «Демо без API», если нет инстанса под рукой.

```bash
npm run build
npm run preview
```

## Кабинет

1. [console.green-api.com](https://console.green-api.com) — создать инстанс нужного мессенджера
2. Авторизовать (QR и т.п.)
3. Вставить `idInstance` / `apiTokenInstance`, на входе выбрать тот же мессенджер

API URL обычно из первых 4 цифр `idInstance`, при необходимости можно указать вручную.

Для входящих: `webhookUrl` пустой, входящие уведомления включены. При логине приложение само выставляет нужные настройки (`incomingWebhook`, `outgoingWebhook`).

## Что внутри

- SendMessage / ReceiveNotification + DeleteNotification
- checkAccount (MAX, TG) и checkWhatsapp (WA)
- темы под мессенджер, статусы исходящих, история в localStorage

Демо: https://tech-assignment-mocha.vercel.app

## Структура

```
src/
  api/          — GREEN-API
  context/      — состояние чатов
  components/
  utils/
```
