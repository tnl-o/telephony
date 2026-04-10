# Корпоративная WebRTC телефония с LDAP интеграцией

Система корпоративной связи для 3000-5000 пользователей с авторизацией через Active Directory, WebRTC звонками из браузера и интеграцией с FreePBX для внешних звонков.

## 🚀 Возможности

- **LDAP/AD Авторизация**: Вход под учетной записью домена Windows
- **Автоматическая выдача номеров**: Диапазон 1000-5999 при первом входе
- **WebRTC звонки**: Звонки прямо из браузера через WSS (Opus кодек)
- **Телефонная книга**: Синхронизация с AD, поиск по ФИО и отделу
- **BLF статусы**: Отображение онлайн/офлайн/занят в реальном времени
- **Внешние звонки**: Интеграция с FreePBX через SIP транк (префикс 9)
- **Масштабируемость**: Поддержка до 5000 одновременных пользователей
- **Безопасность**: WSS шифрование, изолированная Docker сеть (CGNAT 100.64.0.0/10)

## 🏗 Архитектура

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Nginx     │────▶│   Backend    │────▶│ FreeSWITCH  │────▶│   FreePBX    │
│  (Proxy)    │     │  (Node.js)   │     │  (Media)    │     │   (Trunk)    │
│ 100.64.0.5  │     │ 100.64.0.20  │     │ 100.64.0.10 │     │ 192.168.x.x  │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
       ▲                    ▲                    ▲
       │                    │                    │
       └────────────────────┴────────────────────┘
                    Docker Network 100.64.0.0/24
```

### Компоненты:

1. **Frontend** (React + Vite + TailwindCSS)
   - Красивый UI с glassmorphism дизайном
   - JsSIP для WebRTC звонков
   - WebSocket для BLF статусов

2. **Backend** (Node.js + Express)
   - LDAP клиент для Active Directory
   - REST API для авторизации и управления пользователями
   - JSON база данных (`data/users.json`)
   - WebSocket сервер для статусов онлайн

3. **FreeSWITCH** (Media Server)
   - WSS профиль для браузерных клиентов
   - Кодеки: Opus (внутренние), G.711 (транк)
   - Маршрутизация: внутренние (1000-5999), внешние (9+номер)
   - Event Socket для интеграции с бэкендом

4. **Nginx** (Reverse Proxy)
   - SSL терминирование
   - Проксирование WebSocket (WSS)
   - Статика фронтенда

## 📋 Требования

- Docker и Docker Compose
- Контроллер домена Active Directory
- FreePBX (для внешних звонков, опционально)
- Сервер с минимум 4 ядрами CPU, 8GB RAM (для 1000+ пользователей)
- Открытые порты: 80, 443, 5060, 5061, 7443

## 🔧 Установка

### 1. Клонирование репозитория

```bash
git clone git@github.com:tnl-o/telephony.git
cd telephony
```

### 2. Инициализация проекта

```bash
chmod +x scripts/init.sh
./scripts/init.sh
```

Скрипт автоматически:
- Сгенерирует самоподписанные SSL сертификаты
- Создаст файл `.env` из шаблона
- Инициализирует базу пользователей `data/users.json`

### 3. Настройка переменных окружения

Отредактируйте файл `.env`, указав ваши данные:

```bash
nano .env
```

#### Обязательные параметры:

```env
# Active Directory
LDAP_URI=ldap://dc.company.local
LDAP_BASE_DN=DC=company,DC=local
LDAP_BIND_DN=CN=TelephonyService,CN=Users,DC=company,DC=local
LDAP_BIND_PASSWORD=YourPassword

# FreePBX (если используется)
FREEPBX_IP=192.168.1.100

# Секретные ключи (сгенерируйте случайные строки)
JWT_SECRET=your-random-secret-key-here
SESSION_SECRET=your-random-session-secret-here
```

#### Рекомендуемые атрибуты AD:

| Параметр | Значение по умолчанию | Описание |
|----------|----------------------|----------|
| `LDAP_USER_ATTRIBUTE` | `sAMAccountName` | Логин пользователя |
| `LDAP_DISPLAY_NAME_ATTRIBUTE` | `displayName` | ФИО для отображения |
| `LDAP_EMAIL_ATTRIBUTE` | `mail` | Email |
| `LDAP_DEPARTMENT_ATTRIBUTE` | `department` | Отдел |

### 4. Настройка FreePBX (опционально)

Для внешних звонков настройте транк на FreePBX:

1. В FreePBX создайте SIP транк типа "PJSIP" или "Chan_SIP":
   - **Host**: IP вашего сервера телефонии
   - **Port**: 5061
   - **Codecs**: G.711u (PCMU), G.711a (PCMA)
   - **Context**: from-freeswitch

2. В файле `freeswitch/conf/gateways/freepbx_trunk.xml` укажите:
   ```xml
   <variable name="hostname" value="192.168.1.100"/>
   <variable name="username" value="freepbx_trunk"/>
   <variable name="password" value="your_password"/>
   ```

3. Настройте входящую маршрутизацию на FreePBX:
   - Создайте IVR с запросом добавочного номера
   - Настройте маршрут на контекст FreeSWITCH

### 5. Запуск сервисов

```bash
docker-compose up -d
```

Проверьте статус:

```bash
docker-compose ps
```

Все сервисы должны быть в статусе `Up`.

### 6. Первый вход

1. Откройте браузер: `https://<IP-вашего-сервера>`
2. Примите самоподписанный сертификат (нажмите "Дополнительно" → "Перейти")
3. Войдите под учетной записью домена (логин/пароль AD)
4. Система автоматически:
   - Создаст пользователя в `data/users.json`
   - Выдаст свободный номер из диапазона 1000-5999
   - Сгенерирует SIP пароль
   - Подключит к FreeSWITCH через WSS

