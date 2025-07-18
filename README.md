# roleday-tag-bot
TG bot that advices tags for TRPGames.

## Как работает бот

- Пользователь пишет `/start` — создаётся новая строка в таблице entries для его id.
- Бот ведёт пользователя по подбору тегов через инлайн-меню с кнопками, задавая вопросы по очереди (меню и вопросы настраиваются через таблицу keyboards).
- Каждый выбор пользователя обновляет его запись в листе entries.
- После подбора тегов бот отправляет резюме в виде красиво оформленного сообщения (сопоставление тегов с текстами задаётся в коде).

## Как настраивать меню, кнопки и callback data

Вся логика меню, последовательностей вопросов и действий настраивается в листе keyboards Google-таблицы.

### Как устроена таблица keyboards

- Каждое меню занимает **две строки**:
    - **Первая строка** — название меню (поле keyboard), вопрос пользователю, далее названия кнопок.
    - **Вторая строка** (под первой) — в тех же столбцах callback data для каждой кнопки.

#### Пример (фрагмент):

| keyboard | question                                                 | Кнопка1     | Кнопка2   | Кнопка3               | ...     |
|----------|---------------------------------------------------------|-------------|-----------|-----------------------|---------|
| main     | ГЛАВНОЕ МЕНЮ...                                         | Направленность | Омегаверс | Дети и подростки      | ...     |
|          |                                                         | genre:open  | omega:open| underage:open         | ...     |

- **Текст кнопки** = то, что видит пользователь.
- **Callback data** = что делать при нажатии (логика в формате `поле:действие[:значение]`). Несколько действий через `|` (например, `genre:set:slash|pos:open`).

### Доступные действия

- **open** — открыть другое меню (например, `genre:open` откроет меню выбора направленности).
- **set** — установить поле (например, `gender:set:male` поставит мужской пол).
- **toggle** — добавить/убрать значение из мульти-тега (например, `gender_extra:toggle:bp`).
- **restart** — начать заново; все теги сбрасываются.
- **done** — завершить подбор тегов, показать результат и очистить запись пользователя.

При настройке callback data в таблице keyboards необходимо учитывать различие между типами действий и их аргументами:

**1. open — переход в другое меню**  
- Формат: `название_меню:open`
- Перед двоеточием указывается *имя нужного меню* (то есть идентификатор, под которым меню объявлено в первом столбце keyboards).
- Пример: если в callback стоит `omega:open`, бот ищет меню с названием `omega` и открывает его.

**2. set и toggle — работа с тегами**  
- Форматы:
    - set: `имя_тега:set:значение`
    - toggle: `имя_тега:toggle:значение`
- Перед set или toggle указывается название колонки (группы тегов) из таблицы entries, в которую будет записываться результат.
- Пример: `gender:set:male` установит тег `gender` в значение `male`, а `gender_extra:toggle:bp` добавит или уберёт "bp" из списка в колонке `gender_extra`.

**3. restart и done — универсальные действия**  
- Эти действия не привязаны к определённому тегу или меню.
- Формат: `:restart` или `:done` — значение до двоеточия роли не играет.
    - `main:restart` или `xyz:restart` — действие всегда начнёт подбор заново, удаляя все теги пользователя.
    - `main:done` или `abc:done` — показывает финальный результат и сбрасывает анкету пользователя.

## Какие теги поддерживает бот

Все выбранные теги для пользователя хранятся в листе **entries**. Перечень колонок и возможных значений (sf. keyboards + entries):

| Поле / столбец   | Значение                          | Примеры значений                        |
|------------------|-----------------------------------|-----------------------------------------|
| genre            | Направленность/жанр               | hetero, slash, femslash, gen            |
| underage         | Есть ли несовершеннолетние         | true                                    |
| fndm             | Ориджинал / фандом                | og, fndm                                |
| fndm_extra       | Фандомные спецификации            | og, au, gb, rpf, ooc                    |
| pos              | Базовая позиция                   | none, any                               |
| pos_extra        | Конкретные позиции                | act, uni, pass                          |
| gender           | Гендер персонажа                   | male, female, any                       |
| gender_extra     | Доп. гендерные особенности        | bp (бойпусси), futa (футанари)          |
| igender          | Гендерные особенности в паре      | ibp, ifuta, herm, trans                 |
| omega            | Роль в омегаверсе                 | alpha, omega, beta, gamma, any          |
| nhc              | NHC (нечеловеческие отношения)    | 1.0 (если отмечено)                     |
| xeno             | Ксенофилия                        | 1.0 (если отмечено)                     |
| style            | Особенности стиля                 | laps, half                              |
| sms              | Особенности формата коммуникаций  | sms, epist                              |
| platform         | Платформа для перехода            | tg, vk, other                           |

**Привязка значений к "чистым" русским названиям делается в функции getFinalTags:**  
- slash → слэш, femslash → фемслэш, hetero → гет, gen → джен  
- og → ориджинал, fndm → фандом  
- rpf → RPF, au → AU и т.д.  
- pos_extra: act/uni/pass → актива/универсала/пассива  
- gender_extra: bp → ищу бойпусси, futa → ищу футу  
- omega: alpha → ищу альфу, omega → ищу омегу и т.д.

**Дополнительные поля:**  
- nhc, xeno, igender, underage выводятся в дополнительном информационном блоке.

## Как добавить/изменить меню, кнопки, теги

- **Добавить меню:** вставьте две строки (первую с названиями кнопок и вопросом, вторую — с callback data) в табличку keyboards в нужное место.
- **Добавить кнопку:** добавьте столбец в нужное меню и внесите текст/действие.
- **Новое поле:** добавьте столбец в entries, настройте соответствующие меню и callback data для работы с этим полем, при необходимости доработайте сопоставление названия для вывода результата (getFinalTags в коде).
- **Изменить текст/логику:** вся "анкета" и логика переходов хранятся в листе keyboards: редактируйте вопросы, тексты кнопок, действия любой ячейкой.
