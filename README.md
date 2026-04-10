# 📞 WebRTC Phone

Простой и красивый SIP-телефон для браузера. Работает в локальной сети без интернета, без базы данных, без серверной части.

## Как это работает

```
Browser ───HTTP──► Nginx (телефон UI)
   │
   └──────WebSocket (SIP) ──► Ваша АТС (Asterisk / FreePBX на отдельном сервере)
```

Телефон подключается к АТС напрямую через WebSocket. Контейнер в этом репозитории — только UI; **PBX не входит** в `docker-compose`.

## Быстрый старт

### 1. Запустите телефон

```bash
docker compose up -d
```

Откройте `http://<IP-адрес-сервера>` в браузере.

### 2. Подключитесь

Введите:
- **Номер телефона** — ваш SIP extension (например `1001`)
- **SIP пароль** — пароль из настроек Asterisk
- **Адрес АТС** — по умолчанию подставляется хост страницы и порт `8088` (при необходимости замените на IP/домен вашей АТС, например `ws://192.168.1.50:8088/ws`)

Нажмите **Подключиться** — готово, можно звонить.

Настройки сохраняются в браузере — при следующем открытии подключение произойдёт автоматически.

### Звук и HTTPS

- Входящий/исходящий **аудиопоток** привязывается к скрытому HTML‑audio; при первом звонке браузер может запросить доступ к микрофону.
- Страница по **HTTPS** должна подключаться к АТС по **`wss://`** (и наоборот: `http` → `ws`), иначе браузер заблокирует WebSocket.

## Настройка внешней АТС (Asterisk / FreePBX)

### Включите WebSocket транспорт

В `pjsip.conf` на сервере АТС:

```ini
[transport-ws]
type = transport
protocol = ws
bind = 0.0.0.0:8088
```

Или в `http.conf`:
```ini
[general]
enabled = yes
bindaddr = 0.0.0.0
bindport = 8088
```

### Создайте WebRTC extension

```ini
[1001]
type = endpoint
transport = transport-ws
context = from-internal
allow = ulaw,alaw
webrtc = yes
dtmf_mode = rfc4733

[1001]
type = auth
auth_type = userpass
username = 1001
password = ВашПароль123

[1001]
type = aor
max_contacts = 5
```

### Справочник контактов

Отредактируйте `client/public/contacts.json`:

```json
[
  { "extension": "1001", "name": "Иванов Иван", "department": "Отдел продаж" },
  { "extension": "1002", "name": "Петрова Анна", "department": "Бухгалтерия" }
]
```

## Функции

| Функция | Описание |
|---------|----------|
| 📞 Звонки | Набор номера, DTMF, входящие/исходящие |
| 📖 Справочник | Поиск по имени, номеру, отделу |
| 📋 История | Последние 20 вызовов |
| 🔇 Управление | Mute, Hold, ответ/отклонение |
| 🌗 Темы | Автоматическое определение Light/Dark |
| 💾 Автоподключение | Сохранение настроек в localStorage |
| 🚫 Zero-dependency | Нет БД, нет сервера, нет CDN |

## Структура

```
├── client/               # React приложение
│   ├── src/
│   │   ├── App.jsx           # Роутер: Connect → Phone
│   │   ├── pages/PhonePage.jsx    # Главный экран телефона
│   │   ├── components/
│   │   │   ├── QuickConnect.jsx   # Экран подключения
│   │   │   └── ...
│   │   ├── hooks/usePhone.js      # SIP/WebRTC логика
│   │   └── context/SIPContext.jsx # Хранение настроек
│   └── public/contacts.json       # Справочник сотрудников
└── docker-compose.yml    # Сервис `phone` (UI)
```

## Production

Для production с HTTPS:

1. Настройте reverse proxy (Caddy, Nginx + certbot)
2. Для WSS используйте `wss://` с доверенным сертификатом
3. Настройте CORS и TLS на Asterisk

## Лицензия

MIT
