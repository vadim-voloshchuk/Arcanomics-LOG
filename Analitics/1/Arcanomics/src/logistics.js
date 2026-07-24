// Road conditions, trade routes, caravan transfers and financial tracking.
function updateRoadLogistics() {
    roadNetwork.forEach(function(road) {
        var cityA = citySimulations[road.u];
        var cityB = citySimulations[road.v];

        if (typeof road.totalProfit === "undefined") {
            road.totalProfit = 0;
            road.totalTrips = 0;
        }

        var speedModifier = 1.0;
        var weatherNotice = "Отличная видимость";
        var weatherCostPenalty = 0;

        if (cityA.currentEvent.includes("Дождь") || cityB.currentEvent.includes("Дождь")) {
            speedModifier = 0.70;
            weatherNotice = "Мокрый асфальт (Скорость -30%, Расходы +40%)";
            weatherCostPenalty = 0.40;
        } else if (cityA.currentEvent.includes("Засуха") || cityB.currentEvent.includes("Засуха")) {
            if (cityA.currentTemp > 35 || cityB.currentTemp > 35) {
                speedModifier = 0.80;
                weatherNotice = "Экстремальная жара (Скорость -20%, Расходы +20%)";
                weatherCostPenalty = 0.20;
            }
        }

        var tempRoutesList = road.routes.slice(0, 1);
        var mainRoute = tempRoutesList.shift();
        var distance = mainRoute.dist;

        var baseTransportCost = distance * 0.5;
        var finalTransportCost = baseTransportCost * (1 + weatherCostPenalty);

        var activeTradeCargo = "Нет активных караванов";
        var isTradingNow = false;
        var currentTripProfit = 0;

        var productNames = ["Хлеб", "Дерево", "Камень"];
        var CARAVAN_VOLUME = 15;

        for (var i = 0; i < productNames.length; i++) {
    var pName = productNames[i];
    var priceInA = cityA.products[pName].current_price;
    var priceInB = cityB.products[pName].current_price;

    console.log(
        road.u,
        "->",
        road.v,
        "| Товар:",
        pName,
        "| Цена A:",
        priceInA,
        "| Цена B:",
        priceInB,
        "| Склад A:",
        cityA.products[pName].stock.toFixed(1),
        "| Склад B:",
        cityB.products[pName].stock.toFixed(1)
    );

    if (priceInA > priceInB && cityB.products[pName].stock >= CARAVAN_VOLUME) {
        var grossRevenue = (priceInA - priceInB) * CARAVAN_VOLUME;
        var netProfit = grossRevenue - finalTransportCost;

        console.log(
            ">>> A -> B",
            "| Доход:",
            grossRevenue.toFixed(2),
            "| Перевозка:",
            finalTransportCost.toFixed(2),
            "| Прибыль:",
            netProfit.toFixed(2)
        );

        if (netProfit > 0) {
            cityB.products[pName].stock -= CARAVAN_VOLUME;
            cityA.products[pName].stock += CARAVAN_VOLUME;
            isTradingNow = true;
            currentTripProfit = netProfit;
            road.totalProfit += netProfit;
            road.totalTrips++;
            activeTradeCargo = "Караван: " + road.v + " -> " + road.u + " [" + pName + " x" + CARAVAN_VOLUME + "]";
            break;
        }
    } else if (priceInB > priceInA && cityA.products[pName].stock >= CARAVAN_VOLUME) {
        var grossRevenue = (priceInB - priceInA) * CARAVAN_VOLUME;
        var netProfit = grossRevenue - finalTransportCost;

        console.log(
            ">>> B -> A",
            "| Доход:",
            grossRevenue.toFixed(2),
            "| Перевозка:",
            finalTransportCost.toFixed(2),
            "| Прибыль:",
            netProfit.toFixed(2)
        );

        if (netProfit > 0) {
            cityA.products[pName].stock -= CARAVAN_VOLUME;
            cityB.products[pName].stock += CARAVAN_VOLUME;
            isTradingNow = true;
            currentTripProfit = netProfit;
            road.totalProfit += netProfit;
            road.totalTrips++;
            activeTradeCargo = "Караван: " + road.u + " -> " + road.v + " [" + pName + " x" + CARAVAN_VOLUME + "]";
            break;
        }
    }
}

        var avgProfit = road.totalTrips > 0 ? (road.totalProfit / road.totalTrips) : 0;

        roadHourLogs.push({
            road: road.u + " <-> " + road.v,
            trip_count: road.totalTrips,
            trip_profit: currentTripProfit,
            total_profit: road.totalProfit
        });

        var roadColor = "#2ecc71";
        var roadWidth = 2;
        if (isTradingNow) { roadColor = "#f1c40f"; roadWidth = 5; }
        else if (cityA.currentEvent.includes("Дождь") || cityB.currentEvent.includes("Дождь")) { roadColor = "#3498db"; roadWidth = 3; }
        else if (cityA.currentEvent.includes("Засуха") || cityB.currentEvent.includes("Засуха")) {
            if (cityA.currentTemp > 35 || cityB.currentTemp > 35) { roadColor = "#e67e22"; roadWidth = 4; }
        }

        var edgeTooltipText = "МАРШРУТ: " + road.u + " <-> " + road.v +
            "\nУсловия трассы: " + weatherNotice +
            "\n-------------------------------------" +
            "\n📊 СТАТИСТИКА ДОХОДНОСТИ:" +
            "\n * Себестоимость рейса: " + finalTransportCost.toFixed(1) + " руб." +
            "\n * Выручка текущего рейса: " + (isTradingNow ? currentTripProfit.toFixed(1) + " руб." : "0 руб.") +
            "\n * СРЕДНЯЯ ЧИСТАЯ ПРИБЫЛЬ: " + avgProfit.toFixed(1) + " руб./рейс" +
            "\n * Всего совершено рейсов: " + road.totalTrips +
            "\n-------------------------------------" +
            "\n🚚 ЛОГИСТИКА: " + activeTradeCargo + "\n";

        var labelDistanceText = mainRoute.dist + " км";

        road.routes.forEach(function(route, index) {
            var actualSpeed = route.speed * speedModifier;
            if (isTradingNow) actualSpeed *= 0.85;
            var travelTimeHours = route.dist / actualSpeed;
            var hours = Math.floor(travelTimeHours);
            var minutes = Math.round((travelTimeHours - hours) * 60);

            edgeTooltipText += "\nВариант " + (index + 1) + ": " + route.name +
                "\nДлина: " + route.dist + " км" +
                "\nВремя в пути: " + (hours > 0 ? hours + " ч. " : "") + minutes + " мин. (" + Math.round(actualSpeed) + " км/ч)\n";
        });

        if (typeof network !== "undefined") network.redraw();
        edges.update({
            id: road.id, label: labelDistanceText, title: edgeTooltipText, width: roadWidth,
            arrows: { to: { enabled: true, scaleFactor: isTradingNow ? 0.9 : 0.4 } },
            color: { color: roadColor, hover: "#ffffff", highlight: "#ff4d4d" }
        });
    });
}
