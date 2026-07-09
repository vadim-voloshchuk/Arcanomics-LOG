# noinspection PyTypeChecker
import networkx as nx
from pyvis.network import Network

# --- 1. СТРОИМ СТРУКТУРУ ГРАФА ---
G = nx.Graph()

connections = [
    ("Ростовская область", "Таганрог"),
    ("Ростовская область", "Ростов-на-Дону"),
    ("Ростовская область", "Азов"),
    ("Таганрог", "Неклиновский район"),
    ("Ростов-на-Дону", "Аксай"),
    ("Азов", "Азовский район")
]
G.add_edges_from(connections)

net = Network(height="800px", width="100%", bgcolor="#1a1a1a", font_color="white")

for node in G.nodes:
    node_str = str(node)
    if node_str == "Ростовская область":
        net.add_node(node_str, label=node_str, title="", size=40, color="#ff4d4d")
    elif "район" in node_str:
        net.add_node(node_str, label=node_str, title="", size=20, color="#2ecc71")
    else:
        net.add_node(node_str, label=node_str, title="", size=28, color="#3498db")

for u, v in G.edges:
    net.add_edge(u, v, color="#555555", width=2)

net.toggle_physics(True)
net.set_options('{"interaction": {"hover": true, "tooltipDelay": 50}}')

output_file = "interactive_simulation_map.html"
net.write_html(output_file)

