import random


# Начальные параметры


days = 20

base_price = 40
alt = 100

sum_temperature = 0


for day in range(1, days + 1):

    print("=" * 40)
    print(f"День {day}")

    
    # Температура
    

    temperature = random.randint(15, 45)

    
    # Производство
    

    product = random.randint(8, 15)

    event = "Нет"

    
    # Дождь
    

    if random.randint(1, 100) <= 20:

        event = " Дождь"

        temperature -= random.randint(3, 7)

        if temperature < 10:
            temperature = 10

        product += random.randint(3, 7)

    
    # Засуха
    

    if temperature >= 35:

        event = " Засуха"

        product -= random.randint(3, 7)

        if product < 1:
            product = 1

    
    # Покупки
    

    buy = random.randint(8, 15)

    
    # Обновление склада
    

    alt += product
    alt -= buy

    if alt < 0:
        alt = 0

    
    # Спрос и предложение
    

    demand = buy
    supply = product + alt

    
    # Цена
    

    price = base_price * (demand / supply)

    if price < 1:
        price = 1

    
    # Средняя температура
    

    sum_temperature += temperature

    
    # Вывод
    

    print(f"Температура : {temperature}°C")
    print(f"Событие     : {event}")
    print(f"Производство: {product}")
    print(f"Покупки     : {buy}")
    print(f"Запас       : {alt}")
    print(f"Цена        : {price:.2f}")


# Итоги


average_temperature = sum_temperature / days
print("\n" + "=" * 40)
print("=" * 40)
print(f"Средняя температура: {average_temperature:.2f}°")