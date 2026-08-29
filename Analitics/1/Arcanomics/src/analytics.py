import pandas as pd
import numpy as np
from pathlib import Path

# Настройка путей проекта
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"

def run_full_analytics():
    price_file = DATA_DIR / "price_history.csv"
    log_file = DATA_DIR / "simulation_log.csv"
    
    if not price_file.exists() or not log_file.exists():
        print("❌ Ошибка: Файлы price_history.csv или simulation_log.csv не найдены в папке data/")
        print("💡 Запустите симуляцию в браузере до конца, скачайте CSV и положите их в папку data/.")
        return

    print("📊 --- ЗАПУСК КОМПЛЕКСНОЙ АНАЛИТИКИ ЭКОНОМИКИ --- \n")

    # Читаем данные (с учетом разделителя ';' из вашего js-кода выгрузки)
    df_prices = pd.read_csv(price_file, sep=";")
    df_log = pd.read_csv(log_file, sep=";")

    # --- 1. ВОЛАТИЛЬНОСТЬ ЦЕН ---
    # Вычисляем коэффициент вариации (стандартное отклонение / среднее значение)
    for product, col in [("Commodity A", "bread"), ("Commodity B", "wood"), ("Commodity C", "stone")]:
        mean_p = df_prices[col].mean()
        std_p = df_prices[col].std()
        volatility = (std_p / mean_p) * 100 if mean_p > 0 else 0
        print(f"📈 Price volatility [{product}]: {volatility:.2f}% (Average price: {mean_p:.1f} units)")
    print("-" * 50)

    # --- 2. STOCKOUT RATE & ROUTE SUMMARY ---
    high_bread_days = (df_prices["bread"] > 40).sum()
    starvation_share = (high_bread_days / len(df_prices)) * 100
    print(f"🚨 Share of days with critical Commodity A shortfall (empty stock): {starvation_share:.1f}%")
    print("-" * 50)

    # --- 3. ВРЕМЯ ВОССТАНОВЛЕНИЯ ПОСЛЕ ПОГОДНЫХ СОБЫТИЙ ---
    # Ищем дни, когда экстремальное событие закончилось, и замеряем, за сколько дней цена возвращается к норме
    recovery_times = []
    in_event = False
    event_end_day = -1
    base_bread_normal = df_prices["bread"].median() # Принимаем медиану за норму

    for idx, row in df_prices.iterrows():
        current_event = str(row["event"]).lower()
        is_extreme = "ясно" not in current_event and "благоприятный" not in current_event and "нет" not in current_event
        
        if is_extreme:
            in_event = True
        elif in_event and not is_extreme:
            # Событие только что закончилось
            in_event = False
            event_end_day = row["day"]
            
        if event_end_day != -1 and row["day"] >= event_end_day:
            # Проверяем, вернулась ли цена к норме (в коридор +/- 15% от медианы)
            if abs(row["bread"] - base_bread_normal) / base_bread_normal < 0.15:
                days_to_recover = row["day"] - event_end_day
                recovery_times.append(days_to_recover)
                event_end_day = -1 # Сбрасываем триггер

    if recovery_times:
        avg_recovery = np.mean(recovery_times)
        print(f"⏱️ Среднее время восстановления рынка после непогоды: {avg_recovery:.1f} дней")
    else:
        print("⏱️ Среднее время восстановления рынка: Стабильно (критических скачков не зафиксировано)")
    print("-" * 50)

    # --- 4. АНАЛИЗ МАРШРУТОВ И ПЕРЕВОЗОК ---
    routes_file = DATA_DIR / "routes_history.csv"
    if routes_file.exists():
        df_routes = pd.read_csv(routes_file, sep=";")
        # Группируем по дорогам, чтобы взять финальные показатели на конец симуляции
        df_last_routes = df_routes.groupby("road").last().reset_index()
        
        total_caravans = df_last_routes["trip_count"].sum()
        avg_route_profit = df_last_routes["total_profit"].mean()
        
        print(f"🚚 Всего торговых перевозок совершено: {int(total_caravans)} рейсов")
        print(f"💰 Средняя общая прибыль одного маршрута: {avg_route_profit:.2f} руб.")
        print("\n🏆 Топ-3 самых прибыльных торговых путей:")
        top_routes = df_last_routes.sort_values(by="total_profit", ascending=False).head(3)
        for _, r in top_routes.iterrows():
            print(f" • {r['road']}: {r['total_profit']:.1f} руб. за {int(r['trip_count'])} рейсов")
    else:
        print("🚚 Данные по routes_history.csv еще не добавлены в папку data/.")
    print("\n🏁 --- АНАЛИЗ ЗАВЕРШЕН ---")

if __name__ == "__main__":
    run_full_analytics()
