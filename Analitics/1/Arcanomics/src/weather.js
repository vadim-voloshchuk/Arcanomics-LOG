var EventSystem = {
    currentEvent: null,
    daysRemaining: 0,
    cooldownDays: 0,
    lastEvent: null,
    lastProcessedDay: 0,
    selectionWeights: null,
    eventHistory: [],

    definitions: [
        { key: "drought", name: "Засуха", logName: "Drought", minDays: 3, maxDays: 4, resource: "Хлеб", productionMultiplier: 0.65, priceMultiplier: 1.20 },
        { key: "downpour", name: "Ливень", logName: "Downpour", minDays: 2, maxDays: 3, transportMultiplier: 0.80, transportCostMultiplier: 1.10 },
        { key: "frost", name: "Заморозки", logName: "Frost", minDays: 2, maxDays: 3, resource: "Хлеб", productionMultiplier: 0.70 },
        { key: "storm", name: "Шторм", logName: "Storm", minDays: 1, maxDays: 2, transportMultiplier: 0.60 },
        { key: "fog", name: "Туман", logName: "Fog", minDays: 1, maxDays: 2, transportMultiplier: 0.85 },
        { key: "harvest", name: "Урожайный сезон", logName: "Harvest Season", minDays: 3, maxDays: 4, resource: "Хлеб", productionMultiplier: 1.25 },
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

    advanceToDay: function(day) {
        // Защита: если база данных погоды вообще не массив или пуста, создаем её
        if (!window.weatherHistoryDB || !Array.isArray(weatherHistoryDB) || weatherHistoryDB.length === 0) {
            weatherHistoryDB = [];
            for (var i = 0; i < 5000; i++) {
                weatherHistoryDB.push({
                    temp: 15.0 + (Math.sin(i / 12) * 5),
                    rain: i % 48 === 0 ? 0.6 : 0.0,
                    snow: 0.0,
                    wind: 12.0
                });
            }
        }

        var currentGlobalHour = ((day - 1) * 24) + gameHour;
        
        // Циклическая защита от выхода за границы массива
        if (currentGlobalHour >= weatherHistoryDB.length) {
            currentGlobalHour = currentGlobalHour % weatherHistoryDB.length;
        }
        if (currentGlobalHour < 0) {
            currentGlobalHour = 0;
        }
        
        var record = weatherHistoryDB[currentGlobalHour];
        
        // Главная защита от ошибки на скриншоте: если элемент массива почему-то undefined
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

    // МЕНЯЕМ И ДОПИСЫВАЕМ СТРОГО ОТ СЛОВА getModifiers ДО КОНЦА ОБЪЕКТА EventSystem:
    getModifiers: function(productName) {
        var modifiers = { productionMultiplier: 1, transportMultiplier: 1, transportCostMultiplier: 1, priceMultiplier: 1 };
        if (!this.currentEvent) return modifiers;
        var event = this.currentEvent;
        if (!event.affectedResource || typeof productName === "undefined" || productName === event.affectedResource) {
            modifiers.productionMultiplier = event.productionMultiplier;
            modifiers.priceMultiplier = event.priceMultiplier;
        }
        modifiers.transportMultiplier = event.transportMultiplier;
        modifiers.transportCostMultiplier = event.transportCostMultiplier;
        return modifiers;
    },

    // НОВЫЙ МЕТОД: Генерирует уникальную локальную погоду для города без изменения глобального состояния
    // НАЙДИТЕ СТРОКУ 41 И ЗАМЕНИТЕ НАЧАЛО МЕТОДА НА ЭТО:
    getCityLocalWeather: function(cityName, baseRecord, currentDay, currentHour) { // <-- Передали время сюда
        if (!baseRecord) return { name: "Ясно", temp: 15, rain: 0, snow: 0, wind: 10 };
        
        var nameLower = cityName.toLowerCase();
        var tempShift = 0;
        var rainShift = 0;
        var windShift = 0;

        // Климатические зоны (оставляем без изменений)
        if (nameLower.includes("хьюстон") || nameLower.includes("остин") || nameLower.includes("даллас") || nameLower.includes("сан-антонио") || nameLower.includes("texas")) {
            tempShift = 7.5;   
            rainShift = 0.1;
        } else if (nameLower.includes("синдзюку") || nameLower.includes("сибуя") || nameLower.includes("минато") || nameLower.includes("тиёда") || nameLower.includes("tokyo")) {
            tempShift = 3.0;   
            windShift = 4.0;   
        } else if (nameLower.includes("мюнхен") || nameLower.includes("нюрнберг") || nameLower.includes("аугсбург") || nameLower.includes("регенсбург") || nameLower.includes("bavaria")) {
            tempShift = -4.0;  
        } else {
            tempShift = 1.0;   
        }

        var localHourShift = 0;
        if (nameLower.includes("tokyo")) localHourShift = 6;      
        else if (nameLower.includes("bavaria")) localHourShift = -2; 
        else if (nameLower.includes("texas")) localHourShift = -9;   

        // ЗАМЕНИТЕ ИСПОЛЬЗОВАНИЕ gameHour НА ПРИШЕДШИЙ ПАРАМЕТР currentHour:
        var localHour = (currentHour + localHourShift + 24) % 24;
        var dailyCycle = Math.sin(((localHour - 6) / 24) * Math.PI * 2) * 6; 

        // АКУРАТНО ДОБАВЛЯЕМ: Процедурный хэш имени города для создания уникального шума погоды
        var cityHash = 0;
        for (var i = 0; i < cityName.length; i++) {
            cityHash += cityName.charCodeAt(i);
        }
        // Уникальный сдвиг температуры для каждого города (в пределах +/- 3.5°C)
        var cityNoise = Math.sin(cityHash) * 8.5; 
        // Небольшой уникальный сдвиг осадков и ветра для рассинхронизации штормов
        var weatherNoise = Math.cos(cityHash) * 0.9;

        // Применяем индивидуальный шум к расчету метеоусловий
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

        // ЗАМЕНИТЕ ИСПОЛЬЗОВАНИЕ gameDay НА ПРИШЕДШИЙ ПАРАМЕТР currentDay:
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

        // ЗАМЕНИТЕ ИСПОЛЬЗОВАНИЕ gameDay НА ПРИШЕДШИЙ ПАРАМЕТР currentDay:
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
