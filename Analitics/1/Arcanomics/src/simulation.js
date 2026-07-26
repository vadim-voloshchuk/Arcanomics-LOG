// Application coordinator. Dependencies are loaded before this file.
var SIMULATION_DURATION_HOURS = 30 * 24;
var completedGameHours = 0;
var simulationTimer = null;
var simulationStarted = false;
var simulationLogRows = [];
var priceHistoryRows = [];

window.onload = function () {
    initializeCitySimulations();

    var priceModelSelect = document.getElementById("priceModelSelect");
    var durationInput = document.getElementById("simulationDurationInput");
    var startButton = document.getElementById("startSimulationButton");

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
        if (simulationStarted) return;
        var durationDays = setSimulationDurationFromInput(durationInput, false);
        startSimulation(durationDays);
        startButton.disabled = true;
    });
};

function setSimulationDurationFromInput(durationInput, shouldLog) {
    var durationDays = Number(durationInput.value);
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) durationDays = 30;
    durationInput.value = durationDays;
    SIMULATION_DURATION_HOURS = durationDays * 24;
    if (shouldLog !== false) console.log("Simulation duration set to " + durationDays + " days.");
    return durationDays;
}

function startSimulation(durationDays) {
    simulationStarted = true;
    EventSystem.reset();
    simulationLogRows = [];
    priceHistoryRows = [];
    console.log("==================================================");
    console.log("Simulation started");
    console.log("Price model: " + ACTIVE_PRICE_MODEL.toUpperCase());
    console.log("Simulation duration: " + durationDays + " days");
    console.log("Random seed: " + EXPERIMENT_SEED);
    console.log("==================================================");

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
}

function runSimulationHour() {
    EventSystem.advanceToDay(gameDay);
    runSimulationStep();
    if (gameHour === 23) recordDailySimulationData();
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
        data.currentEvent = EventSystem.getDisplayText();
        updateCityEconomy(id, data, exactTimeString);
    }
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

    var totals = { "Хлеб": 0, "Дерево": 0, "Камень": 0 };
    var cityCount = 0;
    for (var cityId in citySimulations) {
        cityCount++;
        for (var productName in totals) totals[productName] += citySimulations[cityId].products[productName].current_price;
    }
    priceHistoryRows.push({
        day: gameDay,
        bread: cityCount ? totals["Хлеб"] / cityCount : 0,
        wood: cityCount ? totals["Дерево"] / cityCount : 0,
        stone: cityCount ? totals["Камень"] / cityCount : 0,
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
}