## 📞 Использование

### Внутренние звонки

1. Найдите сотрудника в телефонной книге
2. Нажмите кнопку 📞 для аудио звонка или 📹 для видео
3. Звонок пойдет напрямую через FreeSWITCH

### Внешние звонки

1. Откройте панель набора
2. Введите номер с префиксом **9** (например: `979991234567`)
3. Звонок пойдет через транк на FreePBX

### Статусы BLF

- 🟢 **Онлайн**: Пользователь авторизован в системе
- 🔴 **Офлайн**: Пользователь не в сети
- 🟡 **Занят**: Активный разговор (определяется по SIP статусу)

## 🔐 Безопасность

- Все соединения внутри Docker сети используют приватную подсеть `100.64.0.0/10` (CGNAT)
- WebRTC трафик шифруется через WSS (TLS)
- Пароли SIP генерируются случайно и хранятся в JSON
- LDAP пароли не сохраняются, используется bind-аутентификация
- Рекомендуется ограничить доступ к портам фаерволом

## 🛠 Администрирование

### Просмотр пользователей

```bash
cat data/users.json | jq .
```

### Ручное изменение номера

API endpoint (требуется авторизация):

```bash
curl -X POST http://localhost:3000/api/admin/user/ivanov.i/extension \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"extension": "2500"}'
```

### Логи

```bash
# Backend
docker-compose logs -f backend

# FreeSWITCH
docker-compose logs -f freeswitch

# Nginx
docker-compose logs -f nginx
```

### Перезапуск сервиса

```bash
docker-compose restart freeswitch  # Перезапуск FreeSWITCH
docker-compose restart backend     # Перезапуск бэкенда
```

## 📊 Мониторинг

### Статистика системы

API endpoint: `GET /api/stats`

Возвращает:
- Общее количество пользователей
- Количество онлайн
- Активные звонки
- Использованные номера

### Проверка регистрации SIP

```bash
docker-compose exec freeswitch fs_cli -x "show registrations"
```

## ⚙️ Конфигурация

### Основные файлы

| Файл | Описание |
|------|----------|
| `docker-compose.yml` | Оркестрация контейнеров |
| `.env` | Переменные окружения |
| `backend/src/ldap.js` | Настройки LDAP клиента |
| `freeswitch/conf/sip_profiles/internal.xml` | Профиль WSS |
| `freeswitch/conf/dialplan/default.xml` | План набора |
| `freeswitch/conf/gateways/freepbx_trunk.xml` | Транк на FreePBX |
| `data/users.json` | База пользователей |

### Изменение диапазона номеров

В файле `backend/src/userService.js` измените константы:

```javascript
const MIN_EXTENSION = 1000;
const MAX_EXTENSION = 5999;
```

### Добавление кодеков

В `freeswitch/conf/sip_profiles/internal.xml` секция `<codecs>`:

```xml
<codec name="OPUS" priority="1"/>
<codec name="PCMU" priority="2"/>
<codec name="PCMA" priority="3"/>
```

## 🐛 Диагностика проблем

### Пользователь не может войти

1. Проверьте подключение к AD:
   ```bash
   docker-compose logs backend | grep LDAP
   ```
2. Убедитесь, что учетная запись сервиса имеет права на чтение AD
3. Проверьте правильность `BASE_DN` и атрибутов в `.env`

### Нет звука в звонках

1. Проверьте, что порт 7443 (WSS) открыт
2. Убедитесь, что браузер поддерживает WebRTC
3. Проверьте логи FreeSWITCH:
   ```bash
   docker-compose logs freeswitch | grep -i error
   ```

### Не работают внешние звонки

1. Проверьте статус транка:
   ```bash
   docker-compose exec freeswitch fs_cli -x "sofia status gateway freepbx_trunk"
   ```
2. Убедитесь, что FreePBX доступен из Docker сети
3. Проверьте логи маршрутизации:
   ```bash
   docker-compose logs freeswitch | grep "dialplan"
   ```

## 📝 Лицензия

Проект создан для внутреннего использования компании.

## 🤝 Поддержка

При возникновении проблем создайте issue в репозитории с подробным описанием:
- Версии Docker и ОС
- Логи ошибок
- Шаги воспроизведения

---

**Версия**: 1.0.0  
**Дата обновления**: Апрель 2024
