# Tasks: Повседневное удобство

## Setup
- [x] T001 Сохранить исходный снимок и сверить инструкции в .plan.md.
- [x] T002 Зафиксировать требования и интерфейсы в specs/002-daily-usability/.

## US1: Фильтр
- [x] T003 [US1] Реализовать область, счётчик и поиск в src/view.ts и src/search.ts.
- [x] T004 [US1] Проверить фильтр и поиск в tests/view.test.ts и tests/search.test.ts.

## US2: Выделение
- [x] T005 [US2] Добавить desktop-панель, Escape и очистку устаревшего выбора в src/view.ts.
- [x] T006 [US2] Проверить операции и фокус в tests/view.test.ts.

## US3: Сортировка
- [x] T007 [P] [US3] Добавить доступный индикатор и меню в src/column.ts и src/menus.ts.
- [x] T008 [US3] Проверить наследование и действия в tests/column.test.ts и tests/menus.test.ts.

## US4: Quick Look
- [x] T009 [P] [US4] Добавить навигацию и безопасную смену контента в src/modals.ts и src/preview.ts.
- [x] T010 [US4] Проверить границы и асинхронные переходы в tests/modals.test.ts и tests/preview.test.ts.

## Integration
- [x] T011 Добавить локализацию и адаптивные стили в src/locales/ и styles.css.
- [x] T012 Проверить и исправить связанные сбои в src/fileops.ts и src/mobile.ts с регрессиями.
- [x] T013 Выполнить ревью, lint, coverage, build и UI; записать specs/002-daily-usability/verification.md.
- [x] T014 Обновить README.md, CHANGELOG.md и .plan.md.

## Dependencies and parallel work
T001-T002 предшествуют реализации. US1 и US2 последовательно из-за общего view.ts; US3 и US4 параллельно в отдельных файлах. Локали и CSS интегрирует главный агент. T013 после интеграции. Каждый сценарий проверяется отдельно согласно spec.md. Первый проверяемый срез: US1; задача включает все четыре сценария.
