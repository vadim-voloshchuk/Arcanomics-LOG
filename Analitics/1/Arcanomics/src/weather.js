// Autonomous global weather-event system. All random choices use seededRandom().
var EventSystem = {
    currentEvent: null,
    daysRemaining: 0,
    cooldownDays: 0,
    lastEvent: null,
    lastProcessedDay: 0,
    selectionWeights: null,
    eventHistory: [],

    definitions: [
        { key: "drought", name: "Засуха", logName: "Drought", minDays: 3, maxDays: 4, resource: "Хлеб", productionMultiplier: 0.65, priceMultiplier: 1.20 },
        { key: "downpour", name: "Ливень", logName: "Downpour", minDays: 2, maxDays: 3, transportMultiplier: 0.80, transportCostMultiplier: 1.10 },
        { key: "frost", name: "Заморозки", logName: "Frost", minDays: 2, maxDays: 3, resource: "Хлеб", productionMultiplier: 0.70 },
        { key: "storm", name: "Шторм", logName: "Storm", minDays: 1, maxDays: 2, transportMultiplier: 0.60 },
        { key: "fog", name: "Туман", logName: "Fog", minDays: 1, maxDays: 2, transportMultiplier: 0.85 },
        { key: "harvest", name: "Урожайный сезон", logName: "Harvest Season", minDays: 3, maxDays: 4, resource: "Хлеб", productionMultiplier: 1.25 },
        { key: "fire", name: "Пожар на производстве", logName: "Production Fire", minDays: 1, maxDays: 2, productionMultiplier: 0.50 }
    ],

    reset: function() {
        this.currentEvent = null;
        this.daysRemaining = 0;
        this.cooldownDays = 0;
        this.lastEvent = null;
        this.lastProcessedDay = 0;
        this.selectionWeights = null;
        this.eventHistory = [];
    },

    advanceToDay: function(day) {
        if (this.lastProcessedDay === day) return;
        this.lastProcessedDay = day;

        if (this.currentEvent) {
            this.daysRemaining--;
            if (this.daysRemaining <= 0) this.endEvent(day - 1);
            return;
        }

        if (this.cooldownDays > 0) {
            this.cooldownDays--;
            console.log("Cooldown remaining: " + this.cooldownDays + " days");
            if (this.cooldownDays > 0) return;
        }

        if (seededRandom() < 0.35) this.startEvent(day);
    },

    startEvent: function(day) {
        var event = this.chooseEvent();
        var duration = event.minDays + Math.floor(seededRandom() * (event.maxDays - event.minDays + 1));
        var affectedResource = event.resource || null;
        if (event.key === "fire") {
            var resources = ["Хлеб", "Дерево", "Камень"];
            affectedResource = resources[Math.floor(seededRandom() * resources.length)];
        }

        this.currentEvent = {
            key: event.key,
            name: event.name,
            logName: event.logName,
            productionMultiplier: event.productionMultiplier || 1,
            transportMultiplier: event.transportMultiplier || 1,
            transportCostMultiplier: event.transportCostMultiplier || 1,
            priceMultiplier: event.priceMultiplier || 1,
            affectedResource: affectedResource,
            duration: duration,
            startDay: day
        };
        this.daysRemaining = duration;
        this.selectionWeights = null;
        this.eventHistory.push({
            start_day: day,
            end_day: day + duration - 1,
            duration: duration,
            event: event.name,
            affected_resource: affectedResource || "-",
            production_multiplier: this.currentEvent.productionMultiplier,
            transport_multiplier: this.currentEvent.transportMultiplier,
            transport_cost_multiplier: this.currentEvent.transportCostMultiplier,
            price_multiplier: this.currentEvent.priceMultiplier
        });
        console.log("⚡ Event started: " + event.logName);
        console.log("Duration: " + duration + " days");
    },

    endEvent: function(endDay) {
        var endedEvent = this.currentEvent;
        this.lastEvent = endedEvent.key;
        this.selectionWeights = this.getClimateMemory(endedEvent.key);
        this.currentEvent = null;
        this.cooldownDays = 4 + Math.floor(seededRandom() * 4);
        console.log("✅ Event ended: " + endedEvent.logName);
        console.log("Cooldown: " + this.cooldownDays + " days");
    },

    chooseEvent: function() {
        var candidates = this.definitions.filter(function(event) {
            return event.key !== EventSystem.lastEvent;
        });
        var weights = this.selectionWeights || {};
        var totalWeight = candidates.reduce(function(total, event) {
            return total + (weights[event.key] || 1);
        }, 0);
        var target = seededRandom() * totalWeight;
        for (var i = 0; i < candidates.length; i++) {
            target -= weights[candidates[i].key] || 1;
            if (target <= 0) return candidates[i];
        }
        return candidates[candidates.length - 1];
    },

    getClimateMemory: function(eventKey) {
        var weights = {};
        if (eventKey === "drought") { weights.downpour = 1.25; weights.harvest = 1.10; }
        if (eventKey === "downpour") { weights.fog = 1.20; weights.harvest = 1.15; weights.drought = 0.40; }
        if (eventKey === "storm") weights.downpour = 1.20;
        if (eventKey === "frost") { weights.harvest = 1.20; weights.drought = 0.40; }
        if (eventKey === "harvest") weights.drought = 1.10;
        return weights;
    },

    getModifiers: function(productName) {
        var modifiers = { productionMultiplier: 1, transportMultiplier: 1, transportCostMultiplier: 1, priceMultiplier: 1 };
        if (!this.currentEvent) return modifiers;
        var event = this.currentEvent;
        if (!event.affectedResource || typeof productName === "undefined" || productName === event.affectedResource) {
            modifiers.productionMultiplier = event.productionMultiplier;
            modifiers.priceMultiplier = event.priceMultiplier;
        }
        modifiers.transportMultiplier = event.transportMultiplier;
        modifiers.transportCostMultiplier = event.transportCostMultiplier;
        return modifiers;
    },

    getEventName: function() {
        return this.currentEvent ? this.currentEvent.name : "Нет";
    },

    getDisplayText: function() {
        if (!this.currentEvent) return "Нет активных погодных событий";
        return this.currentEvent.name + " (осталось: " + this.daysRemaining + " д.)";
    }
};
