// Road conditions, trade routes and caravan transfers.
function updateRoadLogistics() {
    roadNetwork.forEach(function(road) {
        var cityA = citySimulations[road.u];
        var cityB = citySimulations[road.v];
        var speedModifier = 1.0;
        var weatherNotice = "Отличная видимость";
        if (cityA.currentEvent === "Дождь" || cityB.currentEvent === "Дождь") {
            speedModifier = 0.70;
            weatherNotice = "Мокрый асфальт (Скорость -30%)";
        } else if (cityA.currentEvent === "Засуха" || cityB.currentEvent === "Засуха") {
            if (cityA.currentTemp > 38 || cityB.currentTemp > 38) {
                speedModifier = 0.80;
                weatherNotice = "Экстремальная жара (Скорость -20%)";
            }
        }
        var tempRoutesList = road.routes.slice(0, 1);
        var mainRoute = tempRoutesList.shift();
        var distance = mainRoute.dist;
        var transportCost = distance * 0.1;
        var activeTradeCargo = "Нет активных караванов";
        var isTradingNow = false;
        var productNames = ["Хлеб", "Дерево", "Камень"];
        for (var i = 0; i < productNames.length; i++) {
            var pName = productNames[i];
            var priceInA = cityA.products[pName].current_price;
            var priceInB = cityB.products[pName].current_price;
            if (priceInA > (priceInB + transportCost) && cityB.products[pName].stock > 10) {
                cityB.products[pName].stock -= 0.5;
                cityA.products[pName].stock += 0.5;
                isTradingNow = true;
                activeTradeCargo = "Караван: " + road.v + " -> " + road.u + " (Транзит: " + pName + ")";
                break;
            } else if (priceInB > (priceInA + transportCost) && cityA.products[pName].stock > 10) {
                cityA.products[pName].stock -= 0.5;
                cityB.products[pName].stock += 0.5;
                isTradingNow = true;
                activeTradeCargo = "Караван: " + road.u + " -> " + road.v + " (Транзит: " + pName + ")";
                break;
            }
        }
        var roadColor = "#2ecc71";
        var roadWidth = 2;
        if (isTradingNow) { roadColor = "#f1c40f"; roadWidth = 5; }
        else if (cityA.currentEvent === "Дождь" || cityB.currentEvent === "Дождь") { roadColor = "#3498db"; roadWidth = 3; }
        else if (cityA.currentEvent === "Засуха" || cityB.currentEvent === "Засуха") {
            if (cityA.currentTemp > 38 || cityB.currentTemp > 38) { roadColor = "#e67e22"; roadWidth = 4; }
        }
        var edgeTooltipText = "МАРШРУТ: " + road.u + " <-> " + road.v +
            "\nУсловия трассы: " + weatherNotice +
            "\nЛогистика: Накладные расходы пути: " + transportCost.toFixed(1) + " руб.\n" +
            "\nМЕЖГОРОДСКАЯ ЛОГИСТИКА: " + activeTradeCargo + "\n";
        var labelDistanceText = "";
        var loopRoutesList = road.routes.slice(0);
        loopRoutesList.forEach(function(route, index) {
            var actualSpeed = route.speed * speedModifier;
            if (isTradingNow) actualSpeed *= 0.85;
            var travelTimeHours = route.dist / actualSpeed;
            var hours = Math.floor(travelTimeHours);
            var minutes = Math.round((travelTimeHours - hours) * 60);
            var totalMinutes = (travelTimeHours - hours) * 60;
            var seconds = Math.round((totalMinutes - minutes) * 60);
            if (seconds < 0) seconds = 0;
            edgeTooltipText += "\nВариант " + (index + 1) + ": " + route.name +
                "\nДлина: " + route.dist + " км" +
                "\nВремя логистики в пути: " + (hours > 0 ? hours + " ч. " : "") + minutes + " мин. " + seconds + " сек. (скор. " + Math.round(actualSpeed) + " км/ч)\n";
            if (index === 0) labelDistanceText = route.dist + " км";
        });
        if (typeof network !== "undefined") network.redraw();
        edges.update({
            id: road.id, label: labelDistanceText, title: edgeTooltipText, width: roadWidth,
            arrows: { to: { enabled: true, scaleFactor: isTradingNow ? 0.9 : 0.4 } },
            color: { color: roadColor, hover: "#ffffff", highlight: "#ff4d4d" }
        });
    });
}
