// Production, stocks, demand and prices for a single city.
function updateCityEconomy(id, data, exactTimeString) {
    var goodsText = "";
    for (var pName in data.products) {
        var item = data.products[pName];
        var baseProductVolume = 0;
        var weatherModifiers = EventSystem.getModifiers(data.localEventObject, pName);

        if (data.specializationText.includes("Trade Hub")) {
            if (pName === "Commodity A") baseProductVolume = 0.25;
            if (pName === "Commodity B") baseProductVolume = 0.20;
            if (pName === "Commodity C") baseProductVolume = 0.00;
        } else if (data.specializationText.includes("Agri")) {
            if (pName === "Commodity A") baseProductVolume = 0.40;
            else baseProductVolume = 0.02;
        } else if (data.specializationText.includes("Industry")) {
            if (pName === "Commodity B") baseProductVolume = 0.35;
            else baseProductVolume = 0.02;
        } else if (data.specializationText.includes("Extraction")) {
            if (pName === "Commodity C") baseProductVolume = 0.30;
            else baseProductVolume = 0.02;
        } else {
            baseProductVolume = 0.05;
        }

        baseProductVolume *= weatherModifiers.productionMultiplier;
        var baseBuyVolume = (data.specializationText.includes("Trade Hub") && pName === "Commodity C") ? 0.32 : 0.16;

        item.stock += baseProductVolume;
        item.stock -= baseBuyVolume;
        if (item.stock < 0) item.stock = 0;

        var demand = Math.round(baseBuyVolume * 60);
        var currentProdPerHour = Math.round(baseProductVolume * 60);
        var supply = currentProdPerHour + Math.round(item.stock);

        var currentPrice;
        if (ACTIVE_PRICE_MODEL === "market") {
            var ratio = supply === 0 ? 3.5 : demand / supply;
            ratio = Math.max(0.3, Math.min(ratio, 3.5));
            currentPrice = item.base_price * ratio;
        } else if (ACTIVE_PRICE_MODEL === "linear") {
            currentPrice = item.base_price + (demand - currentProdPerHour) * 1.5 - item.stock * 0.2;
            currentPrice = Math.max(item.base_price * 0.4, Math.min(currentPrice, 120));
        } else if (ACTIVE_PRICE_MODEL === "inertia") {
            currentPrice = item.last_price + (demand - currentProdPerHour) * 0.8 - item.stock * 0.1;
            currentPrice = Math.max(item.base_price * 0.4, Math.min(currentPrice, 120));
        } else {
            throw new Error("Unknown ACTIVE_PRICE_MODEL: " + ACTIVE_PRICE_MODEL);
        }
        currentPrice *= weatherModifiers.priceMultiplier;
        if (ACTIVE_PRICE_MODEL === "inertia") item.last_price = currentPrice;
        item.current_price = currentPrice;

        cityHourLogs.push({
            model: ACTIVE_PRICE_MODEL,
            seed: EXPERIMENT_SEED,
            day: gameDay,
            hour: gameHour,
            city: id,
            product: pName,
            stock: item.stock,
            production: currentProdPerHour,
            demand: demand,
            supply: supply,
            current_price: currentPrice,
            weather_event: EventSystem.getEventName()
        });

        goodsText += "\n[ ТОВАР: " + pName + " ]" +
            "\n * Производство : " + currentProdPerHour + " ед./ч" +
            "\n * Спрос (Закупки): " + demand + " ед./ч" +
            "\n * Предложение  : " + supply + " ед. (На складе: " + Math.round(item.stock) + ")" +
            "\n * Цена (" + ACTIVE_PRICE_MODEL + ") : " + currentPrice.toFixed(1) + " руб.\n";
    }

    var tooltipText = "ГОРОД: " + id.toUpperCase() + "\nПрофиль: " + data.specializationText +
        "\n-------------------------------------" +
        "\n⏱ Время: День " + gameDay + ", " + exactTimeString +
        "\n👥 Население: " + data.population.toLocaleString() + " чел." +
        "\n⚡ Погодное событие: " + data.currentEvent +
        "\n-------------------------------------" + goodsText;

    nodes.update({id: id, title: tooltipText});
}
