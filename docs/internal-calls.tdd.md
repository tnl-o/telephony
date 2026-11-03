# Проверки исправления доставки внутренних звонков

Пользовательский сценарий: два вошедших абонента регистрируются на одной АТС;
вызов A → B создаёт входящий вызов у B, B может ответить и завершить разговор.

## RED → GREEN

Исходный commit: `6767ac844a050d39c5ba768446bb2895c33a37cc`.
Контрольная точка тестов: `18b6b60` — 12 проверок, 2 успешных и 10 падающих
по соответствующим ошибкам адреса WSS, XML, синхронизации, ESL, сессий и dialplan.
Затем добавлены проверка общей конфигурации dev/prod и HTTP-интеграционный сценарий.
Ревью воспроизвело гонку публикаций XML: отдельный тест сначала падал (две
публикации вместо последовательной), после добавления очереди прошёл.

Итоговый запуск `npm test`: **15 passed, 0 failed**.

| Гарантия | Проверка |
|---|---|
| WSS использует hostname сайта, в том числе IPv6; явный override сохраняется | internal-calls.test.cjs |
| ФИО/пароли безопасно кодируются в XML; ошибки записи передаются наверх | internal-calls.test.cjs |
| Неверные номера не меняют каталог | internal-calls.test.cjs |
| Смена номера и повторный вход ожидают каталог и reload ACK | internal-calls.test.cjs |
| SIP-домен не зависит от DNS-имени ESL-соединения | internal-calls.test.cjs |
| ESL различает greeting/auth/API, собирает частичные TCP-кадры, обрабатывает отказ/обрыв/таймаут | internal-calls.test.cjs |
| Входящая сессия передаётся UI и answer работает с ней | internal-calls.test.cjs |
| Второй звонок не перезаписывает первый; старые события не очищают новую сессию | internal-calls.test.cjs |
| accepted/confirmed дают один переход active | internal-calls.test.cjs |
| Dialplan содержит lookup фактического SIP-контакта | internal-calls.test.cjs, статическая проверка |
| Перекрывающиеся публикации не затирают нового абонента | internal-calls.test.cjs |
| Настоящий HTTP backend создаёт двух абонентов, возвращает реквизиты и синхронизирует смену номера | backend-integration.test.cjs, тестовый TCP ESL |

## Остальные проверки

- `npm --prefix frontend run build`: PASS, Vite production build.
- `node --check backend/src/index.js`, `node --check backend/src/userService.js`: PASS.
- Разбор обоих compose через YAML parser и проверка одинакового SIP_DOMAIN/shared volume: PASS.
- Разбор изменённого dialplan и internal profile XML: PASS.
- `sh -n` для entrypoint и извлечённой команды dev nginx: PASS.
- `git diff --check`: PASS.
- Code review: исправлены найденные гонка XML, LAN SAN сертификата и поиск upstream entrypoint.

`npm run test:coverage` выполнен: встроенный отчёт показал 41,77% строк для
непосредственно загруженных simpleAuth/userService. Он не учитывает основную
часть логики, выполняемую в VM-контекстах и дочернем HTTP-процессе. Порог 80%
не подтверждён; покрытие всего приложения этим набором не заявляется.

Docker build, FreeSWITCH runtime, реальные браузерные INVITE и медиа не проверялись:
Docker/АТС в среде отсутствуют. Инструкция приёмки на стенде: internal-calls.md.
Проверка с имитацией ESL подтверждает порядок протокольных операций, но не заменяет АТС.
