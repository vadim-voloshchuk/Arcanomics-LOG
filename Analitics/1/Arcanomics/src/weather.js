// Simulation clock and weather state transitions.
function updateExactGameTime() {
    gameSecond++;
    if (gameSecond >= 60) { gameSecond = 0; gameMinute++; }
    if (gameMinute >= 60) { gameMinute = 0; gameHour++; }
    if (gameHour >= 24) { gameHour = 0; gameDay++; }

    if (gameMinute === 0 && gameSecond === 0) {
        for (var id in citySimulations) citySimulations[id].population += Math.floor(Math.random() * 3) - 1;
    }

    if (gameHour === 0 && gameMinute === 0 && gameSecond === 0) {
        for (var cityId in citySimulations) {
            var data = citySimulations[cityId];
            data.weatherDuration--;
            if (data.weatherDuration <= 0) {
                var rand = Math.random();
                if (rand < 0.25) { data.weatherType = "drought"; data.weatherDuration = Math.floor(Math.random() * 4) + 3; }
                else if (rand < 0.5) { data.weatherType = "rainy"; data.weatherDuration = Math.floor(Math.random() * 3) + 2; }
                else { data.weatherType = "sunny"; data.weatherDuration = Math.floor(Math.random() * 5) + 3; }
            }
        }
    }
    runSimulationStep();
}

function updateCityWeather(data) {
    var dailyCycle = -Math.cos((gameHour - 4) * 2 * Math.PI / 24);
    var targetTemp = data.baseTemp + (dailyCycle * 8);
    data.currentEvent = "Нет";
    if (data.weatherType === "drought") { targetTemp += 5; data.currentEvent = "Засуха"; data.humidity = Math.max(15, data.humidity - 0.1); }
    else if (data.weatherType === "rainy") { targetTemp -= 4; data.currentEvent = "Дождь"; data.humidity = Math.min(95, data.humidity + 0.2); }
    else { if (data.humidity > 50) data.humidity -= 0.1; if (data.humidity < 50) data.humidity += 0.1; }
    if (targetTemp < 10) targetTemp = 10;
    data.currentTemp = parseFloat(targetTemp.toFixed(1));
}
