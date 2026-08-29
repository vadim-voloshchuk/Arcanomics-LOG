// Application coordinator. Dependencies are loaded before this file.
var SIMULATION_DURATION_HOURS = 30 * 24;
var completedGameHours = 0;
var simulationTimer = null;
var simulationStarted = false;
var simulationPaused = false;
var simulationLogRows = [];
var priceHistoryRows = [];

var chartsHistory = {
    hours: [],
    breadPrices: [], woodPrices: [], stonePrices: [],
    emptyStockShares: [],
    avgRouteProfits: []
};
var totalSimulationHoursCounter = 0;

window.onload = function () {
    initializeCitySimulations();

    var priceModelSelect = document.getElementById("priceModelSelect");
    var durationInput = document.getElementById("simulationDurationInput");
    var startButton = document.getElementById("startSimulationButton");
    var pauseButton = document.getElementById("pauseSimulationButton");
    var resumeButton = document.getElementById("resumeSimulationButton");

    priceModelSelect.value = ACTIVE_PRICE_MODEL;
    durationInput.value = SIMULATION_DURATION_HOURS / 24;

    priceModelSelect.addEventListener("change", function() {
        ACTIVE_PRICE_MODEL = priceModelSelect.value;
        console.log("Selected price model: " + ACTIVE_PRICE_MODEL.toUpperCase());
    });
    durationInput.addEventListener("change", function() {
        setSimulationDurationFromInput(durationInput);
    });
    startButton.addEventListener("click", function() {
        if (simulationStarted && !simulationPaused) return;
        var durationDays = setSimulationDurationFromInput(durationInput, false);
        startSimulation(durationDays);
    });
    pauseButton.addEventListener("click", function() {
        pauseSimulation();
    });
    resumeButton.addEventListener("click", function() {
        resumeSimulation();
    });

    updateSimulationControls();
};

function setSimulationDurationFromInput(durationInput, shouldLog) {
    var durationDays = Number(durationInput.value);
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) durationDays = 30;
    durationInput.value = durationDays;
    SIMULATION_DURATION_HOURS = durationDays * 24;
    if (shouldLog !== false) console.log("Simulation duration set to " + durationDays + " days.");
    return durationDays;
}

function updateSimulationControls() {
    var startButton = document.getElementById("startSimulationButton");
    var pauseButton = document.getElementById("pauseSimulationButton");
    var resumeButton = document.getElementById("resumeSimulationButton");

    if (!startButton || !pauseButton || !resumeButton) return;

    if (!simulationStarted) {
        startButton.disabled = false;
        pauseButton.disabled = true;
        resumeButton.disabled = true;
        return;
    }

    if (simulationPaused) {
        startButton.disabled = true;
        pauseButton.disabled = true;
        resumeButton.disabled = false;
    } else {
        startButton.disabled = true;
        pauseButton.disabled = false;
        resumeButton.disabled = true;
    }
}

function startSimulation(durationDays) {
    if (simulationTimer) {
        clearInterval(simulationTimer);
        simulationTimer = null;
    }

    simulationStarted = true;
    simulationPaused = false;
    completedGameHours = 0;
    EventSystem.reset();
    simulationLogRows = [];
    priceHistoryRows = [];
    console.log("==================================================");
    console.log("Simulation started");
    console.log("Price model: " + ACTIVE_PRICE_MODEL.toUpperCase());
    console.log("Simulation duration: " + durationDays + " days");
    console.log("Random seed: " + EXPERIMENT_SEED);
    console.log("==================================================");

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
    updateSimulationControls();
}

function pauseSimulation() {
    if (!simulationStarted || simulationPaused) return;
    simulationPaused = true;
    if (simulationTimer) {
        clearInterval(simulationTimer);
        simulationTimer = null;
    }
    console.log("Simulation paused");
    updateSimulationControls();
}

function resumeSimulation() {
    if (!simulationStarted || !simulationPaused) return;
    simulationPaused = false;
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
    console.log("Simulation resumed");
    updateSimulationControls();
}

