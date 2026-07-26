// Road conditions, trade routes, caravan transfers and financial tracking.
function updateRoadLogistics() {
    roadNetwork.forEach(function(road) {
        var cityA = citySimulations[road.u];
        var cityB = citySimulations[road.v];
        if (typeof road.totalProfit === "undefined") {
            road.totalProfit = 0;
            road.totalTrips = 0;
        }

        var weatherModifiers = EventSystem.getModifiers();
        var speedModifier = weatherModifiers.transportMultiplier;
        var weatherNotice = EventSystem.getDisplayText();
        var tempRoutesList = road.routes.slice(0, 1);
        var mainRoute = tempRoutesList.shift();
        var distance = mainRoute.dist;
        var baseTransportCost = distance * 0.5;
        var finalTransportCost = baseTransportCost * weatherModifiers.transportCostMultiplier;
        var activeTradeCargo = "Нет активных караванов";
        var isTradingNow = false;
        var currentTripProfit = 0;
        var productNames = ["Хлеб", "Дерево", "Камень"];
        var CARAVAN_VOLUME = 15;

        for (var i = 0; i < productNames.length; i++) {
            var pName = productNames[i];
            var priceInA = cityA.products[pName].current_price;
            var priceInB = cityB.products[pName].current_price;

            if (priceInA > priceInB && cityB.products[pName].stock >= CARAVAN_VOLUME) {
                var grossRevenue = (priceInA - priceInB) * CARAVAN_VOLUME;
                var netProfit = grossRevenue - finalTransportCost;
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
                var reverseGrossRevenue = (priceInB - priceInA) * CARAVAN_VOLUME;
                var reverseNetProfit = reverseGrossRevenue - finalTransportCost;
                if (reverseNetProfit > 0) {
                    cityA.products[pName].stock -= CARAVAN_VOLUME;
                    cityB.products[pName].stock += CARAVAN_VOLUME;
                    isTradingNow = true;
                    currentTripProfit = reverseNetProfit;
                    road.totalProfit += reverseNetProfit;
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
        else if (speedModifier < 1) { roadColor = "#3498db"; roadWidth = 3; }

        var edgeTooltipText = "МАРШРУТ: " + road.u + " <-> " + road.v +
            "\nПогодное событие: " + weatherNotice +
            "\n-------------------------------------" +
            "\n📊 СТАТИСТИКА ДОХОДНОСТИ:" +
            "\n * Себестоимость рейса: " + finalTransportCost.toFixed(1) + " руб." +
            "\n * Выручка текущего рейса: " + (isTradingNow ? currentTripProfit.toFixed(1) + " руб." : "0 руб.") +
            "\n * СРЕДНЯЯ ЧИСТАЯ ПРИБЫЛЬ: " + avgProfit.toFixed(1) + " руб./рейс" +
            "\n * Всего совершено рейсов: " + road.totalTrips +
            "\n-------------------------------------" +
            "\n🚚 ЛОГИСТИКА: " + activeTradeCargo + "\n";

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
            id: road.id, label: mainRoute.dist + " км", title: edgeTooltipText, width: roadWidth,
            arrows: { to: { enabled: true, scaleFactor: isTradingNow ? 0.9 : 0.4 } },
            color: { color: roadColor, hover: "#ffffff", highlight: "#ff4d4d" }
        });
    });
}
