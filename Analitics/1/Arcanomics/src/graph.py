import json
import math
from pathlib import Path
from typing import Any

import networkx as nx
from pyvis.network import Network

current_dir = Path(__file__).resolve().parent
PROJECT_ROOT = current_dir
while PROJECT_ROOT.name and PROJECT_ROOT.name != "Arcanomics" and PROJECT_ROOT.parent != PROJECT_ROOT:
    PROJECT_ROOT = PROJECT_ROOT.parent

DATA_DIR = PROJECT_ROOT / "data" if (PROJECT_ROOT / "data").exists() else current_dir.parent / "data"

DEFAULT_REGION_ORDER = ["region_a", "region_b", "region_c", "region_d"]
REGION_DISPLAY_NAMES = {
    "region_a": "Region A",
    "region_b": "Region B",
    "region_c": "Region C",
    "region_d": "Region D",
}


def normalize_region_key(region_name: str) -> str:
    """Normalize user-facing region names to canonical internal keys."""
    return region_name.strip().lower()


def get_region_display_name(region_name: str) -> str:
    """Return a neutral display label for the region."""
    key = normalize_region_key(region_name)
    return REGION_DISPLAY_NAMES.get(key, f"Region {key or '1'}")


def get_region_cities(region_name: str, max_cities: int = 5) -> list[dict]:
    """Ищет один конкретный регион в cities.json или делает процедурный откат."""
    key = normalize_region_key(region_name)
    cities_file = DATA_DIR / "cities.json"

    if cities_file.exists():
        try:
            with open(cities_file, "r", encoding="utf-8") as f:
                db = json.load(f)
                if key in db:
                    return db[key][:max_cities]
        except Exception as e:
            print(f"⚠️ Ошибка чтения cities.json: {e}")

    seed = sum(ord(char) for char in key)
    base_lat, base_lon = 30.0 + (seed % 25), -20.0 + (seed % 100)

    procedural_cities = []
    names_pool = ["Hub", "Node", "Cluster", "Relay", "Outpost"]
    display_label = get_region_display_name(key)
    for i in range(min(max_cities, len(names_pool))):
        offset_lat = math.sin(i * 45) * 0.4
        offset_lon = math.cos(i * 45) * 0.6
        pop = 500000 if i == 0 else math.floor(30000 + (200000 * ((seed + i) % 100 / 100)))
        procedural_cities.append({
            "name": f"{display_label} · {names_pool[i]} {i + 1}",
            "lat": base_lat + offset_lat,
            "lon": base_lon + offset_lon,
            "population": pop,
            "display_region": display_label,
        })
    return procedural_cities


def calculate_distance(lat1, lon1, lat2, lon2):
    """Вычисление расстояния между точками по формуле гаверсинусов (в км)."""
    R = 6371
    d_lat, d_lon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    return round(R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))), 1)