# --- 2. ВНЕДРЯЕМ ПРОДВИНУТУЮ СИМУЛЯЦИЮ ВРЕМЕНИ И ПОГОДЫ ---
js_simulation_code = """
<script type="text/javascript">
// Глобальное игровое время
var gameHour = 6;  // Начинаем в 6 утра
var gameDay = 1;

// Реалистичные списки производства для Ростовской области
var industrialDirectory = {
    "Ростовская область": { prod: "Электроэнергия, Уголь, Зерно", imp: "Нефтепродукты, Высокие технологии" },
    "Таганрог": { prod: "Стальной прокат, Трубы (ТАГМЕТ), Котлы (Красный Котельщик), Зерноуборочные комплексы", imp: "Металлолом, Электроника" },
    "Ростов-на-Дону": { prod: "Комбайны (Ростсельмаш), Вертолеты (Роствертол), Спецодежда, Растительное масло", imp: "Металл, Химическое сырье" },
    "Азов": { prod: "Кованые колесные диски, Пищевая тара, Обувь, Замороженная рыба", imp: "Пластик, Спецкраски" },
    "Неклиновский район": { prod: "Озимая пшеница, Подсолнечник, Молоко, Прудовая рыба", imp: "Удобрения, Горюче-смазочные материалы" },
    "Аксай": { prod: "Строительные смеси, Пластиковые трубы, Хлебобулочные изделия", imp: "Мука, Цементный клинкер" },
    "Азовский район": { prod: "Овощи открытого грунта, Мясо птицы, Товарный кормовой ячмень", imp: "Семена элитных сортов, Корма" }
};

var citySimulations = {};

network.on("stabilizationIterationsDone", function () {
    var nodeIds = nodes.getIds();
    nodeIds.forEach(function(id) {
        var isRegion = (id === "Ростовская область");
        var basePop = isRegion ? 4100000 : Math.floor(Math.random() * (180000 - 40000) + 40000);
        if (id === "Ростов-на-Дону") basePop = 1140000;
        if (id === "Таганрог") basePop = 245000;

        var economy = industrialDirectory[id] || { prod: "Товары народного потребления", imp: "Сырье" };

        // Начальное состояние погоды
        citySimulations[id] = {
            population: basePop,
            migration: 0,
            produced: economy.prod,
            imported: economy.imp,
            baseTemp: parseFloat((Math.random() * (28 - 22) + 22).toFixed(1)), // Базовая климатическая норма
            currentTemp: 22.0,
            weatherType: "sunny", // sunny, rainy, drought
            weatherDuration: Math.floor(Math.random() * 5) + 3, // Сколько дней продлится текущий тип погоды
            humidity: 50
        };
    });

    // Шаг времени: 1 час симуляции каждые 1.5 секунды реального времени
    setInterval(updateGameTime, 1500);
});

function updateGameTime() {
    gameHour++;
    if (gameHour >= 24) {
        gameHour = 0;
        gameDay++;

        // Раз в день проверяем смену глобальных метеорологических циклов (засуха/сезон дождей)
        for (var id in citySimulations) {
            var data = citySimulations[id];
            data.weatherDuration--;
            if (data.weatherDuration <= 0) {
                // Случайный выбор нового погодного фронта на несколько дней
                var rand = Math.random();
                if (rand < 0.2) { data.weatherType = "drought"; data.weatherDuration = Math.floor(Math.random() * 4) + 4; } // Засуха на 4-7 дней
                else if (rand < 0.5) { data.weatherType = "rainy"; data.weatherDuration = Math.floor(Math.random() * 3) + 2; } // Дожди на 2-5 дней
                else { data.weatherType = "sunny"; data.weatherDuration = Math.floor(Math.random() * 5) + 3; } // Нормальное лето
            }
        }
    }
    runSimulationStep();
}

function runSimulationStep() {
    // Форматируем время для отображения
    var timeString = (gameHour < 10 ? "0" + gameHour : gameHour) + ":00";

    for (var id in citySimulations) {
        var data = citySimulations[id];

        // 1. Медленная миграция (не тысячи человек сразу, а реалистичные 1-5 человек в час)
        data.migration = Math.floor(Math.random() * 11) - 5; // от -5 до +5 человек в час
        data.population += data.migration;

        // 2. РЕАЛИСТИЧНАЯ ФИЗИКА ПОГОДЫ И ТЕМПЕРАТУРЫ
        // Суточный ход температуры: холоднее всего в 4 утра, жарче всего в 14-15 дня
        var dailyCycleModifier = -Math.cos((gameHour - 4) * 2 * Math.PI / 24); // Выдает плавную волну от -1 до +1
        var amplitude = 7; // Амплитуда колебания температуры в течение суток (плюс-минус 7 градусов)

        var targetTemp = data.baseTemp + (dailyCycleModifier * amplitude);

        // Корректируем температуру под погодный фронт
        var weatherLabel = "";
        var physicsLabel = "💧 Влажность в норме";

        if (data.weatherType === "drought") {
            targetTemp += 6; // При засухе температура намного выше нормы
            weatherLabel = "☀️ Длительная засуха";
            data.humidity = Math.max(15, data.humidity - 1); // Влажность падает
            physicsLabel = "💨 Интенсивное парообразование (Почва теряет влагу)";
        } else if (data.weatherType === "rainy") {
            targetTemp -= 4; // Дождь охлаждает воздух
            weatherLabel = "🌧️ Затяжные дожди";
            data.humidity = Math.min(95, data.humidity + 2);
            physicsLabel = "🌧️ Насыщение почвы водой";
        } else {
            weatherLabel = "🌤️ Переменная облачность";
            // Плавное возвращение влажности к норме в 50%
            if (data.humidity > 50) data.humidity--;
            if (data.humidity < 50) data.humidity++;
        }

        // Исключительный физический фактор: Слепой дождь в сильную жару
        if (data.weatherType === "drought" && Math.random() < 0.05) {
            weatherLabel = "☀️ Засуха + 🌧️ Внезапный слепой дождь!";
            physicsLabel = "⚠️ Экстремальное парообразование: влажность мгновенно превращается в горячий пар!";
            data.humidity = 80;
        }

        data.currentTemp = parseFloat(targetTemp.toFixed(1));

        // Вычисляем статус миграции для вывода
        var migrationText = data.migration >= 0 ? "🟢 Прирост: +" + data.migration : "🔴 Убыль: " + data.migration;

        var tooltipText = 
            "=== " + id.toUpperCase() + " ===\\n" +
            "⏳ Время симуляции: День " + gameDay + ", " + timeString + " (МСК, UTC+3)\\n" +
            "-----------------------------\\n" +
            "👥 Население: " + data.population.toLocaleString() + " чел.\\n" +
            "   (" + migrationText + " за тек. час)\\n" +
            "-----------------------------\\n" +
            "📦 Производство: " + data.produced + "\\n" +
            "🛍️ Закупки (Импорт): " + data.imported + "\\n" +
            "-----------------------------\\n" +
            "🌡️ Температура: " + data.currentTemp + " °C (Влажность: " + data.humidity + "%)\\n" +
            "🌤️ Климат: " + weatherLabel + "\\n" +
            "🔬 Физика среды: " + physicsLabel;

        nodes.update({id: id, title: tooltipText});
    }
}
</script>
</body>
"""

with open(output_file, 'r', encoding='utf-8') as file:
    html_content = file.read()

html_content = html_content.replace("</body>", js_simulation_code)

with open(output_file, 'w', encoding='utf-8') as file:
    file.write(html_content)
