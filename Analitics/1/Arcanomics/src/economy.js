// Production, stocks, demand and prices for a single city.
//
// ЕДИНИЦЫ ИЗМЕРЕНИЯ: эта функция вызывается РОВНО ОДИН РАЗ за игровой час
// (см. runSimulationHour в simulation.js), поэтому все объёмы ниже -
// production_per_hour, demand_per_hour, fulfilled_demand, unmet_demand -
// выражены в "единицах товара за игровой час" и напрямую, без скрытых
// умножений, применяются к складским остаткам (тоже в единицах товара).

// Три модели ценообразования вынесены в отдельные функции с явно заданными
// параметрами - вместо коэффициентов, разбросанных внутри updateCityEconomy.
var PricingModels = {
    market: function(p) {
        var ratio = p.supply === 0 ? p.ratioMax : p.demand / p.supply;
        ratio = Math.max(p.ratioMin, Math.min(ratio, p.ratioMax));
        return p.basePrice * ratio;
    },
    linear: function(p) {
        var price = p.basePrice + (p.demand - p.production) * p.demandCoefficient - p.stock * p.stockCoefficient;
        return Math.max(p.basePrice * p.priceFloorRatio, Math.min(price, p.priceCeiling));
    },
    inertia: function(p) {
        var price = p.lastPrice + (p.demand - p.production) * p.demandCoefficient - p.stock * p.stockCoefficient;
        return Math.max(p.basePrice * p.priceFloorRatio, Math.min(price, p.priceCeiling));
    }
};

var PRICING_PARAMS = {
    market: { ratioMin: 0.3, ratioMax: 3.5 },
    linear: { demandCoefficient: 1.5, stockCoefficient: 0.2, priceFloorRatio: 0.4, priceCeiling: 120 },
    inertia: { demandCoefficient: 0.8, stockCoefficient: 0.1, priceFloorRatio: 0.4, priceCeiling: 120 }
};

function computeCurrentPrice(item, demandPerHour, productionPerHour, availableForSale, postSaleStock) {
    var modelName = ExperimentConfig.model;
    var modelFn = PricingModels[modelName];
    if (!modelFn) {
        throw new Error("Unknown ExperimentConfig.model: " + modelName);
    }

    var params;
    if (modelName === "market") {
        params = {
            basePrice: item.base_price,
            demand: demandPerHour,
            supply: availableForSale, // то, что реально можно было продать в этот час
            ratioMin: PRICING_PARAMS.market.ratioMin,
            ratioMax: PRICING_PARAMS.market.ratioMax
        };
    } else if (modelName === "linear") {
        params = {
            basePrice: item.base_price,
            demand: demandPerHour,
            production: productionPerHour,
            stock: postSaleStock,
            demandCoefficient: PRICING_PARAMS.linear.demandCoefficient,
            stockCoefficient: PRICING_PARAMS.linear.stockCoefficient,
            priceFloorRatio: PRICING_PARAMS.linear.priceFloorRatio,
            priceCeiling: PRICING_PARAMS.linear.priceCeiling
        };
    } else { // inertia
        params = {
            basePrice: item.base_price,
            lastPrice: item.last_price,
            demand: demandPerHour,
            production: productionPerHour,
            stock: postSaleStock,
            demandCoefficient: PRICING_PARAMS.inertia.demandCoefficient,
            stockCoefficient: PRICING_PARAMS.inertia.stockCoefficient,
            priceFloorRatio: PRICING_PARAMS.inertia.priceFloorRatio,
            priceCeiling: PRICING_PARAMS.inertia.priceCeiling
        };
    }

    return modelFn(params);
}

function updateCityEconomy(id, data, exactTimeString) {
    var goodsText = "";
    for (var pName in data.products) {
        var item = data.products[pName];
        var weatherModifiers = EventSystem.getModifiers(data.localWeatherObject, pName);

        // Базовая производительность города по товару, УЖЕ в единицах товара за игровой час.
        var baseProductionPerHour = 0;
        if (data.specializationText.includes("Trade Hub")) {
            if (pName === "Commodity A") baseProductionPerHour = 15;
            if (pName === "Commodity B") baseProductionPerHour = 12;
            if (pName === "Commodity C") baseProductionPerHour = 0;
        } else if (data.specializationText.includes("Agri")) {
            baseProductionPerHour = (pName === "Commodity A") ? 24 : 1.2;
        } else if (data.specializationText.includes("Industry")) {
            baseProductionPerHour = (pName === "Commodity B") ? 21 : 1.2;
        } else if (data.specializationText.includes("Extraction")) {
            baseProductionPerHour = (pName === "Commodity C") ? 18 : 1.2;
        } else {
            baseProductionPerHour = 3;
        }

        var productionPerHour = baseProductionPerHour * weatherModifiers.productionMultiplier;
        var demandPerHour = (data.specializationText.includes("Trade Hub") && pName === "Commodity C") ? 19.2 : 9.6;

        // Дефицит считаем НАПРЯМУЮ по объёмам, а не косвенно через изменение цены:
        // сколько реально было доступно к продаже (склад + производство этого часа),
        // столько максимум и можно продать.
        var availableForSale = item.stock + productionPerHour;
        var fulfilledDemand = Math.min(demandPerHour, availableForSale);
        var unmetDemand = Math.max(0, demandPerHour - fulfilledDemand);

        // Складские остатки гарантированно неотрицательны: продать можно не больше,
        // чем реально было в наличии, поэтому вычитание никогда не уйдёт ниже нуля.
        item.stock = availableForSale - fulfilledDemand;

        var currentPrice = computeCurrentPrice(item, demandPerHour, productionPerHour, availableForSale, item.stock);
        currentPrice *= weatherModifiers.priceMultiplier;
        if (ExperimentConfig.model === "inertia") item.last_price = currentPrice;
        item.current_price = currentPrice;

        cityHourLogs.push({
            run_id: ExperimentConfig.run_id,
            model: ExperimentConfig.model,
            scenario: ExperimentConfig.scenario,
            seed: ExperimentConfig.seed,
            day: gameDay,
            hour: gameHour,
            city: id,
            product: pName,
            stock: item.stock,
            production_per_hour: productionPerHour,
            demand_per_hour: demandPerHour,
            fulfilled_demand: fulfilledDemand,
            unmet_demand: unmetDemand,
            current_price: currentPrice,
            weather_event: data.localWeatherObject ? data.localWeatherObject.name : EventSystem.getEventName()
        });

        goodsText += "\n[ ТОВАР: " + pName + " ]" +
            "\n * Производство : " + productionPerHour.toFixed(2) + " ед./ч" +
            "\n * Спрос        : " + demandPerHour.toFixed(2) + " ед./ч" +
            "\n * Продано      : " + fulfilledDemand.toFixed(2) + " ед./ч (дефицит: " + unmetDemand.toFixed(2) + ")" +
            "\n * На складе    : " + Math.round(item.stock) + " ед." +
            "\n * Цена (" + ExperimentConfig.model + ") : " + currentPrice.toFixed(1) + " руб.\n";
    }

    var tooltipText = "ГОРОД: " + id.toUpperCase() + "\nПрофиль: " + data.specializationText +
        "\n-------------------------------------" +
        "\n⏱ Время: День " + gameDay + ", " + exactTimeString +
        "\n👥 Население: " + data.population.toLocaleString() + " чел." +
        "\n⚡ Погодное событие: " + (data.localWeatherLabel || "Нет данных") +
        "\n-------------------------------------" + goodsText;

    nodes.update({id: id, title: tooltipText});
}
