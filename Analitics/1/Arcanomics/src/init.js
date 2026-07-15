// Shared simulation state and city initialization.
var gameSecond = 0;
var gameMinute = 0;
var gameHour = 6;
var gameDay = 1;

var citySimulations = {};
var roadNetwork = __ROAD_DATA__;
var goodsTemplate = __GOODS_DATA__;

function initializeCitySimulations() {
    var nodeIds = nodes.getIds();
    nodeIds.forEach(function(id) {
        var basePop = Math.floor(Math.random() * (180000 - 40000) + 40000);
        if (id === "Ростов-на-Дону") basePop = 1140000;
        if (id === "Таганрог") basePop = 245000;

        var cityProducts = JSON.parse(JSON.stringify(goodsTemplate));

        var specialization = "Потребитель";
        if (id === "Ростов-на-Дону") specialization = "Торговый Хаб (Экспорт: Хлеб, Дерево | ...)";
        else if (id === "Таганрог" || id === "Аксай") specialization = "Промышленность (Выпуск: Дерево)";
        else if (id === "Неклиновский район" || id === "Азовский район") specialization = "Агрокомплекс (Выпуск: Хлеб)";
        else if (id === "Азов") specialization = "Горнодобыча (Выпуск: Камень)";

        citySimulations[id] = {
            population: basePop, migration: 0, products: cityProducts,
            specializationText: specialization,
            baseTemp: Math.random() * (28 - 22) + 22,
            currentTemp: 22.0, weatherType: "sunny",
            weatherDuration: Math.floor(Math.random() * 5) + 3,
            humidity: 50, currentEvent: "Нет"
        };
    });
}
