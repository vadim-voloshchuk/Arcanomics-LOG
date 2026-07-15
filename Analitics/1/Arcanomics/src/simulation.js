// Application coordinator. Dependencies are loaded before this file.
window.onload = function () {
    initializeCitySimulations();
    runSimulationStep();
    setInterval(updateExactGameTime, 1000);
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
