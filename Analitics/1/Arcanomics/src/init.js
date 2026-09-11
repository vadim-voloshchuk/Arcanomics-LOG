// Shared simulation state and city initialization.
var gameSecond = 0;
var gameMinute = 0;
var gameHour = 6;
var gameDay = 1;

// ЕДИНЫЙ конфиг эксперимента - все параметры прогона собраны в одном месте,
// вместо разрозненных глобальных переменных ACTIVE_PRICE_MODEL/EXPERIMENT_SEED.
var ExperimentConfig = {
    run_id: null,        // назначается заново при каждом нажатии "Start simulation"
    model: "market",     // "market" | "linear" | "inertia"
    scenario: "baseline",
    seed: 123456789,
    duration_days: 30
};

function generateRunId(seed) {
    return "run_" + Date.now() + "_seed" + seed;
}

var randomState = ExperimentConfig.seed >>> 0;

function seededRandom() {
    randomState = (randomState * 1664525 + 1013904223) >>> 0;
    return randomState / 4294967296;
}

// Гарантирует согласованность base_price/current_price/last_price:
// при любом изменении базовой цены товара все три поля выставляются разом,
// чтобы last_price никогда не "отставал" от новой базовой цены.
function setProductBasePrice(item, price) {
    item.base_price = price;
    item.current_price = price;
    item.last_price = price;
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
            setProductBasePrice(cityProducts["Commodity A"], 25);
        } else if (specialization.includes("Commodity B")) {
            cityProducts["Commodity B"].stock = 120;
            setProductBasePrice(cityProducts["Commodity B"], 20);
        } else if (specialization.includes("Commodity C")) {
            cityProducts["Commodity C"].stock = 120;
            setProductBasePrice(cityProducts["Commodity C"], 15);
        } else if (specialization.includes("Trade Hub")) {
            cityProducts["Commodity A"].stock = 20; setProductBasePrice(cityProducts["Commodity A"], 55);
            cityProducts["Commodity B"].stock = 20; setProductBasePrice(cityProducts["Commodity B"], 45);
            cityProducts["Commodity C"].stock = 20; setProductBasePrice(cityProducts["Commodity C"], 35);
        }

        // Товары, не задетые веткой выше (специализация их не выпускает),
        // тоже должны иметь согласованные base/current/last_price -
        // берём базовую цену из шаблона goods.json, если она ещё не выставлена явно.
        for (var gName in cityProducts) {
            var gItem = cityProducts[gName];
            if (typeof gItem.current_price === "undefined" || typeof gItem.last_price === "undefined") {
                setProductBasePrice(gItem, gItem.base_price);
            }
        }

        citySimulations[id] = {
            population: basePop,
            migration: 0,
            products: cityProducts,
            specializationText: specialization,
            localWeatherObject: null,
            localWeatherLabel: "Нет активных погодных событий"
        };
    });

    // Заполняем тултипы стартовыми значениями БЕЗ запуска экономики:
    // загрузка интерфейса не должна тратить склад или менять цены до того,
    // как пользователь нажмёт "Start simulation".
    buildInitialTooltips();
}

// Показывает начальное состояние города (как есть, без единого такта симуляции).
// В отличие от updateCityEconomy() ничего не производит и не продаёт -
// это чисто отображение стартовых данных.
function buildInitialTooltips() {
    for (var id in citySimulations) {
        var data = citySimulations[id];
        var goodsText = "";
        for (var pName in data.products) {
            var item = data.products[pName];
            goodsText += "\n[ ТОВАР: " + pName + " ]" +
                "\n * На складе: " + Math.round(item.stock) + " ед." +
                "\n * Цена (старт): " + item.current_price.toFixed(1) + " руб.\n";
        }
        var tooltipText = "ГОРОД: " + id.toUpperCase() + "\nПрофиль: " + data.specializationText +
            "\n-------------------------------------" +
            "\n👥 Население: " + data.population.toLocaleString() + " чел." +
            "\n⚡ Погодное событие: расчёт начнётся после старта эксперимента" +
            "\n-------------------------------------" + goodsText;
        nodes.update({id: id, title: tooltipText});
    }
}

var weatherHistoryDB = __WEATHER_HISTORY_DATA__;
