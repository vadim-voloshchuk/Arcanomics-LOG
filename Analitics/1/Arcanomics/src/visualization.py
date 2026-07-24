"""Render the graph into the self-contained interactive HTML page with full auto-responsive layout."""

import json
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
    """Write the graph HTML and append responsive canvas rules alongside simulation scripts."""
    net.write_html(str(OUTPUT_FILE))

    script = _load_simulation_scripts()
    script = script.replace("__ROAD_DATA__", json.dumps(roads_data_for_js, ensure_ascii=False))

    with (PROJECT_ROOT / "data" / "goods.json").open(encoding="utf-8") as source:
        script = script.replace("__GOODS_DATA__", json.dumps(json.load(source), ensure_ascii=False))

    html = OUTPUT_FILE.read_text(encoding="utf-8")

    # Скрипт автоматической адаптации контейнера под Fullscreen и любые изменения окна
    responsive_trigger = """
    <script>
    // Замораживаем физику после стабилизации, чтобы узлы не улетали при клике
    network.on("stabilizationIterationsDone", function () {
        network.setOptions({ physics: false });
        network.fit(); // Автоматически подгоняет масштаб графа под текущий размер экрана
    });
    
    // Перерасчет масштаба при изменении размеров окна / входе в полноэкранный режим
    window.addEventListener('resize', function() {
        if (typeof network !== 'undefined') {
            network.fit();
        }
    });
    </script>
    """

    # Объединяем разметку, логику симуляции и адаптивный триггер интерфейса
    combined_scripts = f"{responsive_trigger}\n<script>\n{script}\n</script>\n"
    OUTPUT_FILE.write_text(html.replace("</body>", f"{combined_scripts}</body>"), encoding="utf-8")
    print("📈 Адаптивная верстка под экраны успешно интегрирована.")

