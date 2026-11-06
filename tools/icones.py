#!/usr/bin/env python3
"""Gera favicon-32.png (transparente) e apple-touch-icon.png (com fundo)
a partir do símbolo e do nome em SVG (polígonos e traços simples, desenhados com o PIL).

    python3 tools/icones.py
"""
import re
from pathlib import Path
from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
IMG = RAIZ / "assets/img"
MARINHO = (13, 20, 38)
LARANJA = (245, 138, 31)

# viewBox do símbolo: -300 -348.5 1500 1732
VB = (-300.0, -348.5, 1500.0, 1732.0)


def subpaths(svg):
    d = re.search(r' d="([^"]+)"', svg).group(1)
    out = []
    for parte in re.findall(r"M[^M]+", d):
        pts = [(float(x), float(y)) for x, y in re.findall(r"(-?[\d.]+)\s+(-?[\d.]+)", parte)]
        out.append(pts)
    return out


def simbolo(tamanho, fundo=None, margem=0.0):
    """Símbolo em `tamanho` px; fundo None = transparente. margem = fração do lado livre em volta."""
    S = 4  # supersample
    T = tamanho * S
    im = Image.new("RGBA", (T, T), (fundo + (255,)) if fundo else (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    paths = subpaths((IMG / "simbolo.svg").read_text())
    x0, y0, w, h = VB
    livre = T * (1 - 2 * margem)
    esc = livre / max(w, h)
    dx = (T - w * esc) / 2 - x0 * esc
    dy = (T - h * esc) / 2 - y0 * esc
    conv = lambda pts: [(x * esc + dx, y * esc + dy) for x, y in pts]
    anel, hexa, casa = paths
    dr.polygon(conv(anel), fill=LARANJA + (255,))
    dr.polygon(conv(hexa), fill=LARANJA + (255,))
    # a casa é um furo (fill-rule evenodd): volta ao fundo
    furo = (fundo + (255,)) if fundo else (0, 0, 0, 0)
    dr.polygon(conv(casa), fill=furo)
    return im.resize((tamanho, tamanho), Image.LANCZOS)


def main():
    simbolo(32).save(IMG / "favicon-32.png")
    simbolo(180, MARINHO, margem=0.16).save(IMG / "apple-touch-icon.png")
    print("favicon-32.png, apple-touch-icon.png (a og-image.jpg sai do tools/poster.py)")


if __name__ == "__main__":
    main()
