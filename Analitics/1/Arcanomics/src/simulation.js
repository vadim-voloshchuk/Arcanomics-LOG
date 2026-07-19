// Application coordinator. Dependencies are loaded before this file.
window.onload = function () {
    initializeCitySimulations();
    runSimulationStep();

    // Каждые 500 миллисекунд (полсекунды) игровое время прыгает на 20 минут.
    // Таким образом, один игровой час пролетит всего за 1.5 секунды реального времени!
    setInterval(function() {
        gameMinute += 20;
        if (gameMinute >= 60) {
            gameMinute = 0;
            gameHour++;
        }
        if (gameHour >= 24) {
            gameHour = 0;
            gameDay++;
        }
        runSimulationStep();
    }, 500);
};

function runSimulationStep() {
    var hStr = gameHour < 10 ? "0" + gameHour : gameHour;
    var mStr = gameMinute < 10 ? "0" + gameMinute : gameMinute;
    var sStr = gameSecond < 10 ? "0" + gameSecond : gameSecond;
    var exactTimeString = hStr + ":" + mStr + ":" + sStr;
    for (var id in citySimulations) {
        var data = citySimulations[id];
        updateCityWeather(data);
        updateCityEconomy(id, data, exactTimeString);
    }
    updateRoadLogistics();
}
