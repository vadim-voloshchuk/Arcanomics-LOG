// Simulation clock and real-world API weather mappings with stable ticking.
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
            if (data.cooldownDays > 0) {
                data.cooldownDays--;
            }
        }
    }

    runSimulationStep();
}

function updateCityWeather(data) {
    if (typeof data.cooldownDays === "undefined") data.cooldownDays = 0;

    // Рассчитываем точный динамический индекс текущего часа симуляции
    var totalHoursPassed = ((gameDay - 1) * 24) + gameHour;

    var arrayLength = (data.weatherProfile && data.weatherProfile.hourly_temp) ? data.weatherProfile.hourly_temp.length : 24;
    var weatherIndex = totalHoursPassed % arrayLength;

    // Считываем изменяющиеся показатели часа из профиля API без блокировок
    var realBaseTemp = (data.weatherProfile && data.weatherProfile.hourly_temp) ? (data.weatherProfile.hourly_temp[weatherIndex] ?? 22.0) : 22.0;
    var realBaseHumidity = (data.weatherProfile && data.weatherProfile.hourly_humidity) ? (data.weatherProfile.hourly_humidity[weatherIndex] ?? 50.0) : 50.0;
    var realPrecipitation = (data.weatherProfile && data.weatherProfile.hourly_precip) ? (data.weatherProfile.hourly_precip[weatherIndex] ?? 0.0) : 0.0;
    var wmoCode = (data.weatherProfile && data.weatherProfile.hourly_wmo) ? (data.weatherProfile.hourly_wmo[weatherIndex] ?? 0) : 0;

    var finalTemp = realBaseTemp;
    var finalHumidity = realBaseHumidity;

    var isRainingNow = (realPrecipitation > 0.1 || (wmoCode >= 51 && wmoCode <= 67) || (wmoCode >= 80 && wmoCode <= 82));
    var isDroughtNow = (realBaseTemp > 34.0 && realBaseHumidity < 30);

    if (data.cooldownDays > 0) {
        data.currentEvent = "Затишье (Восстановление: " + data.cooldownDays + " д.)";
    } else {
        if (isRainingNow) {
            data.currentEvent = "Дождь (" + realPrecipitation.toFixed(1) + " мм/ч)";
            finalHumidity = Math.min(98, finalHumidity + 15);
            data.lastEventWasActive = true;
        } else if (isDroughtNow) {
            data.currentEvent = "Засуха (Жара)";
            finalTemp += 3.0;
            data.lastEventWasActive = true;
        } else {
            if (data.lastEventWasActive) {
                data.cooldownDays = Math.floor(Math.random() * 2) + 1;
                data.lastEventWasActive = false;
                data.currentEvent = "Затишье (Восстановление: " + data.cooldownDays + " д.)";
            } else {
                data.currentEvent = "Нет";
            }
        }
    }

    data.currentTemp = parseFloat(finalTemp.toFixed(1));
    data.humidity = parseFloat(finalHumidity.toFixed(1));
}
