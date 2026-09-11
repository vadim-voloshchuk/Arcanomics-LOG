var EventSystem = {
    currentEvent: null,
    daysRemaining: 0,
    cooldownDays: 0,
    lastEvent: null,
    lastProcessedDay: 0,
    selectionWeights: null,
    eventHistory: [],

    definitions: [
        { key: "drought", name: "Засуха", logName: "Drought", minDays: 3, maxDays: 4, resource: "Commodity A", productionMultiplier: 0.65, priceMultiplier: 1.20 },
        { key: "downpour", name: "Ливень", logName: "Downpour", minDays: 2, maxDays: 3, transportMultiplier: 0.80, transportCostMultiplier: 1.10 },
        { key: "frost", name: "Заморозки", logName: "Frost", minDays: 2, maxDays: 3, resource: "Commodity A", productionMultiplier: 0.70 },
        { key: "storm", name: "Шторм", logName: "Storm", minDays: 1, maxDays: 2, transportMultiplier: 0.60 },
        { key: "fog", name: "Туман", logName: "Fog", minDays: 1, maxDays: 2, transportMultiplier: 0.85 },
        { key: "harvest", name: "Урожайный сезон", logName: "Harvest Season", minDays: 3, maxDays: 4, resource: "Commodity A", productionMultiplier: 1.25 },
        { key: "fire", name: "Пожар на производстве", logName: "Production Fire", minDays: 1, maxDays: 2, productionMultiplier: 0.50 }
    ],

    reset: function() {
        this.currentEvent = null;
        this.daysRemaining = 0;
        this.cooldownDays = 0;
        this.lastEvent = null;
        this.lastProcessedDay = 0;
        this.selectionWeights = null;
        this.eventHistory = [];
    },

    // ПРИМЕЧАНИЕ: эта функция используется ТОЛЬКО для глобальной сводной
    // статистики (this.currentEvent, weather_events.csv, simulation_log.csv).
    // Экономика и логистика городов используют EventSystem.getCityWeatherState(),
    // а не this.currentEvent.
    advanceToDay: function(day) {
        // weatherHistoryDB — объект по регионам: { region_a: [...], region_b: [...], ... }
        // Для глобальной сводной статистики берём первый доступный регион как опорный ряд.
        var globalWeatherArray = null;
        if (window.weatherHistoryDB && !Array.isArray(weatherHistoryDB) && typeof weatherHistoryDB === "object") {
            var firstRegionKey = Object.keys(weatherHistoryDB)[0];
            globalWeatherArray = firstRegionKey ? weatherHistoryDB[firstRegionKey] : null;
        } else if (Array.isArray(weatherHistoryDB)) {
            globalWeatherArray = weatherHistoryDB;
        }

        if (!globalWeatherArray || globalWeatherArray.length === 0) {
            globalWeatherArray = [];
            for (var i = 0; i < 5000; i++) {
                globalWeatherArray.push({
                    temp: 15.0 + (Math.sin(i / 12) * 5),
                    rain: i % 48 === 0 ? 0.6 : 0.0,
                    snow: 0.0,
                    wind: 12.0
                });
            }
        }

        var currentGlobalHour = ((day - 1) * 24) + gameHour;

        if (currentGlobalHour >= globalWeatherArray.length) {
            currentGlobalHour = currentGlobalHour % globalWeatherArray.length;
        }
        if (currentGlobalHour < 0) {
            currentGlobalHour = 0;
        }

        var record = globalWeatherArray[currentGlobalHour];

        if (!record || typeof record.temp === "undefined") {
            record = {
                temp: 15.0 + (Math.sin(currentGlobalHour / 12) * 5),
                rain: currentGlobalHour % 48 === 0 ? 0.6 : 0.0,
                snow: 0.0,
                wind: 12.0
            };
        }

        var temp = record.temp;
        var rain = record.rain;
        var snow = record.snow;
        var wind = record.wind;

        if (snow > 0.2 || wind > 28) {
            this.currentEvent = {
                key: "storm", name: "Шторм и непогода", productionMultiplier: 0.60, transportMultiplier: 0.50, transportCostMultiplier: 1.40, priceMultiplier: 1.15
            };
        } else if (rain > 0.5) {
            this.currentEvent = {
                key: "downpour", name: "Проливной ливень", productionMultiplier: 0.85, transportMultiplier: 0.70, transportCostMultiplier: 1.25, priceMultiplier: 1.05
            };
        } else if (temp < 4) {
            this.currentEvent = {
                key: "frost", name: "Заморозки на почве", productionMultiplier: 0.65, transportMultiplier: 0.90, transportCostMultiplier: 1.10, priceMultiplier: 1.25
            };
        } else if (temp > 26 && rain === 0) {
            this.currentEvent = {
                key: "drought", name: "Засушливый период", productionMultiplier: 0.70, transportMultiplier: 1.00, transportCostMultiplier: 1.00, priceMultiplier: 1.20
            };
        } else {
            this.currentEvent = {
                key: "harvest", name: "Благоприятный период", productionMultiplier: 1.25, transportMultiplier: 1.00, transportCostMultiplier: 1.00, priceMultiplier: 0.90
            };
        }

        if (document.getElementById("w-temp")) {
            document.getElementById("w-temp").innerText = temp.toFixed(1) + " °C";
            document.getElementById("w-rain").innerText = rain.toFixed(1) + " мм";
            document.getElementById("w-snow").innerText = snow.toFixed(1) + " см";
            document.getElementById("w-wind").innerText = Math.round(wind) + " км/ч";

            var statusCell = document.getElementById("w-status");
            statusCell.innerText = this.currentEvent.name;
            if (this.currentEvent.key === "harvest") {
                statusCell.style.color = "#2ecc71";
            } else {
                statusCell.style.color = "#e74c3c";
            }
        }
    },

    // Извлекает из готового погодного объекта множители, влияющие на производство,
    // цену и транспорт. weatherObject - это ОБЪЕКТ КОНКРЕТНОГО ГОРОДА
    // (результат getCityWeatherState), а не глобальное this.currentEvent.
    getModifiers: function(weatherObject, productName) {
        var modifiers = { productionMultiplier: 1, transportMultiplier: 1, transportCostMultiplier: 1, priceMultiplier: 1 };
        if (!weatherObject) return modifiers;
        var event = weatherObject;
        if (!event.affectedResource || typeof productName === "undefined" || productName === event.affectedResource) {
            modifiers.productionMultiplier = event.productionMultiplier;
            modifiers.priceMultiplier = event.priceMultiplier;
        }
        modifiers.transportMultiplier = event.transportMultiplier;
        modifiers.transportCostMultiplier = event.transportCostMultiplier;
        return modifiers;
    },

    // ЕДИНЫЙ метод получения погодного состояния города.
    // Инкапсулирует: поиск региона города -> выборку записи CSV этого региона ->
    // расчёт уникальной локальной погоды и коэффициентов влияния на
    // производство/транспорт/цену. Это единственное место в проекте, которое
    // должно вызываться, чтобы узнать погоду конкретного города —
    // simulation.js, дашборд и любой будущий код используют только его.
    getCityWeatherState: function(cityId, currentDay, currentHour) {
        var cityNode = typeof nodes !== "undefined" ? nodes.get(cityId) : null;
        var cityRegion = (cityNode && cityNode.region) ? cityNode.region : null;

        var regionWeatherArray = (cityRegion && window.weatherHistoryDB && weatherHistoryDB[cityRegion])
            ? weatherHistoryDB[cityRegion]
            : null;

        var baseRecord = null;
        if (regionWeatherArray && regionWeatherArray.length > 0) {
            var currentGlobalHour = (((currentDay - 1) * 24) + currentHour) % regionWeatherArray.length;
            baseRecord = regionWeatherArray[currentGlobalHour];
        }

        return this.getCityLocalWeather(cityId, baseRecord, currentDay, currentHour);
    },

    // Генерирует уникальную локальную погоду для города по базовой записи его региона.
    // Вызывается ТОЛЬКО из getCityWeatherState — напрямую извне лучше не дёргать,
    // чтобы не дублировать логику поиска региона/записи в разных местах проекта.
    getCityLocalWeather: function(cityName, baseRecord, currentDay, currentHour) {
        if (!baseRecord) return { name: "Ясно", temp: 15, rain: 0, snow: 0, wind: 10, productionMultiplier: 1, transportMultiplier: 1, transportCostMultiplier: 1, priceMultiplier: 1 };

        var tempShift = 0;
        var rainShift = 0;
        var windShift = 0;

        var cityHash = 0;
        for (var i = 0; i < cityName.length; i++) {
            cityHash += cityName.charCodeAt(i);
        }
        var climateProfile = cityHash % 3;
        if (climateProfile === 0) {
            tempShift = 7.5;
            rainShift = 0.1;
        } else if (climateProfile === 1) {
            tempShift = 3.0;
            windShift = 4.0;
        } else {
            tempShift = -4.0;
        }

        var localHourShift = (cityHash % 9) - 4;
        var localHour = (currentHour + localHourShift + 24) % 24;
        var dailyCycle = Math.sin(((localHour - 6) / 24) * Math.PI * 2) * 6;

        var cityNoise = Math.sin(cityHash) * 8.5;
        var weatherNoise = Math.cos(cityHash) * 0.9;

        var finalTemp = baseRecord.temp + tempShift + dailyCycle + cityNoise;
        var finalRain = Math.max(0, baseRecord.rain + rainShift + (weatherNoise > 0 ? weatherNoise : 0));
        var finalWind = Math.max(0, baseRecord.wind + windShift + (cityNoise * 2));
        var finalSnow = baseRecord.snow;

        if (typeof this.cityCooldowns === "undefined") {
            this.cityCooldowns = {};
        }
        if (!this.cityCooldowns[cityName]) {
            this.cityCooldowns[cityName] = {
                cooldownEndDay: 0,
                lastActiveEventKey: "harvest"
            };
        }

        var cityCooldown = this.cityCooldowns[cityName];

        var baseStatusKey = "harvest";
        if (finalSnow > 0.1 || finalWind > 20) baseStatusKey = "storm";
        else if (finalRain > 0.2) baseStatusKey = "downpour";
        else if (finalTemp < 7) baseStatusKey = "frost";
        else if (finalTemp > 23 && finalRain === 0) baseStatusKey = "drought";

        var finalStatusKey = baseStatusKey;

        if (currentDay < cityCooldown.cooldownEndDay) {
            if (baseStatusKey !== "harvest") {
                finalStatusKey = "harvest";
                finalRain = 0;
                finalWind = 10;
            }
        } else {
            if (baseStatusKey !== "harvest" && cityCooldown.lastActiveEventKey === "harvest") {
                cityCooldown.cooldownEndDay = currentDay + 2;
            }
        }

        cityCooldown.lastActiveEventKey = baseStatusKey;

        var statusName = "Ясно";
        var prodMult = 1.25, transMult = 1.00, costMult = 1.00, priceMult = 0.90;

        if (finalStatusKey === "storm") {
            statusName = "Шторм";
            prodMult = 0.60; transMult = 0.50; costMult = 1.40; priceMult = 1.15;
        } else if (finalStatusKey === "downpour") {
            statusName = "Ливень";
            prodMult = 0.85; transMult = 0.70; costMult = 1.25; priceMult = 1.05;
        } else if (finalStatusKey === "frost") {
            statusName = "Заморозки";
            prodMult = 0.65; transMult = 0.90; costMult = 1.10; priceMult = 1.25;
        } else if (finalStatusKey === "drought") {
            statusName = "Засуха";
            prodMult = 0.70; transMult = 1.00; costMult = 1.00; priceMult = 1.20;
        }

        var displayName = statusName;
        if (currentDay < cityCooldown.cooldownEndDay && baseStatusKey !== "harvest") {
            displayName = "Затишье (После непогоды)";
        }

        return {
            name: displayName + " (" + finalTemp.toFixed(1) + "°C)",
            key: finalStatusKey,
            temp: finalTemp,
            rain: finalRain,
            snow: finalSnow,
            wind: finalWind,
            productionMultiplier: prodMult,
            transportMultiplier: transMult,
            transportCostMultiplier: costMult,
            priceMultiplier: priceMult
        };
    },

    getEventName: function() {
        return this.currentEvent ? this.currentEvent.name : "Нет";
    },

    getDisplayText: function() {
        if (!this.currentEvent) return "Нет активных погодных событий";
        return this.currentEvent.name;
    }
};
