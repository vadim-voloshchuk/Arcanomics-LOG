"""Application entry point."""

from src.graph import create_graph
from src.visualization import generate_html


def main() -> None:
    net, roads_data_for_js = create_graph()
    generate_html(net, roads_data_for_js)
    print("✅ Карта успешно создана.")


if __name__ == "__main__":
    main()
