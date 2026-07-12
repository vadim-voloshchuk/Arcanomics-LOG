import json
from typing import cast
import networkx as nx
from pyvis.network import Network

# --- 1. СТРОИМ СТРУКТУРУ ГРАФА С АЛЬТЕРНАТИВНЫМИ ПУТЯМИ ---
G = nx.Graph()

connections = [
    ("Ростов-на-Дону", "Аксай", [
        {"name": "Трасса М-4 Дон", "dist": 12, "speed": 90},
        {"name": "Аксайский проспект", "dist": 15, "speed": 60}
    ]),
    ("Ростов-на-Дону", "Таганрог", [
        {"name": "Трасса А-280", "dist": 75, "speed": 90},
        {"name": "Старая Чалтырская дорога", "dist": 82, "speed": 70}
    ]),
    ("Ростов-на-Дону", "Азов", [
        {"name": "Новая Азовская трасса", "dist": 35, "speed": 90},
        {"name": "Староазовская дорога", "dist": 40, "speed": 60}
    ]),
    ("Таганрог", "Неклиновский район", [
        {"name": "Мариупольское шоссе", "dist": 25, "speed": 80},
        {"name": "Северный обход Таганрога", "dist": 30, "speed": 60}
    ]),
    ("Азов", "Азовский район", [
        {"name": "Трасса 60К-60", "dist": 15, "speed": 80},
        {"name": "Грунтовый объезд", "dist": 18, "speed": 40}
    ]),
    ("Неклиновский район", "Азов", [
        {"name": "Дорога через Чалтырь и дельту Дона", "dist": 95, "speed": 70},
        {"name": "Маршрут через Ростовский обход", "dist": 115, "speed": 90}
    ]),
    ("Аксай", "Азовский район", [
        {"name": "Восточный обход Ростова", "dist": 42, "speed": 80},
        {"name": "Старочеркасский тракт", "dist": 50, "speed": 50}
    ])
]

for u, v, routes in connections:
    G.add_edge(u, v, routes=routes)

net = Network(height="800px", width="100%", bgcolor="#1a1a1a", font_color="white")

city_coordinates = {
    "Ростов-на-Дону": {"x": 0, "y": 0},
    "Аксай": {"x": 200, "y": -50},
    "Таганрог": {"x": -450, "y": 50},
    "Неклиновский район": {"x": -650, "y": -50},
    "Азов": {"x": -150, "y": 300},
    "Азовский район": {"x": 50, "y": 400}
}

# --- 2. НАПОЛНЕНИЕ ГРАФА УЗЛАМИ С ФИКСИРОВАННЫМИ ПОЗИЦИЯМИ ---
for node in G.nodes:
    node_str = cast(str, node)
    coords = city_coordinates.get(node_str, {"x": 0, "y": 0})
    
    if "район" in node_str:
        net.add_node(node_str, label=node_str, title="", size=24, color="#2ecc71", x=coords["x"], y=coords["y"], physics=False)
    else:
        net.add_node(node_str, label=node_str, title="", size=32, color="#3498db", x=coords["x"], y=coords["y"], physics=False)

# --- 3. ДОБАВЛЕНИЕ РЕБЕР С ЖЕСТКИМИ СТАТИЧЕСКИМИ ID ---
roads_data_for_js = []

for index, (u, v, data) in enumerate(G.edges(data=True)):
    u_str = cast(str, u)
    v_str = cast(str, v)
    edge_id = f"edge_{index}"
    
    roads_data_for_js.append({
        "id": edge_id,
        "u": u_str,
        "v": v_str,
        "routes": data["routes"]
    })
    
    net.add_edge(
        u_str, 
        v_str,
        id=edge_id,
        color="#777777", 
        width=2,
        label="Расчет...",
        title="Загрузка...",
        font={"size": 13, "color": "#ffffff", "align": "top"}
    )

