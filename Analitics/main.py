import random

# === НАЧАЛЬНЫЕ ПАРАМЕТРЫ ===
days = 20
products = {

    "Хлеб": {
        "stock": 50,
        "base_price": 40,
        "last_price": 40
    },

    "Дерево": {
        "stock": 70,
        "base_price": 30,
        "last_price": 30
    },

    "Камень": {
        "stock": 90,
        "base_price": 20,
        "last_price": 20
    }

}
sum_t = 0

# Для сбора цен по трём формулам
prices_market = []
prices_linear = []
prices_inertia = []

for day in range(1, days + 1):
    print("=" * 40)
    # --- Температура ---
    temp = random.randint(15, 45)

    # --- Производство ---
    product = random.randint(8, 15)
    event = "Нет"

    # Дождь
    if random.randint(1, 100) <= 20:
        event = "Дождь"
        temp -= random.randint(3, 7)
        if temp < 10:
            temp = 10
        product += random.randint(3, 7)

    # Засуха
    if temp >= 35:
        event = "Засуха"
        product -= random.randint(3, 7)
        if product < 1:
            product = 1
    for name, item in products.items():

        # --- Покупки (спрос) ---
        buy = random.randint(8, 15)

        # --- Обновление склада ---
        item["stock"] += product
        item["stock"] -= buy
        if item["stock"] < 0:
            item["stock"] = 0

        # --- Спрос и предложение ---
        demand = buy
        supply = product + item["stock"]


        # Формула 1 Рыночная


        if supply == 0:
            ratio = 1.3
        else:
            ratio = demand / supply

        # Ограничиваем влияние спроса
        ratio = max(0.7, min(ratio, 1.3))

        price_market = item["base_price"] * ratio


        # Формула 2 Линейная


        price_linear = item["base_price"]

        # Если спрос выше производства цена растёт
        price_linear += (demand - product) * 1.5

        # Чем больше склад тем дешевле
        price_linear -= item["stock"] * 0.2

        # Погодные события

        if event == "Засуха":
            price_linear += 6

        elif event == "Дождь":
            price_linear -= 4

        price_linear = max(10, min(price_linear, 80))


        # Формула 3 Инерционная


        price_inertia = item["last_price"]

        price_inertia += (demand - product) * 0.8

        price_inertia -= item["stock"] * 0.1

        if event == "Засуха":
            price_inertia += 5

        elif event == "Дождь":
            price_inertia -= 3

        price_inertia = max(10, min(price_inertia, 80))

        item["last_price"] = price_inertia

        # Сохраняем цены
        prices_market.append(price_market)
        prices_linear.append(price_linear)
        prices_inertia.append(price_inertia)

        yesterday_p = price_inertia

        # --- Средняя температура ---
        sum_t += temp

        # --- Вывод ---
        print(f"\n{name}")
        print(f"Температура  : {temp}°C")
        print(f"Событие      : {event}")
        print(f"Производство : {product}")
        print(f"Покупки      : {buy}")
        print(f"Запас        : {item['stock']}")
        print(f"Цена (рынок) : {price_market:.2f}")
        print(f"Цена (линей) : {price_linear:.2f}")
        print(f"Цена (инерц) : {price_inertia:.2f}")

# === ИТОГИ ===
avg_temp = sum_t / (days * len(products))
avg_market = sum(prices_market) / len(prices_market)
avg_linear = sum(prices_linear) / len(prices_linear)
avg_inertia = sum(prices_inertia) / len(prices_inertia)

# Считаем разброс цен (макс - мин)
max_market = max(prices_market)
min_market = min(prices_market)
max_linear = max(prices_linear)
min_linear = min(prices_linear)
max_inertia = max(prices_inertia)
min_inertia = min(prices_inertia)

print("\n" + "=" * 40)
print("ИТОГИ СИМУЛЯЦИИ")
print("=" * 40)
print(f"Средняя температура: {avg_temp:.2f}°C")
print()
print("Рыночная формула:")
print(f"  Средняя цена: {avg_market:.2f}")
print(f"  Разброс цен: от {min_market:.2f} до {max_market:.2f}")
print()
print("Линейная формула:")
print(f"  Средняя цена: {avg_linear:.2f}")
print(f"  Разброс цен: от {min_linear:.2f} до {max_linear:.2f}")
print()
print("Инерционная формула:")
print(f"  Средняя цена: {avg_inertia:.2f}")
print(f"  Разброс цен: от {min_inertia:.2f} до {max_inertia:.2f}")


# ИСПРАВИТЬ ВЛИЯНИЕ ПОГОДНЫХ УСЛОВИЙ НА КАМЕНЬ И ДЕРЕВО
# 
