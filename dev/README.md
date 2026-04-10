# Локальный стенд (Docker)

Поднимает **FreeSWITCH**, **backend** (режим без LDAP), **frontend** и **nginx** с HTTPS на порту **8443**. Подходит для проверки в LAN.

## Быстрый старт

1. Скопируйте переменные окружения (один раз):

   ```bash
   cp .env.example .env
   ```

2. Из каталога `dev/`:

   ```bash
   docker compose up --build
   ```

3. Откройте в браузере: `https://<ваш-LAN-IP>:8443`  
   Примите предупреждение о самоподписанном сертификате (nginx создаёт его при первом запуске в `./ssl/`).

## Логины (без Active Directory)

В `.env` задано `AUTH_MODE=simple` и список пользователей `DEV_USERS`:

- по умолчанию: **demo** / **demo**, **alice** / **alice123**, **bob** / **bob123**

Логин приводится к нижнему регистру при проверке.

## SIP / WebRTC

- Добавочные **1000–1039** заранее заведены во FreeSWITCH с общим паролем **`devsip`** (файл `freeswitch/directory/local-extensions.xml`).
- Backend в режиме `simple` выдаёт всем тот же SIP-пароль из **`DEV_SIP_PASSWORD`** (должен совпадать с паролем в XML, по умолчанию `devsip`).
- **WSS** идёт через nginx: `wss://<ваш-хост>:8443/sip` (не задавайте **`SIP_WSS_URL=wss://127.0.0.1:...`** в `.env`, иначе с другого ПК SIP уйдёт в localhost того клиента).
- **Звонки с другого компьютера в LAN:** в `.env` укажите **`PUBLIC_HOST=<LAN-IP сервера>`** (например `192.168.0.11`). Тогда FreeSWITCH в SDP подставит этот адрес для RTP, а не внутренний Docker `100.64.x.x`. На сервере откройте в брандмауэре **входящие UDP 16384–16448** (проброс Docker на хост).
- Внутренний dialplan **не делает `answer` до `bridge`** (иначе WebRTC-звонок «зависает» на инициаторе и второй клиент не получает входящий). Профиль `internal` явно привязан к контексту **`default`**.

## Смена SIP-пароля или диапазона добавочных

```bash
node scripts/generate-fs-directory.js ваш_пароль
```

Затем выставьте тот же пароль в `.env` как `DEV_SIP_PASSWORD` и перезапустите контейнеры.

## Доступ с другого ПК по HTTPS

Если браузер ругается на сертификат nginx, пересоздайте сертификат с SAN, включающим IP вашей машины (на хосте нужен OpenSSL):

```powershell
# пример: Windows PowerShell из dev/scripts
openssl req -x509 -nodes -days 825 -newkey rsa:2048 `
  -keyout ..\ssl\key.pem -out ..\ssl\cert.pem `
  -subj "/CN=telephony-dev" `
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.1.10"
```

После этого перезапустите `nginx` (`docker compose restart nginx`).

## Продакшен / LDAP

Этот compose только для разработки. Для AD/LDAP используйте корневой `docker-compose.yml` и настройку LDAP в окружении backend.
