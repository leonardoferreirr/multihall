#!/usr/bin/env python3
"""Converte as imagens geradas (PNG) para webp em 900 e 1600 px de largura.

    python3 tools/fotos.py            # converte o que existir, pula o que já está em dia
    python3 tools/fotos.py --forcar   # reconverte tudo

Pode rodar quantas vezes quiser: só converte quando o PNG de origem é mais novo que o
webp, e avisa o que ainda não chegou. A lista de imagens do site mora aqui (FOTOS):
o build.py importa daqui o nome do arquivo e o texto alternativo.
"""
import sys
from pathlib import Path

ORIGEM = Path.home() / "dev/_massuo-imagens/geradas"
DESTINO = Path(__file__).resolve().parent.parent / "assets/img"
LARGURAS = (900, 1600)
QUALIDADE = 82

# base no site -> (arquivo em ORIGEM, texto alternativo)
FOTOS = {
    "steel": ("mh-steel.png", "Estrutura de uma casa em steel frame, com perfis de aço galvanizado montados e placas OSB empilhadas no canteiro"),
    "telhado": ("mh-telhado.png", "Instalador fixando telhas shingle sobre a base de OSB de um telhado"),
    "drywall": ("mh-drywall.png", "Instalador parafusando chapa de drywall em uma parede com perfis de aço e lã de vidro"),
    "forro": ("mh-forro.png", "Instalador encaixando uma placa de forro removível em um escritório"),
    "fachada": ("mh-fachada.png", "Fachada de uma loja Multihall"),
    "cd": ("mh-cd.png", "Centro de distribuição da Multihall com material de construção a seco em paletes"),
    "entrega": ("mh-entrega.png", "Caminhão da Multihall descarregando material de construção a seco em uma obra"),
    "equipe": ("mh-equipe.png", "Equipe da Multihall de uniforme e capacete em uma obra"),
    "capacete": ("mh-capacete.png", "Capacete da Multihall sobre um projeto de construção a seco"),
    "empreendimento": ("mh-empreendimento.png", "Conjunto de casas em steel frame de um empreendimento em construção"),
    "homeoffice": ("mh-homeoffice.png", "Notebook com a marca Multihall em um escritório em casa"),
}


def converter(forcar=False):
    from PIL import Image
    DESTINO.mkdir(parents=True, exist_ok=True)
    faltam, feitas, em_dia = [], [], []
    for base, (arquivo, _alt) in FOTOS.items():
        origem = ORIGEM / arquivo
        if not origem.exists():
            faltam.append(arquivo)
            continue
        alvos = [DESTINO / f"{base}-{w}.webp" for w in LARGURAS]
        if not forcar and all(a.exists() and a.stat().st_mtime >= origem.stat().st_mtime for a in alvos):
            em_dia.append(base)
            continue
        with Image.open(origem) as im:
            im = im.convert("RGB")
            for w, alvo in zip(LARGURAS, alvos):
                c = im.copy()
                if c.width > w:
                    c.thumbnail((w, w * 10), Image.LANCZOS)
                c.save(alvo, "WEBP", quality=QUALIDADE, method=6)
        feitas.append(base)
    if feitas:
        print("convertidas:", ", ".join(feitas))
    if em_dia:
        print("em dia:", ", ".join(em_dia))
    if faltam:
        print("ainda não chegaram:", ", ".join(faltam))
    return faltam


if __name__ == "__main__":
    converter("--forcar" in sys.argv)
