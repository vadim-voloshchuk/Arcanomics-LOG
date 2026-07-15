"""Build the static city and road map used by the simulation."""

import json
from pathlib import Path
from typing import Any

import networkx as nx
from pyvis.network import Network


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"


def _load_json(name: str) -> Any:
    with (DATA_DIR / name).open(encoding="utf-8") as source:
        return json.load(source)


def create_graph() -> tuple[Network, list[dict[str, Any]]]:
    """Create the visual graph and the road payload consumed by JavaScript."""
    cities = _load_json("cities.json")
    connections = _load_json("roads.json")
    graph = nx.Graph()

    for connection in connections:
        graph.add_edge(connection["u"], connection["v"], routes=connection["routes"])

    net = Network(height="800px", width="100%", bgcolor="#1a1a1a", font_color="white")

    for node in graph.nodes:
        city = cities[node]
        net.add_node(
            node,
            label=node,
            title="",
            size=city["size"],
            color=city["color"],
            x=city["x"],
            y=city["y"],
            physics=False,
        )

    roads_data_for_js = []
    for index, (source, target, data) in enumerate(graph.edges(data=True)):
        edge_id = f"edge_{index}"
        roads_data_for_js.append({"id": edge_id, "u": source, "v": target, "routes": data["routes"]})
        net.add_edge(
            source,
            target,
            id=edge_id,
            color="#777777",
            width=2,
            label="Расчет...",
            title="Загрузка...",
            font={"size": 13, "color": "#ffffff", "align": "top"},
        )

    net.toggle_physics(False)
    net.set_options('{"interaction": {"hover": true, "tooltipDelay": 10}}')
    return net, roads_data_for_js
