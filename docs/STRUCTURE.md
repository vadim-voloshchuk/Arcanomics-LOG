# Структура репозитория

[На главную](../README.md)

## Карта каталогов

```text
Arcanomics-LOG/
├── .gitignore
├── README.md
├── CONTRIBUTING.md
├── docs/
│   ├── GETTING_STARTED.md
│   ├── STRUCTURE.md
│   ├── ARCHITECTURE.md
│   ├── SIMULATION.md
│   ├── TOPOLOGY.md
│   ├── DATA.md
│   └── KNOWN_ISSUES.md
└── Analitics/
    ├── igra.py
    ├── Отчет по первой недели.docx
    └── 1/Arcanomics/
        ├── README.md
        ├── main.py
        ├── requirements.txt
        ├── interactive_simulation_map.html
        ├── src/
        │   ├── graph.py
        │   ├── visualization.py
        │   ├── analytics.py
        │   ├── init.js
        │   ├── weather.js
        │   ├── economy.js
        │   ├── logistics.js
        │   └── simulation.js
        ├── data/
        │   ├── cities.json
        │   ├── goods.json
        │   ├── roads.json
        │   ├── price_history.csv
        │   ├── simulation_log.csv
        │   ├── routes_history.csv
        │   ├── weather_events.csv
        │   └── weather_history/
        │       ├── bavaria.csv
        │       ├── rostov.csv
        │       ├── texas.csv
        │       └── tokyo.csv
        └── lib/
            ├── bindings/
            ├── tom-select/
            └── vis-9.1.2/
```

В дереве опущены три уже отслеживаемых файла `__pycache__/*.pyc`. Они сохранены как существующие артефакты; новый `.gitignore` исключает новые кэши, но не удаляет файлы из истории или индекса Git.

## Назначение частей

| Путь | Роль |
| --- | --- |
| [`main.py`](../Analitics/1/Arcanomics/main.py) | Основная точка входа для генерации карты |
| [`src/`](../Analitics/1/Arcanomics/src/) | Модульная версия Python-генератора и браузерной модели |
| [`data/`](../Analitics/1/Arcanomics/data/) | Входные справочники, рассчитанные дороги и исторические результаты |
| [`lib/`](../Analitics/1/Arcanomics/lib/) | Поставленные браузерные библиотеки и вспомогательные файлы Pyvis |
| [`interactive_simulation_map.html`](../Analitics/1/Arcanomics/interactive_simulation_map.html) | Сохранённая страница более ранней версии; генератор заменяет её |
| [`Analitics/igra.py`](../Analitics/igra.py) | Самостоятельный ранний прототип с шестью географическими узлами; не импортируется основным приложением |
| [`Отчет по первой недели.docx`](../Analitics/Отчет%20по%20первой%20недели.docx) | Сохранённый отчёт; приложением не читается |

Каталог называется именно `Analitics`. Его написание и вложенность оставлены прежними, чтобы сохранить существующие пути. Каталогов `results/` и `experiments/` в исходном дереве нет; автоматическое сохранение туда не реализовано.

## Что считать источником поведения

Для модульной версии ориентируйтесь на `main.py`, `src/` и читаемые ими JSON. Сохранённый HTML содержит собственную старую копию JavaScript. Изменение `src/` не обновляет уже открытый или сохранённый HTML: сначала требуется генерация, затем перезагрузка страницы.

`data/roads.json` имеет двойную роль: это отслеживаемый снимок сети, который `graph.py` перезаписывает. Он не служит входным описанием дорог для `create_graph()`. CSV результатов — снимки проведённого эксперимента; генератор карты их не читает.
