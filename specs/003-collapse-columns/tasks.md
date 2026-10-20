# Задачи

- [x] Спецификация и план
- [x] Кнопка, состояние, локализация
- [x] Регрессии и обязательные проверки
- [x] UI и итоговый статус

Результат: 695 тестов, coverage, lint, build и diff --check прошли. CUA: сворачивание 5 колонок до 2 и обратно, осмотр desktop-стенда 1280x720, ошибок JavaScript нет. Иконки в стенде заменены адаптером. Нативный Obsidian недоступен, установка в vault не выполнена.

Установка 2026-10-19: main.js, styles.css и manifest.json перенесены в Raincoat/.obsidian/plugins/column_explorer. SHA-256 совпадают с исходной сборкой, data.json не изменён. CLI подтвердил Reloaded: column-explorer и enabled=true. Резервная копия: /Users/nickeo23/.codex/backups/column-explorer/collapse-20261019-145208/. Следующий шаг: проверка кнопки владельцем в Obsidian.
