// Production, stocks, demand and prices for a single city.
function updateCityEconomy(id, data, exactTimeString) {
    var generalWeatherBonus = 0;
    if (data.currentEvent.includes("Дождь")) generalWeatherBonus = 0.1;
    if (data.currentEvent.includes("Засуха")) generalWeatherBonus = -0.1;

    var goodsText = "";
    for (var pName in data.products) {
        var item = data.products[pName];
        var baseProductVolume = 0;
        if (id === "Ростов-на-Дону") {
            if (pName === "Хлеб") baseProductVolume = 0.25;
            if (pName === "Дерево") baseProductVolume = 0.2;
            if (pName === "Камень") baseProductVolume = 0;
        } else if (id === "Неклиновский район" || id === "Азовский район") {
            if (pName === "Хлеб") baseProductVolume = 0.35;
            else baseProductVolume = 0.03;
        } else if (id === "Таганрог" || id === "Аксай") {
            if (pName === "Дерево") baseProductVolume = 0.3;
            else baseProductVolume = 0.03;
        } else if (id === "Азов") {
            if (pName === "Камень") {
                baseProductVolume = 0.25;
                if (data.currentEvent.includes("Засуха") && data.currentTemp > 38) baseProductVolume -= 0.15;
                else if (data.currentEvent.includes("Дождь")) baseProductVolume -= 0.05;
            } else baseProductVolume = 0.02;
        }

        if (pName !== "Камень" && baseProductVolume > 0.05) baseProductVolume += generalWeatherBonus;
        if (baseProductVolume < 0) baseProductVolume = 0;
        var baseBuyVolume = (id === "Ростов-на-Дону" && pName === "Камень") ? 0.3 : 0.15;
        item.stock += baseProductVolume;
        item.stock -= baseBuyVolume;
        if (item.stock < 0) item.stock = 0;

        var demand = Math.round(baseBuyVolume * 60);
        var currentProdPerHour = Math.round(baseProductVolume * 60);
        var supply = currentProdPerHour + Math.round(item.stock);
        var ratio = supply === 0 ? 1.3 : demand / supply;
        ratio = Math.max(0.7, Math.min(ratio, 1.3));
        var priceMarket = item.base_price * ratio;
        var priceLinear = item.base_price + (demand - currentProdPerHour) * 1.5 - item.stock * 0.2;
        if (data.currentEvent === "Засуха") priceLinear += 6;
        if (data.currentEvent === "Дождь") priceLinear -= 4;
        priceLinear = Math.max(10, Math.min(priceLinear, 80));
        var priceInertia = item.last_price + (demand - currentProdPerHour) * 0.8 - item.stock * 0.1;
        if (data.currentEvent === "Засуха") priceInertia += 5;
        if (data.currentEvent === "Дождь") priceInertia -= 3;
        priceInertia = Math.max(10, Math.min(priceInertia, 80));
        item.last_price = priceInertia;
        item.current_price = priceInertia;

        var specialNote = "";
        if (pName === "Камень") {
            if (data.currentEvent.includes("Засуха") && data.currentTemp > 38) specialNote = " (Жара -80%)";
            else if (data.currentEvent.includes("Дождь")) specialNote = " (Дождь -20%)";
        }
        goodsText += "\n[ TOBAP: " + pName + specialNote + " ]" +
            "\n * Производство : " + currentProdPerHour + " ед./ч (прогноз)" +
            "\n * Спрос (Закупки): " + demand + " ед./ч" +
            "\n * Предложение  : " + supply + " ед. (На складе: " + Math.round(item.stock) + ")" +
            "\n * Цена (Рыночн) : " + priceMarket.toFixed(1) + " руб." +
            "\n * Цена (Линейн) : " + priceLinear.toFixed(1) + " руб." +
            "\n * Цена (Инерц)  : " + priceInertia.toFixed(1) + " руб.\n";
    }
    var tooltipText = "ГОРОД: " + id.toUpperCase() + "\nПрофиль: " + data.specializationText +
        "\n-------------------------------------" +
        "\n⏱ Высокоточное время: День " + gameDay + ", " + exactTimeString +
        "\n👥 Население: " + data.population.toLocaleString() + " чел." +
        "\n🌡️ Погода: " + data.currentTemp + " C | Среда: " + data.currentEvent +
        "\n💧 Влажность: " + parseFloat(data.humidity.toFixed(1)) + "%" +
        "\n-------------------------------------" + goodsText;
    nodes.update({id: id, title: tooltipText});
}