function runSimulationHour() {
    EventSystem.advanceToDay(gameDay);
    runSimulationStep();
    if (gameHour === 23) recordDailySimulationData();
    updateRegionalDashboard();
    recordAndDrawCharts();
    completedGameHours++;
    if (completedGameHours >= SIMULATION_DURATION_HOURS) {
        if (simulationTimer) {
            clearInterval(simulationTimer);
            simulationTimer = null;
        }
        simulationStarted = false;
        simulationPaused = false;
        updateSimulationControls();
        downloadSimulationResults();
    }
}

function runSimulationStep() {
    var hStr = gameHour < 10 ? "0" + gameHour : gameHour;
    var mStr = gameMinute < 10 ? "0" + gameMinute : gameMinute;
    var sStr = gameSecond < 10 ? "0" + gameSecond : gameSecond;
    var exactTimeString = hStr + ":" + mStr + ":" + sStr;

    // Цикл по всем городам симуляции
    for (var id in citySimulations) {
        var data = citySimulations[id];
        
        // Извлекаем текущую запись базовой погоды из глобального пула
        var currentGlobalHour = (((gameDay - 1) * 24) + gameHour) % weatherHistoryDB.length;
        var baseRecord = weatherHistoryDB[currentGlobalHour];

        // Генерируем УНИКАЛЬНУЮ локальную погоду конкретно для этого города!
        var localWeather = EventSystem.getCityLocalWeather(id, baseRecord, gameDay, gameHour);
        
        // Записываем локальный объект погоды прямо внутрь данных города
        data.localWeatherObject = localWeather; 
        data.currentEvent = localWeather.name; // Этот текст пойдет в тултип города

        // Запускаем экономику города с его персональной погодой
        updateCityEconomy(id, data, exactTimeString);
    }
    
    // Обновляем логистику дорог
    updateRoadLogistics();
}



function recordDailySimulationData() {
    var modifiers = EventSystem.getModifiers();
    simulationLogRows.push({
        day: gameDay,
        active_event: EventSystem.getEventName(),
        days_remaining: EventSystem.daysRemaining,
        cooldown_remaining: EventSystem.cooldownDays,
        production_multiplier: modifiers.productionMultiplier,
        transport_multiplier: modifiers.transportMultiplier,
        transport_cost_multiplier: modifiers.transportCostMultiplier,
        price_multiplier: modifiers.priceMultiplier
    });

    var totals = { "Commodity A": 0, "Commodity B": 0, "Commodity C": 0 };
    var cityCount = 0;
    for (var cityId in citySimulations) {
        cityCount++;
        for (var productName in totals) totals[productName] += citySimulations[cityId].products[productName].current_price;
    }
    priceHistoryRows.push({
        day: gameDay,
        bread: cityCount ? totals["Commodity A"] / cityCount : 0,
        wood: cityCount ? totals["Commodity B"] / cityCount : 0,
        stone: cityCount ? totals["Commodity C"] / cityCount : 0,
        event: EventSystem.getEventName()
    });
}

