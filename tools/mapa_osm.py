#!/usr/bin/env python3
"""Desenha as ruas de Alphaville (OpenStreetMap) em SVG para o mapa da Multihall.

Lê tools/osm-alphaville.json (Overpass, `out geom`, recorte centrado na unidade) e
devolve o miolo do SVG em viewBox 0 0 600 600, com a unidade no centro (300,300).
Dados © OpenStreetMap contributors (ODbL): o crédito fica embaixo da prancha.
"""
import json, math
from pathlib import Path

ARQ = Path(__file__).with_name("osm-alphaville.json")
SEDE = (-23.5013158, -46.8483703)      # Alameda Rio Negro, 503 (OpenStreetMap)
MEIO_LAT, MEIO_LON = 0.0105, 0.0115     # meia altura e meia largura do recorte
X0, X1 = 20, 580                        # quadro útil da prancha

MAIORES = {"motorway", "trunk", "primary", "secondary"}
RODOVIA = {"motorway"}


def proj(lat, lon):
    x = X0 + (lon - (SEDE[1] - MEIO_LON)) / (2 * MEIO_LON) * (X1 - X0)
    y = X0 + ((SEDE[0] + MEIO_LAT) - lat) / (2 * MEIO_LAT) * (X1 - X0)
    return x, y


def rdp(pts, eps):
    """Douglas-Peucker: tira pontos que não mudam o desenho."""
    if len(pts) < 3:
        return pts
    (ax, ay), (bx, by) = pts[0], pts[-1]
    dx, dy = bx - ax, by - ay
    n = math.hypot(dx, dy) or 1e-9
    i, dmax = 0, 0.0
    for k in range(1, len(pts) - 1):
        px, py = pts[k]
        d = abs(dy * px - dx * py + bx * ay - by * ax) / n
        if d > dmax:
            i, dmax = k, d
    if dmax <= eps:
        return [pts[0], pts[-1]]
    return rdp(pts[:i + 1], eps)[:-1] + rdp(pts[i:], eps)


def caminho(pts):
    out, px, py = [], None, None
    for k, (x, y) in enumerate(pts):
        x, y = round(x, 1), round(y, 1)
        if k == 0:
            out.append(f"M{x:g} {y:g}")
        else:
            out.append(f"l{round(x - px, 1):g} {round(y - py, 1):g}")
        px, py = x, y
    return "".join(out)


def angulo(pts):
    (ax, ay), (bx, by) = pts[0], pts[-1]
    a = math.degrees(math.atan2(by - ay, bx - ax))
    if a > 90: a -= 180
    if a < -90: a += 180
    return round(a, 1)


def mapa():
    els = json.loads(ARQ.read_text())["elements"]
    grupos = {"min": [], "maj": [], "rod": [], "agua": [], "sede": []}
    rotulos = {}
    for e in els:
        g = e.get("geometry")
        if not g:
            continue
        t = e.get("tags", {})
        pts = rdp([proj(p["lat"], p["lon"]) for p in g], 0.7)
        if len(pts) < 2:
            continue
        hw, nome = t.get("highway"), t.get("name", "")
        if t.get("waterway") or t.get("natural") == "water":
            grupos["agua"].append(caminho(pts))
        elif nome == "Alameda Rio Negro":
            grupos["sede"].append(caminho(pts))
            rotulos.setdefault("rua", []).append(pts)
        elif hw in RODOVIA:
            grupos["rod"].append(caminho(pts))
            rotulos.setdefault("castello", []).append(pts)
        elif hw in MAIORES:
            grupos["maj"].append(caminho(pts))
        else:
            grupos["min"].append(caminho(pts))

    def rotulo(chave, texto, alvo=(300, 300), dist_min=60, folga=6):
        """Põe o nome no trecho mais longo perto do alvo, girado junto com a rua."""
        melhor = None
        for pts in rotulos.get(chave, []):
            for a, b in zip(pts, pts[1:]):
                L = math.hypot(b[0] - a[0], b[1] - a[1])
                mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
                if not (60 < mx < 540 and 60 < my < 540):
                    continue
                d = math.hypot(mx - alvo[0], my - alvo[1])
                if L < 70 or d < dist_min:
                    continue
                nota = L - d * 0.4
                if melhor is None or nota > melhor[0]:
                    melhor = (nota, mx, my, angulo([a, b]))
        if not melhor:
            return ""
        _, x, y, ang = melhor
        return (f'<text class="m-txt m-rua" x="{x:.0f}" y="{y - folga:.0f}" text-anchor="middle" '
                f'transform="rotate({ang} {x:.0f} {y:.0f})">{texto}</text>')

    p = lambda cls, ds, extra="": f'<path class="{cls}" d="{"".join(ds)}"{extra}/>' if ds else ""
    corpo = (
        '<g clip-path="url(#quadro)">'
        + p("mp mp-agua", grupos["agua"])
        + p("mp mp-min", grupos["min"])
        + p("mp mp-maj", grupos["maj"], ' pathLength="1"')
        + p("mp mp-rod", grupos["rod"], ' pathLength="1"')
        + p("mp mp-sede", grupos["sede"], ' pathLength="1"')
        + rotulo("castello", "ROD. CASTELLO BRANCO", dist_min=90, folga=22)
        + rotulo("rua", "AL. RIO NEGRO", dist_min=40, folga=9)
        + "</g>"
    )
    return corpo


if __name__ == "__main__":
    s = mapa()
    print(len(s), "bytes")
