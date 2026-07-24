// Shared simulation state and city initialization.
var gameSecond = 0;
var gameMinute = 0;
var gameHour = 6;
var gameDay = 1;

// Experiment configuration. Change only this value to compare price models.
var ACTIVE_PRICE_MODEL = "market"; // "market", "linear" or "inertia"
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
        var weatherProf = nodeData.weather_profile || { hourly_temp: [], hourly_humidity: [], hourly_precip: [], hourly_wmo: [] };

        // --- ПРОДВИНУТЫЙ ЭКОНОМИЧЕСКИЙ ДВИЖОК ---
        // Считаем средние показатели климата из API, чтобы понять географию города
        // --- ПРОДВИНУТЫЙ ЭКОНОМИЧЕСКИЙ ДВИЖОК ---
        var temps = weatherProf.hourly_temp || [];
        var humidities = weatherProf.hourly_humidity || [];
        var precips = weatherProf.hourly_precip || [];

        var avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : 22.0;
        var avgHumidity = humidities.length > 0 ? humidities.reduce((a, b) => a + b, 0) / humidities.length : 50.0;
        var totalPrecip = precips.length > 0 ? precips.reduce((a, b) => a + b, 0) : 0.0;

        const rnd = seededRandom();
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


        // Балансируем стартовые склады в зависимости от выбранного профиля
        if (specialization.includes("Хлеб")) {
            cityProducts["Хлеб"].stock = 120; // Избыток своего товара для старта торговли
            cityProducts["Хлеб"].base_price = 25; // Своё производство — дешевле
        } else if (specialization.includes("Дерево")) {
            cityProducts["Дерево"].stock = 120;
            cityProducts["Дерево"].base_price = 20;
        } else if (specialization.includes("Камень")) {
            cityProducts["Камень"].stock = 120;
            cityProducts["Камень"].base_price = 15;
        } else if (specialization.includes("Торговый Хаб")) {
            // Хабы имеют огромные склады, но мало ресурсов на старте (готовы скупать)
            cityProducts["Хлеб"].stock = 20;  cityProducts["Хлеб"].base_price = 55;
            cityProducts["Дерево"].stock = 20; cityProducts["Дерево"].base_price = 45;
            cityProducts["Камень"].stock = 20; cityProducts["Камень"].base_price = 35;
        }

        citySimulations[id] = {
            population: basePop,
            migration: 0,
            products: cityProducts,
            specializationText: specialization,
            weatherProfile: weatherProf,
            currentTemp: parseFloat(avgTemp.toFixed(1)),
            humidity: parseFloat(avgHumidity.toFixed(1)),
            currentEvent: "Нет",
            cooldownDays: 0
        };
    });
}
