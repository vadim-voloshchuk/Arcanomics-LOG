"""Render the graph into the self-contained interactive HTML page with full auto-responsive layout."""

import json
import math
from pathlib import Path
from typing import Any
from pyvis.network import Network

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = PROJECT_ROOT / "src"
OUTPUT_FILE = PROJECT_ROOT / "interactive_simulation_map.html"
SCRIPT_FILES = ("init.js", "weather.js", "economy.js", "logistics.js", "simulation.js")

def _load_simulation_scripts() -> str:
    return "\n\n".join((SOURCE_DIR / name).read_text(encoding="utf-8") for name in SCRIPT_FILES)

def generate_html(net: Network, roads_data_for_js: list[dict[str, Any]]) -> None:
    net.write_html(str(OUTPUT_FILE))

    script = _load_simulation_scripts()
    script = script.replace("__ROAD_DATA__", json.dumps(roads_data_for_js, ensure_ascii=False))

    with (PROJECT_ROOT / "data" / "goods.json").open(encoding="utf-8") as source:
        script = script.replace("__GOODS_DATA__", json.dumps(json.load(source), ensure_ascii=False))

    # --- ИНТЕГРАЦИЯ ИСТОРИЧЕСКОЙ ПОГОДЫ ДЛЯ ВСЕХ РЕГИОНОВ ---
    regions_list = ["rostov", "texas", "tokyo", "bavaria"]
    all_weather_data = {}

    for r_name in regions_list:
        weather_rows = []
        csv_path = PROJECT_ROOT / "data" / "weather_history" / f"{r_name}.csv"
        
        if csv_path.exists():
            try:
                with open(csv_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                
                data_start_idx = -1
                for idx, line in enumerate(lines):
                    clean_line = line.lower()
                    if "time" in clean_line and ("temp" in clean_line or "rain" in clean_line):
                        data_start_idx = idx
                        break
                
                if data_start_idx != -1:
                    headers = [h.strip().replace('"', '') for h in lines[data_start_idx].split(",")]
                    idx_temp = next((i for i, h in enumerate(headers) if "temperature" in h or "temp" in h), -1)
                    idx_rain = next((i for i, h in enumerate(headers) if "rain" in h), -1)
                    idx_snow = next((i for i, h in enumerate(headers) if "snow" in h), -1)
                    idx_wind = next((i for i, h in enumerate(headers) if "wind_speed" in h or "wind" in h), -1)

                    for line in lines[data_start_idx + 1:]:
                        if not line.strip() or line.startswith("#"):
                            continue
                        parts = [p.strip().replace('"', '') for p in line.split(",")]
                        if len(parts) >= len(headers):
                            try:
                                weather_rows.append({
                                    "temp": float(parts[idx_temp]) if idx_temp != -1 else 15.0,
                                    "rain": float(parts[idx_rain]) if idx_rain != -1 else 0.0,
                                    "snow": float(parts[idx_snow]) if idx_snow != -1 else 0.0,
                                    "wind": float(parts[idx_wind]) if idx_wind != -1 else 10.0
                                })
                            except ValueError:
                                continue
            except Exception as e:
                pass
        
        # Резервный пул, если файл региона не найден
        if not weather_rows:
            weather_rows = [{"temp": 12.0 + (i % 10), "rain": 0.0, "snow": 0.0, "wind": 15.0} for i in range(1000)]
        
        all_weather_data[r_name] = weather_rows

    script = script.replace("__WEATHER_HISTORY_DATA__", json.dumps(all_weather_data))
    # --- КОНЕЦ ИНТЕГРАЦИИ ПОГОДЫ ---


    # Читаем сырой HTML от PyVis
    html = OUTPUT_FILE.read_text(encoding="utf-8")

    responsive_trigger = """
    <script>
    if (typeof network !== 'undefined') {
        network.on("stabilizationIterationsDone", function () {
            network.setOptions({ physics: false });
            network.fit();
        });
        window.addEventListener('resize', function() {
            network.fit();
        });
    }
    </script>
    """

    combined_scripts = f"{responsive_trigger}\n<script>\n{script}\n</script>\n"
    simulation_controls = """
    <style>
    .simulation-controls {
        position: fixed; top: 12px; left: 12px; z-index: 1000;
        display: flex; align-items: end; gap: 10px; padding: 10px;
        border: 1px solid #555; border-radius: 6px;
        background: rgba(26, 26, 26, 0.92); color: #fff; font: 13px Arial, sans-serif;
    }
    .simulation-controls label { display: flex; flex-direction: column; gap: 4px; }
    .simulation-controls select, .simulation-controls input, .simulation-controls button {
        padding: 4px 6px; border: 1px solid #777; border-radius: 3px;
    }
    .simulation-controls button { cursor: pointer; background: #2ecc71; color: #111; font-weight: bold; }
    .simulation-controls button:disabled { cursor: default; opacity: 0.65; }
    </style>
    <div class="simulation-controls">
        <label>Price model:
            <select id="priceModelSelect">
                <option value="market">Market</option>
                <option value="linear">Linear</option>
                <option value="inertia">Inertia</option>
            </select>
        </label>
        <label>Simulation duration (days):
            <input id="simulationDurationInput" type="number" min="1" max="365" step="1" value="30">
        </label>
        <button id="startSimulationButton" type="button">Start simulation</button>
    </div>
    """
    
    # Ищем закрывающий тег body без привязки к регистру (BODY или body)
    target_tag = "</body>"
    idx = html.lower().rfind(target_tag)
    
    if idx != -1:
        # Врезаем элементы строго ПЕРЕД закрытием body, чтобы DOM-дерево было валидным
        new_html = html[:idx] + f"{simulation_controls}{combined_scripts}" + html[idx:]
        OUTPUT_FILE.write_text(new_html, encoding="utf-8")
        print("📈 Адаптивная верстка под экраны успешно интегрирована в DOM.")
    else:
        # Если pyvis вообще убрал тег, делаем безопасную автозамену строки
        if "</html" in html.lower():
            html_parts = html.lower().split("</html>")
            new_html = html[:len(html_parts[0])] + f"{simulation_controls}{combined_scripts}\n</html>"
            OUTPUT_FILE.write_text(new_html, encoding="utf-8")
            print("📈 Скрипты внедрены перед закрытием HTML.")
        else:
            OUTPUT_FILE.write_text(html + f"\n{simulation_controls}{combined_scripts}", encoding="utf-8")
            print("⚠️ Скрипты дописаны в конец файла.")
