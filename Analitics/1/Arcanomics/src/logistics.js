// Road conditions, trade routes, caravan transfers and financial tracking.
function updateRoadLogistics() {
    roadNetwork.forEach(function(road) {
        var cityA = citySimulations[road.u];
        var cityB = citySimulations[road.v];
        if (typeof road.totalProfit === "undefined") {
            road.totalProfit = 0;
            road.totalTrips = 0;
        }

        // Берем погодные модификаторы обоих городов
        var modA = EventSystem.getModifiers(cityA.localEventObject);
        var modB = EventSystem.getModifiers(cityB.localEventObject);

        // Считаем среднее влияние на транспорт
        var speedModifier = (modA.transportMultiplier + modB.transportMultiplier) / 2;
        var costModifier = (modA.transportCostMultiplier + modB.transportCostMultiplier) / 2;

        var weatherNotice = cityA.currentEvent + " | " + cityB.currentEvent;
        var tempRoutesList = road.routes.slice(0, 1);
        var mainRoute = tempRoutesList.shift();
        var distance = mainRoute.dist;
        var baseTransportCost = distance * 0.5;
        var finalTransportCost = baseTransportCost * costModifier;
        var activeTradeCargo = "No active caravans";
        var isTradingNow = false;
        var currentTripProfit = 0;
        var productNames = ["Commodity A", "Commodity B", "Commodity C"];
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
                    activeTradeCargo = "Caravan: " + road.v + " -> " + road.u + " [" + pName + " x" + CARAVAN_VOLUME + "]";
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
                    activeTradeCargo = "Caravan: " + road.u + " -> " + road.v + " [" + pName + " x" + CARAVAN_VOLUME + "]";
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

        var edgeTooltipText = "ROUTE: " + road.u + " <-> " + road.v +
            "\nWeather impact: " + weatherNotice +
            "\n-------------------------------------" +
            "\n📊 PROFIT STATISTICS:" +
            "\n * Route cost: " + finalTransportCost.toFixed(1) + " units" +
            "\n * Current trip revenue: " + (isTradingNow ? currentTripProfit.toFixed(1) + " units" : "0 units") +
            "\n * Average net profit: " + avgProfit.toFixed(1) + " units/trip" +
            "\n * Total trips: " + road.totalTrips +
            "\n-------------------------------------" +
            "\n🚚 LOGISTICS: " + activeTradeCargo + "\n";

        road.routes.forEach(function(route, index) {
            var actualSpeed = route.speed * speedModifier;
            if (isTradingNow) actualSpeed *= 0.85;
            var travelTimeHours = route.dist / actualSpeed;
            var hours = Math.floor(travelTimeHours);
            var minutes = Math.round((travelTimeHours - hours) * 60);
            edgeTooltipText += "\nOption " + (index + 1) + ": " + route.name +
                "\nLength: " + route.dist + " km" +
                "\nJourney time: " + (hours > 0 ? hours + " h " : "") + minutes + " min (" + Math.round(actualSpeed) + " km/h)\n";
        });

        if (typeof network !== "undefined") network.redraw();
        edges.update({
            id: road.id, label: mainRoute.dist + " km", title: edgeTooltipText, width: roadWidth,
            arrows: { to: { enabled: false } },
            color: { color: roadColor, hover: "#ffffff", highlight: "#ff4d4d" }
        });
    });
}