def create_graph(selected_regions: list[str] | None = None) -> tuple[Network, list[dict[str, Any]]]:
    raw_regions = [part for part in (selected_regions or []) if part and str(part).strip()]
    region_parts: list[str] = []
    for part in raw_regions:
        canonical = normalize_region_key(part)
        if canonical and canonical not in region_parts:
            region_parts.append(canonical)

    if not region_parts:
        region_parts = DEFAULT_REGION_ORDER.copy()

    graph = nx.Graph()
    net = Network(height="98vh", width="100%", bgcolor="#1a1a1a", font_color="white")
    roads_json_data = []

    regional_capitals = []
    all_compiled_cities = []

    # Шаг 1: Собираем список городов
    for part in region_parts:
        cities = get_region_cities(part)
        if not cities:
            continue

        capital = max(cities, key=lambda c: c["population"])
        regional_capitals.append(capital["name"])

        for c in cities:
            c["region_part"] = part
            c["display_region"] = c.get("display_region", get_region_display_name(part))
            c["is_capital"] = (c["name"] == capital["name"])
            all_compiled_cities.append(c)

    if not all_compiled_cities:
        print("❌ Не удалось загрузить ни одного города.")
        return net, []

    # Шаг 2: Добавляем города с масштабированием географических координат под экран
    for c in all_compiled_cities:
        graph.add_node(c["name"], population=c["population"], lat=c["lat"], lon=c["lon"], region=c["region_part"])

        region_key = c["region_part"].lower()
        if "region_a" in region_key:
            x_coord = (c["lon"] - 139.70) * 8000
            y_coord = (c["lat"] - 35.65) * -8000
        elif "region_b" in region_key:
            x_coord = (c["lon"] + 97.0) * 150
            y_coord = (c["lat"] - 31.0) * -150
        elif "region_c" in region_key:
            x_coord = (c["lon"] - 11.0) * 400
            y_coord = (c["lat"] - 48.5) * -400
        else:
            x_coord = (c["lon"] - 39.0) * 600
            y_coord = (c["lat"] - 47.0) * -600

        # Add a small deterministic jitter so cities in the same region don't overlap into a single dot.
        # The jitter is deterministic (based on city name) to keep layout stable across runs.
        SPREAD_PX = 40.0  # maximum pixel offset in either axis
        name_hash = sum((ord(ch) for ch in c["name"]))
        jitter_x = ((name_hash % 201) - 100) / 100.0 * SPREAD_PX
        jitter_y = (((name_hash // 201) % 201) - 100) / 100.0 * SPREAD_PX
        # Reduce jitter for regional capitals so they remain visually central
        if c.get("is_capital"):
            jitter_x *= 0.4
            jitter_y *= 0.4

        x_coord = x_coord + jitter_x
        y_coord = y_coord + jitter_y

        net.add_node(
            c["name"],
            label=c["name"],
            title="",
            x=x_coord,
            y=y_coord,
            size=38 if c["is_capital"] else (26 if c["population"] > 500000 else 20),
            color={
                "background": "#f1c40f" if c["is_capital"] else ("#3498db" if c["population"] > 500000 else "#2ecc71"),
                "border": "#ffffff",
                "highlight": {
                    "background": "#ffed8a" if c["is_capital"] else "#6bc5ff",
                    "border": "#ffffff",
                },
            },
            font={"size": 14, "color": "#ffffff", "face": "Arial"},
            shape="dot",
            borderWidth=1,
            population_base=c["population"],
            region=c["region_part"].lower().strip(),
            display_region=c.get("display_region", get_region_display_name(c["region_part"])),
        )

    # Шаг 3: Строим внутренние дороги регионов
    for part in region_parts:
        region_cities = [c for c in all_compiled_cities if c["region_part"] == part]
        for i, u_data in enumerate(region_cities):
            distances = []
            for j, v_data in enumerate(region_cities):
                if i == j:
                    continue
                dist = calculate_distance(u_data["lat"], u_data["lon"], v_data["lat"], v_data["lon"])
                distances.append((dist, v_data["name"]))

            distances.sort(key=lambda x: x)
            for dist, target_city in distances[:2]:
                if not graph.has_edge(u_data["name"], target_city):
                    routes = [{"name": f"Route {u_data['name']} ↔ {target_city}", "dist": dist, "speed": 90}]
                    graph.add_edge(u_data["name"], target_city, routes=routes)
                    roads_json_data.append({"u": u_data["name"], "v": target_city, "routes": routes})

    # Шаг 4: Строим трансконтинентальные мосты между столицами
    for i in range(len(regional_capitals) - 1):
        hub_a = regional_capitals[i]
        hub_b = regional_capitals[i + 1]
        if not graph.has_edge(hub_a, hub_b):
            adapted_dist = 160.0
            routes = [{"name": f"Regional corridor {hub_a} ↔ {hub_b}", "dist": adapted_dist, "speed": 120}]
            graph.add_edge(hub_a, hub_b, routes=routes)
            roads_json_data.append({"u": hub_a, "v": hub_b, "routes": routes})

    try:
        if DATA_DIR.exists():
            with open(DATA_DIR / "roads.json", "w", encoding="utf-8") as f:
                json.dump(roads_json_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ Предупреждение записи roads.json: {e}")

    roads_data_for_js = []
    for index, (source, target, data) in enumerate(graph.edges(data=True)):
        edge_id = f"edge_{index}"
        roads_data_for_js.append({"id": edge_id, "u": source, "v": target, "routes": data["routes"]})

        is_bridge = source in regional_capitals and target in regional_capitals
        net.add_edge(
            source,
            target,
            id=edge_id,
            color="#3498db" if is_bridge else "#777777",
            width=4 if is_bridge else 2,
            label="Distance",
            title="Connection",
            smooth={"type": "cubicBezier", "roundness": 0.2} if is_bridge else False,
            font={"size": 13, "color": "#ffffff", "align": "top"},
            arrows={"to": {"enabled": False}},
        )

    net.set_options('''{
      "layout": {
        "improvedLayout": true,
        "randomSeed": 42
      },
      "nodes": {
        "shape": "dot",
        "font": {
          "size": 14,
          "face": "Arial",
          "color": "#ffffff"
        },
        "borderWidth": 1,
        "borderWidthSelected": 2
      },
      "edges": {
        "smooth": {
          "type": "continuous",
          "roundness": 0.2
        },
        "arrows": {
          "to": {
            "enabled": false,
            "scaleFactor": 0.4
          }
        },
        "color": {
          "color": "#8aa4b2",
          "highlight": "#ffffff",
          "hover": "#ffffff"
        },
        "width": 2,
        "font": {
          "size": 11,
          "color": "#f2f2f2"
        }
      },
      "physics": {
        "enabled": true,
        "stabilization": {
          "enabled": true,
          "iterations": 180,
          "fit": true
        },
        "solver": "forceAtlas2Based",
        "forceAtlas2Based": {
          "gravitationalConstant": -50,
          "centralGravity": 0.01,
          "springLength": 120,
          "springConstant": 0.03,
          "damping": 0.09,
          "avoidOverlap": 0.5
        },
        "minVelocity": 0.75
      },
      "interaction": {
        "hover": true,
        "tooltipDelay": 10,
        "dragNodes": true,
        "zoomView": true,
        "dragView": true,
        "navigationButtons": true
      }
    }''')

    return net, roads_data_for_js
