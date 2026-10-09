"""Rebuild a pinless dotted world map: keep continent dots, drop all pin markers."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

SRC = Path(
    r"C:\Users\devil\.cursor\projects\d-code-shopify-theme\assets"
    r"\c__Users_devil_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"86a6705cab1afb2b3163943f8e297715_images_image-dace25a3-0b67-4ee0-a678-e30d968512f6.png"
)
OUT = Path(__file__).resolve().parents[1] / "assets" / "vectra-story-map-base.png"


def is_blue_pin(r: int, g: int, b: int) -> bool:
    return b >= 115 and b > r + 18 and b > g + 4 and (b - min(r, g)) >= 14


def is_dot(r: int, g: int, b: int) -> bool:
    luma = (r * 299 + g * 587 + b * 114) / 1000
    chroma = max(r, g, b) - min(r, g, b)
    return luma <= 170 and chroma <= 30 and not is_blue_pin(r, g, b)


def is_background(r: int, g: int, b: int) -> bool:
    return min(r, g, b) >= 248


def is_pin_paint(r: int, g: int, b: int) -> bool:
    # Anything that is not background and not a continent dot is pin artwork.
    return (not is_background(r, g, b)) and (not is_dot(r, g, b))


def main() -> None:
    src = Image.open(SRC).convert("RGB")
    w, h = src.size
    print(f"source size={w}x{h}")
    px = src.load()

    out = Image.new("RGB", (w, h), (255, 255, 255))
    op = out.load()

    # Keep only continent dots; discard blue pins, ghost pins, glows, etc.
    kept = 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if is_dot(r, g, b):
                op[x, y] = (r, g, b)
                kept += 1
            else:
                op[x, y] = (255, 255, 255)

    # Restore soft anti-aliased ring around dots from source when neighbor is a dot
    # (improves visual density without bringing pins back).
    soft = 0
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b = px[x, y]
            if is_background(r, g, b) or is_dot(r, g, b) or is_blue_pin(r, g, b):
                continue
            luma = (r * 299 + g * 587 + b * 114) / 1000
            chroma = max(r, g, b) - min(r, g, b)
            if luma > 210 or chroma > 22:
                continue
            # Only keep soft gray if adjacent to a kept dot
            near_dot = False
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nr, ng, nb = op[x + dx, y + dy]
                    if is_dot(nr, ng, nb):
                        near_dot = True
                        break
                if near_dot:
                    break
            if near_dot:
                op[x, y] = (r, g, b)
                soft += 1

    out.save(OUT, "PNG", optimize=True)
    print(f"kept_dots={kept} soft={soft} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
