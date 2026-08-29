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
            specialization = "Agri-cluster (Output: Commodity A)";
        } else if (rnd < 0.60) {
            specialization = "Industry (Output: Commodity B)";
        } else if (rnd < 0.80) {
            specialization = "Extraction (Output: Commodity C)";
        } else {
            specialization = "Trade Hub (Output: High-value goods | Demand for raw materials)";
        }

        if (specialization.includes("Commodity A")) {
            cityProducts["Commodity A"].stock = 120; 
            cityProducts["Commodity A"].base_price = 25; 
        } else if (specialization.includes("Commodity B")) {
            cityProducts["Commodity B"].stock = 120;
            cityProducts["Commodity B"].base_price = 20;
        } else if (specialization.includes("Commodity C")) {
            cityProducts["Commodity C"].stock = 120;
            cityProducts["Commodity C"].base_price = 15;
        } else if (specialization.includes("Trade Hub")) {
            cityProducts["Commodity A"].stock = 20;  cityProducts["Commodity A"].base_price = 55;
            cityProducts["Commodity B"].stock = 20; cityProducts["Commodity B"].base_price = 45;
            cityProducts["Commodity C"].stock = 20; cityProducts["Commodity C"].base_price = 35;
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
