// Shared simulation state and city initialization.
var gameSecond = 0;
var gameMinute = 0;
var gameHour = 6;
var gameDay = 1;

var ACTIVE_PRICE_MODEL = "market"; 
var EXPERIMENT_SEED = 123456789;
var randomState = EXPERIMENT_SEED >>> 0;

function seededRandom() {
    randomState = (randomState * 1664525 + 1013904223) >>> 0;
    return randomState / 4294967296;
}

var cityHourLogs = [];
var roadHourLogs = [];
var citySimulations = {};
var roadNetwork = __ROAD_DATA__;
var goodsTemplate = __GOODS_DATA__;

function initializeCitySimulations() {
    var nodeIds = nodes.getIds();
    nodeIds.forEach(function(id) {
        var nodeData = nodes.get(id);
        var basePop = nodeData.population_base || Math.floor(seededRandom() * (180000 - 40000) + 40000);
        var cityProducts = JSON.parse(JSON.stringify(goodsTemplate));

        var rnd = seededRandom();
        var specialization;

        if (rnd < 0.35) {
            specialization = "Агрокомплекс (Выпуск: Хлеб)";
        } else if (rnd < 0.60) {
            specialization = "Промышленность (Выпуск: Дерево)";
        } else if (rnd < 0.80) {
            specialization = "Горнодобыча (Выпуск: Камень)";
        } else {
            specialization = "Торговый Хаб (Выпуск: Высокие технологии | Спрос на сырье)";
        }

        if (specialization.includes("Хлеб")) {
            cityProducts["Хлеб"].stock = 120; 
            cityProducts["Хлеб"].base_price = 25; 
        } else if (specialization.includes("Дерево")) {
            cityProducts["Дерево"].stock = 120;
            cityProducts["Дерево"].base_price = 20;
        } else if (specialization.includes("Камень")) {
            cityProducts["Камень"].stock = 120;
            cityProducts["Камень"].base_price = 15;
        } else if (specialization.includes("Торговый Хаб")) {
            cityProducts["Хлеб"].stock = 20;  cityProducts["Хлеб"].base_price = 55;
            cityProducts["Дерево"].stock = 20; cityProducts["Дерево"].base_price = 45;
            cityProducts["Камень"].stock = 20; cityProducts["Камень"].base_price = 35;
        }

        citySimulations[id] = {
            population: basePop,
            migration: 0,
            products: cityProducts,
            specializationText: specialization,
            currentEvent: "Нет активных погодных событий"
        };
    });

    // ХАК: Рассчитываем экономику и логистику один раз при старте страницы, 
    // чтобы заполнить тултипы и убрать текст "Расчет..." до клика на кнопку
    for (var id in citySimulations) {
        updateCityEconomy(id, citySimulations[id], "06:00:00");
    }
    updateRoadLogistics();
}
var weatherHistoryDB = __WEATHER_HISTORY_DATA__;
