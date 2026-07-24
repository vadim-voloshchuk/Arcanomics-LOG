// Production, stocks, demand and prices for a single city driven by real-world API weather.
function updateCityEconomy(id, data, exactTimeString) {
    // Бонусы к производству на основе РЕАЛЬНЫХ погодных условий из API
    var generalWeatherBonus = 0;
    if (data.currentEvent.includes("Дождь")) generalWeatherBonus = 0.12;
    if (data.currentEvent.includes("Засуха")) generalWeatherBonus = -0.15;

    var goodsText = "";
    for (var pName in data.products) {
        var item = data.products[pName];
        var baseProductVolume = 0;

        // Распределение специализаций городов на основе продвинутого географического движка
        if (data.specializationText.includes("Торговый Хаб")) {
            if (pName === "Хлеб") baseProductVolume = 0.25;
            if (pName === "Дерево") baseProductVolume = 0.20;
            if (pName === "Камень") baseProductVolume = 0.00;
        } else if (data.specializationText.includes("Агрокомплекс")) {
            if (pName === "Хлеб") baseProductVolume = 0.40; // Профильное производство хлеба
            else baseProductVolume = 0.02;
        } else if (data.specializationText.includes("Промышленность")) {
            if (pName === "Дерево") baseProductVolume = 0.35; // Профильное производство дерева
            else baseProductVolume = 0.02;
        } else if (data.specializationText.includes("Горнодобыча")) {
            if (pName === "Камень") {
                baseProductVolume = 0.30; // Профильная добыча камня
                // Если в реальности наступила экстремальная жара или сильный ливень, добыча в карьерах падает
                if (data.currentEvent.includes("Засуха") && data.currentTemp > 35) baseProductVolume -= 0.15;
                else if (data.currentEvent.includes("Дождь")) baseProductVolume -= 0.08;
            } else baseProductVolume = 0.02;
        } else {
            // Обычный город-потребитель
            baseProductVolume = 0.05;
        }

        // Применяем погодные бонусы к сельскохозяйственным товарам и древесине
        if (pName !== "Камень" && baseProductVolume > 0.05) {
            baseProductVolume += generalWeatherBonus;
        }
        if (baseProductVolume < 0) baseProductVolume = 0;

        // Потребление ресурсов: Мегаполисы-Хабы скупают в два раза больше камня для застройки
        var baseBuyVolume = (data.specializationText.includes("Торговый Хаб") && pName === "Камень") ? 0.32 : 0.16;

        // Симуляция работы складов в час
        item.stock += baseProductVolume;
        item.stock -= baseBuyVolume;
        if (item.stock < 0) item.stock = 0;

        // Экономические маркеры спроса и предложения
        var demand = Math.round(baseBuyVolume * 60);
        var currentProdPerHour = Math.round(baseProductVolume * 60);
        var supply = currentProdPerHour + Math.round(item.stock);

        var currentPrice;
        if (ACTIVE_PRICE_MODEL === "market") {
            var ratio = supply === 0 ? 1.3 : demand / supply;
            ratio = Math.max(0.7, Math.min(ratio, 1.3));
            currentPrice = item.base_price * ratio;
        } else if (ACTIVE_PRICE_MODEL === "linear") {
            currentPrice = item.base_price + (demand - currentProdPerHour) * 1.5 - item.stock * 0.2;
            if (data.currentEvent.includes("Засуха")) currentPrice += 7;
            if (data.currentEvent.includes("Дождь")) currentPrice -= 5;
            currentPrice = Math.max(10, Math.min(currentPrice, 120));
        } else if (ACTIVE_PRICE_MODEL === "inertia") {
            currentPrice = item.last_price + (demand - currentProdPerHour) * 0.8 - item.stock * 0.1;
            if (data.currentEvent.includes("Засуха")) currentPrice += 5;
            if (data.currentEvent.includes("Дождь")) currentPrice -= 4;
            currentPrice = Math.max(10, Math.min(currentPrice, 120));
            item.last_price = currentPrice;
        } else {
            throw new Error("Unknown ACTIVE_PRICE_MODEL: " + ACTIVE_PRICE_MODEL);
        }
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
            weather_event: data.currentEvent
        });

        var specialNote = "";
        if (pName === "Камень") {
            if (data.currentEvent.includes("Засуха") && data.currentTemp > 35) specialNote = " (Жара -50% выработка)";
            else if (data.currentEvent.includes("Дождь")) specialNote = " (Дождь -25% выработка)";
        }

        goodsText += "\n[ TOBAP: " + pName + specialNote + " ]" +
            "\n * Производство : " + currentProdPerHour + " ед./ч (прогноз)" +
            "\n * Спрос (Закупки): " + demand + " ед./ч" +
            "\n * Предложение  : " + supply + " ед. (На складе: " + Math.round(item.stock) + ")" +
            "\n * Цена (" + ACTIVE_PRICE_MODEL + ") : " + currentPrice.toFixed(1) + " руб.\n";
    }

    // Формируем красивый и точный интерактивный тултип для Vis.js
    var tooltipText = "ГОРОД: " + id.toUpperCase() + "\nПрофиль: " + data.specializationText +
        "\n-------------------------------------" +
        "\n⏱ Время: День " + gameDay + ", " + exactTimeString +
        "\n👥 Население: " + data.population.toLocaleString() + " чел." +
        "\n🌡️ Погода API: " + data.currentTemp + " C | Среда: " + data.currentEvent +
        "\n💧 Влажность: " + parseFloat(data.humidity.toFixed(1)) + "%" +
        "\n-------------------------------------" + goodsText;

    nodes.update({id: id, title: tooltipText});
}
