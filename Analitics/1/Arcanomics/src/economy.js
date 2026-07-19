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

        // Рыночный коэффициент баланса
        var ratio = supply === 0 ? 1.3 : demand / supply;
        ratio = Math.max(0.7, Math.min(ratio, 1.3));
        var priceMarket = item.base_price * ratio;

        // Линейная цена с учетом влияния погодных катастроф из API
        var priceLinear = item.base_price + (demand - currentProdPerHour) * 1.5 - item.stock * 0.2;
        if (data.currentEvent.includes("Засуха")) priceLinear += 7;
        if (data.currentEvent.includes("Дождь")) priceLinear -= 5;
        priceLinear = Math.max(10, Math.min(priceLinear, 120));

        // Инерционная (конечная рабочая) цена, на основе которой торгуют караваны
        var priceInertia = item.last_price + (demand - currentProdPerHour) * 0.8 - item.stock * 0.1;
        if (data.currentEvent.includes("Засуха")) priceInertia += 5;
        if (data.currentEvent.includes("Дождь")) priceInertia -= 4;
        priceInertia = Math.max(10, Math.min(priceInertia, 120));

        // Сохраняем новые цены в глобальный объект симуляции
        item.last_price = priceInertia;
        item.current_price = priceInertia;

        var specialNote = "";
        if (pName === "Камень") {
            if (data.currentEvent.includes("Засуха") && data.currentTemp > 35) specialNote = " (Жара -50% выработка)";
            else if (data.currentEvent.includes("Дождь")) specialNote = " (Дождь -25% выработка)";
        }

        goodsText += "\n[ TOBAP: " + pName + specialNote + " ]" +
            "\n * Производство : " + currentProdPerHour + " ед./ч (прогноз)" +
            "\n * Спрос (Закупки): " + demand + " ед./ч" +
            "\n * Предложение  : " + supply + " ед. (На складе: " + Math.round(item.stock) + ")" +
            "\n * Цена (Рыночн) : " + priceMarket.toFixed(1) + " руб." +
            "\n * Цена (Линейн) : " + priceLinear.toFixed(1) + " руб." +
            "\n * Цена (Инерц)  : " + priceInertia.toFixed(1) + " руб.\n";
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