function csvEscape(value) {
    var formattedValue = value;
    if (typeof value === "number" && Number.isFinite(value) && !Number.isInteger(value)) {
        formattedValue = value.toFixed(2);
    }
    var text = String(formattedValue == null ? "" : formattedValue);
    return '"' + text.replace(/"/g, '""') + '"';
}

function downloadCsv(filename, rows, headers) {
    var lines = [headers.join(";")];
    rows.forEach(function(row) {
        lines.push(headers.map(function(header) { return csvEscape(row[header]); }).join(";"));
    });
    var blob = new Blob(["\ufeff" + lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
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
        "simulation_log.csv",
        simulationLogRows,
        ["day", "active_event", "days_remaining", "cooldown_remaining", "production_multiplier", "transport_multiplier", "transport_cost_multiplier", "price_multiplier"]
    );
    downloadCsv(
        "price_history.csv",
        priceHistoryRows,
        ["day", "bread", "wood", "stone", "event"]
    );
    downloadCsv(
        "weather_events.csv",
        EventSystem.eventHistory,
        ["start_day", "end_day", "duration", "event", "affected_resource", "production_multiplier", "transport_multiplier", "transport_cost_multiplier", "price_multiplier"]
    );

    downloadCsv(
        "routes_history.csv",
        roadHourLogs,
        ["road", "trip_count", "trip_profit", "total_profit"]
    );
}

// Глобальная переменная для хранения активной вкладки (по умолчанию "regions")
var currentDashboardTab = "regions";

function updateRegionalDashboard() {
    if (typeof isDashboardVisibleGlobal === "undefined") {
        window.isDashboardVisibleGlobal = true;
    }

    // 1. Создаем контейнер панели, если его еще нет
    var dashboard = document.getElementById("regional-dashboard");
    if (!dashboard) {
        dashboard = document.createElement("div");
        dashboard.id = "regional-dashboard";
        dashboard.style.cssText = "position:fixed; top:85px; left:12px; bottom:12px; z-index:1000; " +
                                  "width:340px; background:rgba(26,26,26,0.95); border:1px solid #555; " +
                                  "border-radius:6px; color:#fff; font-family:Arial, sans-serif; font-size:12px; " +
                                  "overflow-y:auto; padding:12px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); " +
                                  "display: flex; flex-direction: column; gap: 10px; transition: left 0.2s ease;";
        document.body.appendChild(dashboard);

        // СОЗДАЕМ НЕЗАВИСИМУЮ КНОПКУ СНАРУЖИ ПАНЕЛИ И ПРИВЯЗЫВАЕМ ЕЁ К BODY
        var toggleSideBtn = document.createElement("div");
        toggleSideBtn.id = "dashboard-sidebar-toggle";
        toggleSideBtn.style.cssText = "position:fixed; top:50%; left:352px; transform:translateY(-50%); " +
                                      "width:20px; height:60px; background:#333; border:1px solid #555; " +
                                      "border-left:none; border-radius:0 6px 6px 0; cursor:pointer; " +
                                      "display:flex; align-items:center; justify-content:center; color:#f1c40f; " +
                                      "font-weight:bold; font-size:11px; z-index:1002; user-select:none; transition: left 0.2s ease;";
        toggleSideBtn.innerText = "◀";
        
        toggleSideBtn.onclick = function() {
            var p = document.getElementById("regional-dashboard");
            var b = document.getElementById("dashboard-sidebar-toggle");
            
            if (p && b) {
                // Читаем глобальный флаг симуляции
                window.isDashboardVisibleGlobal = !window.isDashboardVisibleGlobal;
                
                if (window.isDashboardVisibleGlobal) {
                    p.style.left = "12px";
                    b.style.left = "352px"; // Сдвигаем кнопку вслед за панелью
                    b.innerText = "◀";
                } else {
                    p.style.left = "-342px"; // Прячем панель за экран
                    b.style.left = "0px";    // Прижимаем кнопку к самому левому краю экрана
                    b.innerText = "▶";
                }
            }
        };
        
        document.body.appendChild(toggleSideBtn); // Вешаем на body, чтобы innerHTML её не стирал!
    }
    
    var savedScrollTop = dashboard.scrollTop;


    // 2. Формируем шапку панели и кнопки переключения вкладок
    var htmlContent = "";
    var innerScrollContainer = document.getElementById("dashboard-inner-scroll");
    var savedScrollTop = innerScrollContainer ? innerScrollContainer.scrollTop : 0;

    htmlContent += "<h3 style='margin:0; padding-bottom:5px; color:#f1c40f; font-size:14px;'>📊 МОНИТОРИНГ СИСТЕМЫ</h3>";
    htmlContent += "<div style='color:#aaa; font-size:11px;'>⏱️ Время: День " + gameDay + " | " + (gameHour < 10 ? "0" + gameHour : gameHour) + ":00</div>";
    
    // Стили для кнопок-вкладок
    var btnStyleReg = "flex:1; padding:6px; border:1px solid #777; border-radius:4px; font-weight:bold; cursor:pointer; text-align:center;";
    var btnStyleCit = "flex:1; padding:6px; border:1px solid #777; border-radius:4px; font-weight:bold; cursor:pointer; text-align:center;";
    
    if (currentDashboardTab === "regions") {
        btnStyleReg += " background:#3498db; color:#fff;";
        btnStyleCit += " background:#222; color:#aaa;";
    } else {
        btnStyleReg += " background:#222; color:#aaa;";
        btnStyleCit += " background:#3498db; color:#fff;";
    }

    // Внедряем кнопки переключения с обработчиками клика
    htmlContent += "<div style='display:flex; gap:8px; margin-top:5px; margin-bottom:5px;'>" +
                   "<div style='" + btnStyleReg + "' onclick='currentDashboardTab=\"regions\"; updateRegionalDashboard();'>🌍 Регионы</div>" +
                   "<div style='" + btnStyleCit + "' onclick='currentDashboardTab=\"cities\"; updateRegionalDashboard();'>🏙️ Города</div>" +
                   "</div>";

    htmlContent += "<div id='dashboard-inner-scroll' style='flex:1; overflow-y:auto; padding-right:2px;'>";

    // 3. ОТРИСОВКА ВКЛАДКИ «РЕГИОНЫ»
    if (currentDashboardTab === "regions") {
        var regions = {};
        
        for (var cityId in citySimulations) {
            var city = citySimulations[cityId];
            var rawNode = typeof nodes !== "undefined" ? nodes.get(cityId) : null;
            var regionName = (rawNode && rawNode.region) ? rawNode.region : "Global";
            regionName = regionName.charAt(0).toUpperCase() + regionName.slice(1);

            if (!regions[regionName]) {
                regions[regionName] = {
                    citiesCount: 0,
                    weather: city.currentEvent || "Clear",
                    breadPrices: [], woodPrices: [], stonePrices: [],
                    tripsCount: 0
                };
            }
            
            regions[regionName].citiesCount++;
            if (city.products["Commodity A"]) regions[regionName].breadPrices.push(city.products["Commodity A"].current_price);
            if (city.products["Commodity B"]) regions[regionName].woodPrices.push(city.products["Commodity B"].current_price);
            if (city.products["Commodity C"]) regions[regionName].stonePrices.push(city.products["Commodity C"].current_price);
        }

        if (typeof roadNetwork !== "undefined" && Array.isArray(roadNetwork)) {
            roadNetwork.forEach(function(road) {
                var trips = road.totalTrips || 0;
                var nodeA = typeof nodes !== "undefined" ? nodes.get(road.u) : null;
                var rName = (nodeA && nodeA.region) ? nodeA.region : "Global";
                rName = rName.charAt(0).toUpperCase() + rName.slice(1);
                if (regions[rName]) {
                    regions[rName].tripsCount += trips;
                }
            });
        }

        for (var rKey in regions) {
            var rData = regions[rKey];
            var avgBread = rData.breadPrices.length ? (rData.breadPrices.reduce(function(a,b){return a+b;}, 0) / rData.breadPrices.length) : 0;
            var avgWood = rData.woodPrices.length ? (rData.woodPrices.reduce(function(a,b){return a+b;}, 0) / rData.woodPrices.length) : 0;
            var avgStone = rData.stonePrices.length ? (rData.stonePrices.reduce(function(a,b){return a+b;}, 0) / rData.stonePrices.length) : 0;

            htmlContent += "<div style='margin-bottom:10px; background:rgba(50,50,50,0.4); padding:8px; border-radius:4px; border-left:3px solid #3498db;'>" +
                           "<div style='font-weight:bold; color:#3498db; font-size:13px; margin-bottom:4px;'>" + rKey + " (" + rData.citiesCount + " nodes)</div>" +
                           "<div style='margin-bottom:2px;'>🌤️ Weather: <span style='color:#e74c3c;'>" + rData.weather + "</span></div>" +
                           "<div style='margin-bottom:4px;'>🚚 Total trips: <span style='color:#2ecc71; font-weight:bold;'>"+ rData.tripsCount +"</span></div>" +
                           "<div style='font-size:11px; color:#ddd; line-height:1.4;'>" +
                           "• Avg. Commodity A price: " + avgBread.toFixed(1) + " units<br>" +
                           "• Avg. Commodity B price: " + avgWood.toFixed(1) + " units<br>" +
                           "• Avg. Commodity C price: " + avgStone.toFixed(1) + " units" +
                           "</div>" +
                           "</div>";
        }
    }
    
    else if (currentDashboardTab === "weather") {
        var currentGlobalHour = (((gameDay - 1) * 24) + gameHour) % weatherHistoryDB.length;
        var baseRecord = weatherHistoryDB[currentGlobalHour];

        var sampleCityIds = Object.keys(citySimulations).slice(0, 4);
        sampleCityIds.forEach(function(cityId, idx) {
            var cName = cityId;
            var wObj = EventSystem.getCityLocalWeather(cName, baseRecord, gameDay, gameHour);

            htmlContent += "<div style='margin-bottom:8px; background:rgba(40,45,50,0.5); padding:8px; border-radius:4px; border-left:3px solid #2ecc71;'>"+
                           "<div style='font-weight:bold; color:#2ecc71; margin-bottom:4px;'>🌍 Sample region " + (idx + 1) + "</div>"+
                           "<table style='width:100%; font-size:11px; text-align:left;'>"+
                           "<tr><td>🌡️ Temperature:</td><td style='color:#f1c40f'>" + wObj.temp.toFixed(1) + " °C</td></tr>"+
                           "<tr><td>💧 Rain:</td><td style='color:#3498db'>" + wObj.rain.toFixed(1) + " mm</td></tr>"+
                           "<tr><td>💨 Wind:</td><td style='color:#95a5a6'>" + Math.round(wObj.wind) + " km/h</td></tr>"+
                           "<tr><td>⚡ Local status:</td><td style='color:#e74c3c; font-weight:bold;'>" + wObj.name.split(" (")[0] + "</td></tr>"+
                           "</table>"+
                           "</div>";
        });
    }

    // 4. ОТРИСОВКА ВКЛАДКИ «ГОРОДА» (Новый функционал процессов в городах)
    else if (currentDashboardTab === "cities") {
        for (var cityId in citySimulations) {
            var city = citySimulations[cityId];
            
            var bread = city.products["Commodity A"] || { stock: 0, current_price: 0 };
            var wood = city.products["Commodity B"] || { stock: 0, current_price: 0 };
            var stone = city.products["Commodity C"] || { stock: 0, current_price: 0 };

            var specColor = "#f1c40f";
            if (city.specializationText.includes("Commodity A")) specColor = "#e67e22";
            if (city.specializationText.includes("Commodity B")) specColor = "#2ecc71";
            if (city.specializationText.includes("Commodity C")) specColor = "#95a5a6";

            htmlContent += "<div style='margin-bottom:8px; background:rgba(60,60,60,0.3); padding:8px; border-radius:4px; border-left:3px solid " + specColor + ";'>" +
                           "<div style='display:flex; justify-content:between; font-weight:bold; font-size:12px; margin-bottom:3px;'>" +
                           "<span style='color:#fff;'>" + cityId + "</span>" +
                           "</div>" +
                           "<div style='font-size:10px; color:" + specColor + "; margin-bottom:4px; font-style:italic;'>" + city.specializationText.split(" (")[0] + "</div>" +
                            
                           "<table style='width:100%; border-collapse:collapse; font-size:11px; text-align:left; color:#ccc;'>" +
                           "<tr style='border-bottom:1px solid rgba(255,255,255,0.1); color:#aaa; font-size:10px;'>" +
                           "<th>Commodity</th><th>Stock</th><th>Price</th>" +
                           "</tr>" +
                           "<tr>" +
                           "<td>Commodity A</td><td>" + Math.round(bread.stock) + "</td><td style='color:#f1c40f'>" + bread.current_price.toFixed(1) + "</td>" +
                           "</tr>" +
                           "<tr>" +
                           "<td>Commodity B</td><td>" + Math.round(wood.stock) + "</td><td style='color:#f1c40f'>" + wood.current_price.toFixed(1) + "</td>" +
                           "</tr>" +
                           "<tr>" +
                           "<td>Commodity C</td><td>" + Math.round(stone.stock) + "</td><td style='color:#f1c40f'>" + stone.current_price.toFixed(1) + "</td>" +
                           "</tr>" +
                           "</table>" +
                           "</div>";
        }
    }

    htmlContent += "</div>"; // Закрываем скролл-контейнер
    dashboard.innerHTML = htmlContent;
    var newInnerContainer = document.getElementById("dashboard-inner-scroll");
    if (newInnerContainer) {
        newInnerContainer.scrollTop = savedScrollTop;
    }
        // АКУРАТНО ДОБАВЛЯЕМ В САМЫЙ КОНЕЦ ФУНКЦИИ (перед самой последней скобкой }):
    
    var currentSideBtn = document.getElementById("dashboard-sidebar-toggle");
    if (dashboard && currentSideBtn) {
        // Если пользователь зафиксировал скрытие панели, принудительно удерживаем её за экраном
        if (window.isDashboardVisibleGlobal === false) {
            dashboard.style.left = "-342px";
            currentSideBtn.style.left = "0px";
            currentSideBtn.innerText = "▶";
        } else {
            // Если панель должна быть открыта, удерживаем её на законном месте
            dashboard.style.left = "12px";
            currentSideBtn.style.left = "352px";
            currentSideBtn.innerText = "◀";
        }
    }

}

function recordAndDrawCharts() {
    // 1. Создаем контейнер графиков снизу экрана, если его нет
    var chartContainer = document.getElementById("analytics-charts-panel");
    if (!chartContainer) {
        chartContainer = document.createElement("div");
        chartContainer.id = "analytics-charts-panel";
        chartContainer.style.cssText = "position:fixed; bottom:0; left:0; right:0; height:180px; " +
                                      "background:rgba(20,20,20,0.96); border-top:2px solid #444; z-index:999; " +
                                      "display:flex; gap:15px; padding:10px 20px; box-sizing:border-box; " +
                                      "color:#fff; font-family:Arial, sans-serif;";
        document.body.appendChild(chartContainer);
        
        // Сжимаем основной холст PyVis сверху, чтобы графики его не перекрывали
        var networkCanvas = document.getElementById("mynetwork");
        if (networkCanvas) networkCanvas.style.height = "calc(98vh - 180px)";
    }

    // 2. Сбор текущих макроэкономических метрик
    totalSimulationHoursCounter++;
    var totalPriceB = 0, totalPriceW = 0, totalPriceS = 0;
    var totalGoodsChecked = 0;
    var emptyStocksCount = 0;

    for (var cityId in citySimulations) {
        var city = citySimulations[cityId];
        totalPriceB += city.products["Commodity A"].current_price;
        totalPriceW += city.products["Commodity B"].current_price;
        totalPriceS += city.products["Commodity C"].current_price;
        totalGoodsChecked += 3;

        if (city.products["Commodity A"].stock <= 0.05) emptyStocksCount++;
        if (city.products["Commodity B"].stock <= 0.05) emptyStocksCount++;
        if (city.products["Commodity C"].stock <= 0.05) emptyStocksCount++;
    }

    var totalProfitCombined = 0;
    var totalTripsCombined = 0;
    if (typeof roadNetwork !== "undefined" && Array.isArray(roadNetwork)) {
        roadNetwork.forEach(function(road) {
            totalProfitCombined += (road.totalProfit || 0);
            totalTripsCombined += (road.totalTrips || 0);
        });
    }

    // Записываем средние значения текущего часа в массивы трендов
    chartsHistory.hours.push(totalSimulationHoursCounter);
    chartsHistory.breadPrices.push(totalPriceB / Object.keys(citySimulations).length);
    chartsHistory.woodPrices.push(totalPriceW / Object.keys(citySimulations).length);
    chartsHistory.stonePrices.push(totalPriceS / Object.keys(citySimulations).length);
    chartsHistory.emptyStockShares.push((emptyStocksCount / totalGoodsChecked) * 100);
    chartsHistory.avgRouteProfits.push(totalTripsCombined > 0 ? (totalProfitCombined / totalTripsCombined) : 0);

    // Ограничиваем историю последних 120 точек, чтобы графики не сжимались до нечитаемости
    if (chartsHistory.hours.length > 120) {
        for (var key in chartsHistory) chartsHistory[key].shift();
    }

    // 3. Функция генерации SVG-полилинии по массиву данных
    function generateSVGLine(dataArr, minVal, maxVal, width, height, color) {
        if (dataArr.length < 2) return "";
        var points = [];
        var stepX = width / (dataArr.length - 1);
        var valRange = (maxVal - minVal) === 0 ? 1 : (maxVal - minVal);
        
        for (var i = 0; i < dataArr.length; i++) {
            var x = i * stepX;
            var y = height - (((dataArr[i] - minVal) / valRange) * height);
            points.push(x + "," + y);
        }
        return "<polyline points='" + points.join(" ") + "' style='fill:none;stroke:" + color + ";stroke-width:2' />";
    }

    // 4. Отрисовка трех SVG панелей
    var w = Math.floor((window.innerWidth - 80) / 3); // Динамическая ширина под размер окна
    var h = 115;

    // График 1: Цены товаров
    var maxP = Math.max(Math.max.apply(null, chartsHistory.breadPrices), Math.max.apply(null, chartsHistory.woodPrices), Math.max.apply(null, chartsHistory.stonePrices), 40);
    var minP = Math.min(Math.min.apply(null, chartsHistory.breadPrices), Math.min.apply(null, chartsHistory.woodPrices), Math.min.apply(null, chartsHistory.stonePrices), 10);
    var svgPrices = "<svg width='" + w + "' height='" + h + "' style='background:#111;border:1px solid #333;margin-top:5px;'>" +
        generateSVGLine(chartsHistory.breadPrices, minP, maxP, w, h, "#e67e22") +
        generateSVGLine(chartsHistory.woodPrices, minP, maxP, w, h, "#2ecc71") +
        generateSVGLine(chartsHistory.stonePrices, minP, maxP, w, h, "#95a5a6") +
        "</svg>";

    // График 2: Дефицит (Пустые склады)
    var maxE = Math.max(Math.max.apply(null, chartsHistory.emptyStockShares), 20);
    var svgEmpty = "<svg width='" + w + "' height='" + h + "' style='background:#111;border:1px solid #333;margin-top:5px;'>" +
        generateSVGLine(chartsHistory.emptyStockShares, 0, maxE, w, h, "#e74c3c") +
        "</svg>";

    // График 3: Средняя прибыль рейса
    var maxPr = Math.max(Math.max.apply(null, chartsHistory.avgRouteProfits), 50);
    var minPr = Math.min(Math.min.apply(null, chartsHistory.avgRouteProfits), 0);
    var svgProfits = "<svg width='" + w + "' height='" + h + "' style='background:#111;border:1px solid #333;margin-top:5px;'>" +
        generateSVGLine(chartsHistory.avgRouteProfits, minPr, maxPr, w, h, "#f1c40f") +
        "</svg>";

    // Inserting finalized chart blocks into the HTML dashboard.
    chartContainer.innerHTML = 
        "<div style='flex:1; display:flex; flex-direction:column;'>" +
            "<div style='font-size:11px;font-weight:bold;color:#aaa;'>📈 AVERAGE PRICES (<span style='color:#e67e22'>Commodity A</span> | <span style='color:#2ecc71'>Commodity B</span> | <span style='color:#95a5a6'>Commodity C</span>)</div>" +
            svgPrices +
            "<div style='display:flex;justify-content:space-between;font-size:10px;color:#666;'><span>Min: " + minP.toFixed(1) + " u.</span><span>Max: " + maxP.toFixed(1) + " u.</span></div>" +
        "</div>" +
        "<div style='flex:1; display:flex; flex-direction:column;'>" +
            "<div style='font-size:11px;font-weight:bold;color:#aaa;'>🚨 EMPTY-STOCK SHARE (<span style='color:#e74c3c'>Shortage %</span>)</div>" +
            svgEmpty +
            "<div style='display:flex;justify-content:space-between;font-size:10px;color:#666;'><span>0%</span><span>Current: " + chartsHistory.emptyStockShares[chartsHistory.emptyStockShares.length - 1].toFixed(1) + "%</span></div>" +
        "</div>" +
        "<div style='flex:1; display:flex; flex-direction:column;'>" +
            "<div style='font-size:11px;font-weight:bold;color:#aaa;'>💰 AVERAGE ROUTE PROFIT (<span style='color:#f1c40f'>units / trip</span>)</div>" +
            svgProfits +
            "<div style='display:flex;justify-content:space-between;font-size:10px;color:#666;'><span>Min: " + minPr.toFixed(0) + " u.</span><span>Max: " + maxPr.toFixed(0) + " u.</span></div>" +
        "</div>";
}
