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
    net.write_html(str(OUTPUT_FILE))

    script = _load_simulation_scripts()
    script = script.replace("__ROAD_DATA__", json.dumps(roads_data_for_js, ensure_ascii=False))

    with (PROJECT_ROOT / "data" / "goods.json").open(encoding="utf-8") as source:
        script = script.replace("__GOODS_DATA__", json.dumps(json.load(source), ensure_ascii=False))

    regions_list = ["region_d", "region_b", "region_a", "region_c"]
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
                    headers = [h.strip().replace('"', "") for h in lines[data_start_idx].split(",")]
                    idx_temp = next((i for i, h in enumerate(headers) if "temperature" in h or "temp" in h), -1)
                    idx_rain = next((i for i, h in enumerate(headers) if "rain" in h), -1)
                    idx_snow = next((i for i, h in enumerate(headers) if "snow" in h), -1)
                    idx_wind = next((i for i, h in enumerate(headers) if "wind_speed" in h or "wind" in h), -1)

                    for line in lines[data_start_idx + 1:]:
                        if not line.strip() or line.startswith("#"):
                            continue
                        parts = [p.strip().replace('"', "") for p in line.split(",")]
                        if len(parts) >= len(headers):
                            try:
                                weather_rows.append({
                                    "temp": float(parts[idx_temp]) if idx_temp != -1 else 15.0,
                                    "rain": float(parts[idx_rain]) if idx_rain != -1 else 0.0,
                                    "snow": float(parts[idx_snow]) if idx_snow != -1 else 0.0,
                                    "wind": float(parts[idx_wind]) if idx_wind != -1 else 10.0,
                                })
                            except ValueError:
                                continue
            except Exception:
                pass

        if not weather_rows:
            weather_rows = [{"temp": 12.0 + (i % 10), "rain": 0.0, "snow": 0.0, "wind": 15.0} for i in range(1000)]

        all_weather_data[r_name] = weather_rows

    script = script.replace("__WEATHER_HISTORY_DATA__", json.dumps(all_weather_data))

    html = OUTPUT_FILE.read_text(encoding="utf-8")

    responsive_trigger = """
    <script>
    if (typeof network !== 'undefined') {
        network.on("stabilizationIterationsDone", function () {
            network.setOptions({ physics: { enabled: false } });
            network.fit({ animation: false });
        });
        window.addEventListener('resize', function() {
            network.fit({ animation: false });
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
    .region-selector-panel {
        position: fixed; top: 12px; right: 12px; z-index: 1000;
        width: 240px; max-width: calc(100vw - 24px);
        padding: 10px; border: 1px solid #555; border-radius: 6px;
        background: rgba(26, 26, 26, 0.92); color: #fff; font: 13px Arial, sans-serif;
    }
    .region-selector-panel h4 { margin: 0 0 8px; font-size: 13px; }
    .region-selector-options { display: grid; gap: 6px; max-height: 220px; overflow-y: auto; }
    .region-selector-item { display: flex; align-items: center; gap: 6px; }
    .region-selector-actions { display: flex; gap: 8px; margin-top: 8px; }
    .region-selector-actions button {
        padding: 4px 6px; border: 1px solid #777; border-radius: 3px; cursor: pointer; background: #3498db; color: white;
    }
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
        <button id="pauseSimulationButton" type="button" disabled>Pause</button>
        <button id="resumeSimulationButton" type="button" disabled>Resume</button>
    </div>
    <div class="region-selector-panel">
        <h4>Выбор регионов</h4>
        <div id="region-selector-options" class="region-selector-options"></div>
        <div class="region-selector-actions">
            <button id="region-selector-apply" type="button">Применить</button>
            <button id="region-selector-reset" type="button">Все</button>
        </div>
    </div>
    """

    region_filter_script = """
    <script>
    (function () {
        if (typeof network === 'undefined') return;

        var nodeData = network.body.data.nodes;
        var edgeData = network.body.data.edges;
        var optionsContainer = document.getElementById('region-selector-options');
        var applyButton = document.getElementById('region-selector-apply');
        var resetButton = document.getElementById('region-selector-reset');
        if (!optionsContainer || !applyButton || !resetButton) return;

        var nodes = nodeData.get();
        var regions = Array.from(new Map(nodes.map(function (node) {
            var key = node.region || '';
            var label = node.display_region || node.region || 'Регион';
            return [key, { key: key, label: label }];
        }).filter(function (item) {
            return item[0];
        })).values());

        regions.sort(function (a, b) {
            return a.label.localeCompare(b.label);
        });

        optionsContainer.innerHTML = regions.map(function (region) {
            return '<label class="region-selector-item"><input type="checkbox" value="' + region.key + '" checked><span>' + region.label + '</span></label>';
        }).join('');

        function applySelection() {
            var selectedKeys = new Set(Array.from(optionsContainer.querySelectorAll('input:checked')).map(function (input) {
                return input.value;
            }));

            var visibleNodeIds = new Set();
            nodes.forEach(function (node) {
                var shouldShow = selectedKeys.size === 0 || selectedKeys.has(node.region || '');
                if (shouldShow) visibleNodeIds.add(node.id);
            });

            var nodeUpdates = nodes.map(function (node) {
                return { id: node.id, hidden: !visibleNodeIds.has(node.id) };
            });

            var edgeUpdates = edgeData.get().map(function (edge) {
                var shouldShow = visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to);
                return { id: edge.id, hidden: !shouldShow };
            });

            nodeData.update(nodeUpdates);
            edgeData.update(edgeUpdates);
            network.redraw();
            network.fit();
        }

        applyButton.addEventListener('click', applySelection);
        resetButton.addEventListener('click', function () {
            optionsContainer.querySelectorAll('input').forEach(function (input) {
                input.checked = true;
            });
            applySelection();
        });

        applySelection();
    })();
    </script>
    """

    target_tag = "</body>"
    idx = html.lower().rfind(target_tag)

    if idx != -1:
        new_html = html[:idx] + f"{simulation_controls}{combined_scripts}{region_filter_script}" + html[idx:]
        OUTPUT_FILE.write_text(new_html, encoding="utf-8")
        print("📈 Адаптивная верстка под экраны успешно интегрирована в DOM.")
    else:
        if "</html" in html.lower():
            html_parts = html.lower().split("</html>")
            new_html = html[:len(html_parts[0])] + f"{simulation_controls}{combined_scripts}{region_filter_script}\n</html>"
            OUTPUT_FILE.write_text(new_html, encoding="utf-8")
            print("📈 Скрипты внедрены перед закрытием HTML.")
        else:
            OUTPUT_FILE.write_text(html + f"\n{simulation_controls}{combined_scripts}{region_filter_script}", encoding="utf-8")
            print("⚠️ Скрипты дописаны в конец файла.")