net.toggle_physics(False)
net.set_options('{"interaction": {"hover": true, "tooltipDelay": 10}}')

output_file = "interactive_simulation_map.html"
net.write_html(output_file)

# --- 4. ВНЕДРЯЕМ ОБЪЕДИНЕННУЮ СИМУЛЯЦИЮ В HTML ---
json_roads = json.dumps(roads_data_for_js, ensure_ascii=False)

js_simulation_code = """
<script type="text/javascript">
// Точное точечное время симуляции
var gameSecond = 0;
var gameMinute = 0;
var gameHour = 6; // Стартуем в 06:00:00
var gameDay = 1;

var citySimulations = {};
var roadNetwork = """ + json_roads + """;

window.onload = function () {
    var nodeIds = nodes.getIds();
    nodeIds.forEach(function(id) {
        var basePop = Math.floor(Math.random() * (180000 - 40000) + 40000);
        if (id === "Ростов-на-Дону") basePop = 1140000;
        if (id === "Таганрог") basePop = 245000;
        
        var cityProducts = {
            "Хлеб": { stock: 50, base_price: 40, last_price: 40, current_price: 40 },
            "Дерево": { stock: 60, base_price: 30, last_price: 30, current_price: 30 },
            "Камень": { stock: 70, base_price: 20, last_price: 20, current_price: 20 }
        };
        
        var specialization = "Потребитель";
        if (id === "Ростов-на-Дону") specialization = "Торговый Хаб (Экспорт: Хлеб, Дерево | ...)";
        else if (id === "Таганрог" || id === "Аксай") specialization = "Промышленность (Выпуск: Дерево)";
        else if (id === "Неклиновский район" || id === "Азовский район") specialization = "Агрокомплекс (Выпуск: Хлеб)";
        else if (id === "Азов") specialization = "Горнодобыча (Выпуск: Камень)";

        citySimulations[id] = {
            population: basePop,
            migration: 0,
            products: cityProducts,
            specializationText: specialization,
            baseTemp: Math.random() * (28 - 22) + 22,
            currentTemp: 22.0,
            weatherType: "sunny",
            weatherDuration: Math.floor(Math.random() * 5) + 3,
            humidity: 50,
            currentEvent: "Нет"
        };
    });
    
    runSimulationStep();
    
    // Высокоточное обновление: время бежит вперед каждые 50 миллисекунд реального времени!
    // За одну реальную секунду пройдет примерно 20 игровых минут
    setInterval(updateExactGameTime, 1000);
};

function updateExactGameTime() {

    gameSecond++;

    if (gameSecond >= 60) {
        gameSecond = 0;
        gameMinute++;
    }

    if (gameMinute >= 60) {
        gameMinute = 0;
        gameHour++;
    }

    if (gameHour >= 24) {
        gameHour = 0;
        gameDay++;
    }

    // Раз в час небольшая миграция населения
    if (gameMinute === 0 && gameSecond === 0) {
        for (var id in citySimulations) {
            citySimulations[id].population += Math.floor(Math.random() * 3) - 1;
        }
    }

    // Раз в сутки смена погодных циклов
    if (gameHour === 0 && gameMinute === 0 && gameSecond === 0) {
        for (var id in citySimulations) {
            var data = citySimulations[id];

            data.weatherDuration--;

            if (data.weatherDuration <= 0) {
                var rand = Math.random();

                if (rand < 0.25) {
                    data.weatherType = "drought";
                    data.weatherDuration = Math.floor(Math.random() * 4) + 3;
                } else if (rand < 0.5) {
                    data.weatherType = "rainy";
                    data.weatherDuration = Math.floor(Math.random() * 3) + 2;
                } else {
                    data.weatherType = "sunny";
                    data.weatherDuration = Math.floor(Math.random() * 5) + 3;
                }
            }
        }
    }

    runSimulationStep();
}

function runSimulationStep() {
    // Форматируем время ЧЧ:ММ:СС с ведущими нулями
    var hStr = gameHour < 10 ? "0" + gameHour : gameHour;
    var mStr = gameMinute < 10 ? "0" + gameMinute : gameMinute;
    var sStr = gameSecond < 10 ? "0" + gameSecond : gameSecond;
    var exactTimeString = hStr + ":" + mStr + ":" + sStr;

    // 1. ВНУТРЕННЯЯ ЭКОНОМИКА ГОРОДОВ И РАСЧЕТ ЦЕН
    for (var id in citySimulations) {
        var data = citySimulations[id];
        
        var dailyCycle = -Math.cos((gameHour - 4) * 2 * Math.PI / 24);
        var targetTemp = data.baseTemp + (dailyCycle * 8);
        
        data.currentEvent = "Нет";
        if (data.weatherType === "drought") { targetTemp += 5; data.currentEvent = "Засуха"; data.humidity = Math.max(15, data.humidity - 0.1); }
        else if (data.weatherType === "rainy") { targetTemp -= 4; data.currentEvent = "Дождь"; data.humidity = Math.min(95, data.humidity + 0.2); }
        else { if (data.humidity > 50) data.humidity -= 0.1; if (data.humidity < 50) data.humidity += 0.1; }
        
        if (targetTemp < 10) targetTemp = 10;
        data.currentTemp = parseFloat(targetTemp.toFixed(1));

        // Рассчитываем микро-объемы производства, деленные на минуты, для плавного роста складов
        var generalWeatherBonus = 0;
        if (data.currentEvent.includes("Дождь")) generalWeatherBonus = 0.1;
        if (data.currentEvent.includes("Засуха")) generalWeatherBonus = -0.1;

        var goodsText = "";
        for (var pName in data.products) {
            var item = data.products[pName];
            var baseProductVolume = 0; 
            
            if (id === "Ростов-на-Дону") {
                if (pName === "Хлеб") baseProductVolume = 0.25;
                if (pName === "Дерево") baseProductVolume = 0.2;
                if (pName === "Камень") baseProductVolume = 0;
            } 
            else if (id === "Неклиновский район" || id === "Азовский район") {
                if (pName === "Хлеб") baseProductVolume = 0.35;
                else baseProductVolume = 0.03;
            } 
            else if (id === "Таганрог" || id === "Аксай") {
                if (pName === "Дерево") baseProductVolume = 0.3; 
                else baseProductVolume = 0.03;
            } 
            else if (id === "Азов") {
                if (pName === "Камень") {
                    baseProductVolume = 0.25;
                    if (data.currentEvent.includes("Засуха") && data.currentTemp > 38) baseProductVolume -= 0.15;
                    else if (data.currentEvent.includes("Дождь")) baseProductVolume -= 0.05;
                } else {
                    baseProductVolume = 0.02;
                }
            }

            if (pName !== "Камень" && baseProductVolume > 0.05) baseProductVolume += generalWeatherBonus;
            if (baseProductVolume < 0) baseProductVolume = 0;

            var baseBuyVolume = (id === "Ростов-на-Дону" && pName === "Камень") ? 0.3 : 0.15;

            // Склады пополняются и пустеют плавно каждую минуту
            item.stock += baseProductVolume; 
            item.stock -= baseBuyVolume; 
            if (item.stock < 0) item.stock = 0;
            
            var demand = Math.round(baseBuyVolume * 60);
            var currentProdPerHour = Math.round(baseProductVolume * 60);
            var supply = currentProdPerHour + Math.round(item.stock);
                        var ratio = supply === 0 ? 1.3 : demand / supply;
            ratio = Math.max(0.7, Math.min(ratio, 1.3));
            var priceMarket = item.base_price * ratio;
            
            var priceLinear = item.base_price + (demand - currentProdPerHour) * 1.5 - item.stock * 0.2;
            if (data.currentEvent === "Засуха") priceLinear += 6; if (data.currentEvent === "Дождь") priceLinear -= 4;
            priceLinear = Math.max(10, Math.min(priceLinear, 80));
            
            var priceInertia = item.last_price + (demand - currentProdPerHour) * 0.8 - item.stock * 0.1;
            if (data.currentEvent === "Засуха") priceInertia += 5; if (data.currentEvent === "Дождь") priceInertia -= 3;
            priceInertia = Math.max(10, Math.min(priceInertia, 80));
            
            item.last_price = priceInertia;
            item.current_price = priceInertia;
            
            var specialNote = "";
            if (pName === "Камень") {
                if (data.currentEvent.includes("Засуха") && data.currentTemp > 38) specialNote = " (Жара -80%)";
                else if (data.currentEvent.includes("Дождь")) specialNote = " (Дождь -20%)";
            }
            
            // ИСПОЛЬЗУЕМ \\n ДЛЯ КОРРЕКТНЫХ ПЕРЕНОСОВ СТРОК В ТАБЛИЦЕ ГОРОДА
            goodsText += "\\n[ TOBAP: " + pName + specialNote + " ]" +
                         "\\n * Производство : " + currentProdPerHour + " ед./ч (прогноз)" +
                         "\\n * Спрос (Закупки): " + demand + " ед./ч" +
                         "\\n * Предложение  : " + supply + " ед. (На складе: " + Math.round(item.stock) + ")" +
                         "\\n * Цена (Рыночн) : " + priceMarket.toFixed(1) + " руб." +
                         "\\n * Цена (Линейн) : " + priceLinear.toFixed(1) + " руб." +
                         "\\n * Цена (Инерц)  : " + priceInertia.toFixed(1) + " руб.\\n";
        }

        var tooltipText = "ГОРОД: " + id.toUpperCase() + 
                          "\\nПрофиль: " + data.specializationText + 
                          "\\n-------------------------------------" + 
                          "\\n⏳ Высокоточное время: День " + gameDay + ", " + exactTimeString + 
                          "\\n👥 Население: " + data.population.toLocaleString() + " чел." + 
                          "\\n🌡️ Погода: " + data.currentTemp + " C | Среда: " + data.currentEvent + 
                          "\\n💧 Влажность: " + parseFloat(data.humidity.toFixed(1)) + "%" + 
                          "\\n-------------------------------------" + goodsText;
                          
        nodes.update({id: id, title: tooltipText});
    }

    // 2. АДАПТИВНОЕ ОБНОВЛЕНИЕ ДОРОГ, ВРЕМЕНИ И ЛОГИСТИКИ КАРАВАНОВ
    roadNetwork.forEach(function(road) {
        var cityA = citySimulations[road.u];
        var cityB = citySimulations[road.v];
        
        var speedModifier = 1.0;
        var weatherNotice = "Отличная видимость";
        
        if (cityA.currentEvent === "Дождь" || cityB.currentEvent === "Дождь") { 
            speedModifier = 0.70; 
            weatherNotice = "Мокрый асфальт (Скорость -30%)"; 
        } else if (cityA.currentEvent === "Засуха" || cityB.currentEvent === "Засуха") { 
            if (cityA.currentTemp > 38 || cityB.currentTemp > 38) { 
                speedModifier = 0.80; 
                weatherNotice = "Экстремальная жара (Скорость -20%)"; 
            } 
        }

        var tempRoutesList = road.routes.slice(0, 1);
        var mainRoute = tempRoutesList.shift();
        
        var distance = mainRoute.dist;
        var transportCost = distance * 0.1; 

        var activeTradeCargo = "Нет активных караванов";
        var isTradingNow = false;

        var productNames = ["Хлеб", "Дерево", "Камень"];
        for (var i = 0; i < productNames.length; i++) {
            var pName = productNames[i];
            var priceInA = cityA.products[pName].current_price;
            var priceInB = cityB.products[pName].current_price;
            
            if (priceInA > (priceInB + transportCost) && cityB.products[pName].stock > 10) {
                cityB.products[pName].stock -= 0.5; 
                cityA.products[pName].stock += 0.5;
                isTradingNow = true; 
                activeTradeCargo = "Караван: " + road.v + " -> " + road.u + " (Транзит: " + pName + ")";
                break;
            }
            else if (priceInB > (priceInA + transportCost) && cityA.products[pName].stock > 10) {
                cityA.products[pName].stock -= 0.5; 
                cityB.products[pName].stock += 0.5;
                isTradingNow = true; 
                activeTradeCargo = "Караван: " + road.u + " -> " + road.v + " (Транзит: " + pName + ")";
                break;
            }
        }

        var roadColor = "#2ecc71"; 
        var roadWidth = 2;
        
        if (isTradingNow) { roadColor = "#f1c40f"; roadWidth = 5; }
        else if (cityA.currentEvent === "Дождь" || cityB.currentEvent === "Дождь") { roadColor = "#3498db"; roadWidth = 3; }
        else if (cityA.currentEvent === "Засуха" || cityB.currentEvent === "Засуха") { 
            if (cityA.currentTemp > 38 || cityB.currentTemp > 38) { roadColor = "#e67e22"; roadWidth = 4; } 
        }

        // ИСПОЛЬЗУЕМ \\n ДЛЯ КОРРЕКТНЫХ ПЕРЕНОСОВ СТРОК В ПОДСКАЗКЕ ДОРОГИ
        var edgeTooltipText = "МАРШРУТ: " + road.u + " <-> " + road.v + 
                              "\\nУсловия трассы: " + weatherNotice + 
                              "\\nЛогистика: Накладные расходы пути: " + transportCost.toFixed(1) + " руб.\\n" +
                              "\\nМЕЖГОРОДСКАЯ ЛОГИСТИКА: " + activeTradeCargo + "\\n";
        
        var labelDistanceText = "";
        var loopRoutesList = road.routes.slice(0);
        
        loopRoutesList.forEach(function(route, index) {
            var actualSpeed = route.speed * speedModifier;
            if (isTradingNow) actualSpeed *= 0.85;
            
            var travelTimeHours = route.dist / actualSpeed;
            var hours = Math.floor(travelTimeHours);
            var minutes = Math.round((travelTimeHours - hours) * 60);
            
            var totalMinutes = (travelTimeHours - hours) * 60;
            var seconds = Math.round((totalMinutes - minutes) * 60);
            if (seconds < 0) seconds = 0;

            edgeTooltipText += "\\nВариант " + (index + 1) + ": " + route.name + 
                               "\\nДлина: " + route.dist + " км" + 
                               "\\nВремя логистики в пути: " + (hours > 0 ? hours + " ч. " : "") + minutes + " мин. " + seconds + " сек. (скор. " + Math.round(actualSpeed) + " км/ч)\\n";
            
            if (index === 0) { labelDistanceText = route.dist + " км"; }
        });
        if (typeof network !== "undefined"){
            network.redraw();
        }

        edges.update({
            id: road.id,
            label: labelDistanceText,
            title: edgeTooltipText,
            width: roadWidth,
            arrows: { to: { enabled: true, scaleFactor: isTradingNow ? 0.9 : 0.4 } },
            color: { color: roadColor, hover: "#ffffff", highlight: "#ff4d4d" }
        });
    });
}
</script>
</body>
"""

# PYTHON-БЛОК ДЛЯ ВШИВАНИЯ КОДА:
with open(output_file, 'r', encoding='utf-8') as file:
    html_content = file.read()

# ВНЕДРЯЕМ JS-СИМУЛЯЦИЮ НА СТРАНИЦУ, ЗАМЕНЯЯ ТЕГ </body>
html_content = html_content.replace("</body>", js_simulation_code)

with open(output_file, 'w', encoding='utf-8') as file:
    file.write(html_content)
