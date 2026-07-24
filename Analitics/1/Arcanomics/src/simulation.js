// Application coordinator. Dependencies are loaded before this file.
var SIMULATION_DURATION_HOURS = 30 * 24;
var completedGameHours = 0;
var simulationTimer = null;

window.onload = function () {
    initializeCitySimulations();

    // Каждые 500 миллисекунд (полсекунды) игровое время прыгает на 20 минут.
    // Таким образом, один игровой час пролетит всего за 1.5 секунды реального времени!
    simulationTimer = setInterval(function() {
        gameMinute += 20;
        if (gameMinute >= 60) {
            gameMinute = 0;
            gameHour++;
        }
        if (gameHour >= 24) {
            gameHour = 0;
            gameDay++;
        }
        if (gameMinute === 0) runSimulationHour();
    }, 500);
    runSimulationHour();
};

function runSimulationHour() {
    runSimulationStep();
    completedGameHours++;
    if (completedGameHours >= SIMULATION_DURATION_HOURS) {
        clearInterval(simulationTimer);
        downloadSimulationResults();
    }
}

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

function csvEscape(value) {
    var text = String(value == null ? "" : value);
    return '"' + text.replace(/"/g, '""') + '"';
}

function downloadCsv(filename, rows, headers) {
    var lines = [headers.join(",")];
    rows.forEach(function(row) {
        lines.push(headers.map(function(header) { return csvEscape(row[header]); }).join(","));
    });
    var blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function downloadSimulationResults() {
    downloadCsv(
        "simulation_city_results.csv",
        cityHourLogs,
        ["model", "seed", "day", "hour", "city", "product", "stock", "production", "demand", "supply", "current_price", "weather_event"]
    );
    downloadCsv(
        "simulation_road_results.csv",
        roadHourLogs,
        ["road", "trip_count", "trip_profit", "total_profit"]
    );
}
