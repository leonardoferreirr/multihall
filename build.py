#!/usr/bin/env python3
"""Monta o site da Multihall a partir de _src/ e gera os arquivos da raiz.

    python3 build.py

- Junta head, cabeçalho e rodapé em cada página (index, franquia, obrigado).
- Minifica assets/css/site.css e injeta no <head>.
- Carimba site.js e build3d.js com o hash do conteúdo (o Vercel guarda /assets/ em cache).
- Gera robots.txt, sitemap.xml, llms.txt e o schema (JSON-LD).

Os dados da empresa moram aqui em cima. O que veio do site antigo da Multihall
(multihall.com.br, 2021 a 2025) está marcado com "a confirmar com o Paulo": troque
em um lugar só. O que ainda falta está como [A PREENCHER].
"""
import hashlib, json, re, sys
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).parent
SRC = RAIZ / "_src"
CSS = RAIZ / "assets/css/site.css"
JS = RAIZ / "assets/js/site.js"
B3D = RAIZ / "assets/js/build3d.js"
IMG = RAIZ / "assets/img"
sys.path.insert(0, str(RAIZ / "tools"))
from fotos import FOTOS  # lista única de imagens (arquivo de origem e texto alternativo)

# ---------------------------------------------------------------- empresa
DOMINIO = "https://multihall.vercel.app"   # sem domínio próprio por enquanto; trocar quando o Paulo passar
INDEXAR = False                            # True só quando o domínio estiver ligado na Vercel
VERCEL = "multihall.vercel.app"
WHATSAPP = "5524998593556"                 # só dígitos com DDI, até o Paulo passar outro
GRUPO = "https://massuogroup.vercel.app"
CITYSTEEL = "https://citysteel.vercel.app"
REFORMULI = "https://reformuli.vercel.app"
UNIDADE = ("Multihall Alphaville", "Alameda Rio Negro, 503, Alphaville, Barueri, SP")   # a confirmar com o Paulo: endereço do site antigo
FRANQUIA_MAP = "0.8,1"                     # trecho do 3D usado no topo da /franquia (a unidade fecha e se multiplica)
OG_BASE = DOMINIO if INDEXAR else f"https://{VERCEL}"
ROBOS_IA = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User",
            "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot", "meta-externalagent"]

# ---------------------------------------------------------------- do site antigo da empresa
PRIMEIRA_OBRA = 2009          # a confirmar com o Paulo
ENTREGA_HORAS = 48            # a confirmar com o Paulo (0 esconde o prazo do site inteiro)
SEM_ESTOQUE = True            # a confirmar com o Paulo: o franqueado não estoca, fica por conta da franqueadora
CD_REGIONAL = True            # a confirmar com o Paulo: centro de distribuição regional
# a confirmar com o Paulo: investimento da loja (R$ 90.000 veio do briefing; a composição, do site antigo)
INVESTIMENTO_LOJA = [("Investimento inicial", "R$ 90.000"), ("Taxa de franquia", "R$ 30.000"), ("Implantação", "R$ 30.000"),
                     ("Publicidade", "2,5% do faturamento"), ("Royalties", "sobre a compra do material")]
INVESTIMENTO_HOME = [("Investimento inicial", "R$ 9.000"), ("Taxa de franquia", "[A PREENCHER]"), ("Implantação", "[A PREENCHER]"),
                     ("Publicidade", "[A PREENCHER]"), ("Royalties", "[A PREENCHER]")]
PARA_QUEM = [  # a confirmar com o Paulo
    ("Engenheiro recém-formado", "Começa com a marca, o catálogo e o suporte de quem já entrega."),
    ("Construtor em atividade", "Passa a fornecer o material das próprias obras e das obras da região."),
    ("Investidor", "Entra num mercado em crescimento sem precisar montar estoque."),
    ("Empreendedor", "Abre um negócio com processo pronto e entrega resolvida."),
]
BUSCAMOS = [  # a confirmar com o Paulo
    ("Gostar de gente", "O negócio é de relacionamento com aplicador, construtora e arquiteto."),
    ("Compromisso", "Prazo combinado é prazo cumprido, do pedido à entrega."),
    ("Foco em resultado", "Meta clara e acompanhamento da franqueadora."),
]
ETAPAS = [  # a confirmar com o Paulo
    ("Apresentação do negócio", "Você conhece o modelo, o catálogo e como a unidade opera."),
    ("Envio da COF", "Recebe a Circular de Oferta de Franquia para avaliar com calma."),
    ("Assinatura do contrato", "Fechado o acordo, a implantação começa."),
    ("Adequação do imóvel", "Loja ou escritório no padrão da marca."),
    ("Treinamento da equipe", "Produto, pedido, entrega e atendimento."),
    ("Inauguração", "A unidade abre com o suporte da franqueadora por perto."),
]
OPERA = [  # a confirmar com o Paulo (suporte, serviços âncora e marketing vieram do site antigo)
    ("Sem estoque na unidade", "O estoque fica por conta da franqueadora. O franqueado vende e acompanha."),
    ("Entrega direto na obra", "O material sai do centro de distribuição regional para o canteiro do cliente."),
    (f"Entrega em até {ENTREGA_HORAS} horas" if ENTREGA_HORAS else "Prazo de entrega combinado", "Prazo máximo para os itens do catálogo na região atendida."),
    ("Suporte próprio por região", "Uma equipe da franqueadora acompanha as unidades de cada região."),
    ("Estudo dos serviços âncora da região", "Antes de abrir, a Multihall mapeia o que mais vende por ali."),
    ("Marketing para campanhas", "Material e campanhas específicas para a unidade."),
]
MODELOS = [
    {"id": "loja", "img": "fachada", "nome": "Loja",
     "texto": "Ponto físico para atender aplicador, construtora e arquiteto, com o catálogo completo e a entrega da franqueadora.",
     "invest": INVESTIMENTO_LOJA, "preco": "R$ 90.000"},
    {"id": "home", "img": "homeoffice", "nome": "Home office",
     "texto": "Operação sem loja aberta ao público, para começar vendendo e crescer depois.",  # a confirmar com o Paulo: o que muda em relação à loja
     "invest": INVESTIMENTO_HOME, "preco": "R$ 9.000"},
]

# ---------------------------------------------------------------- catálogo (a validar com o Paulo)
# (aba, nome, frase, imagem, itens[(nome, descrição, unidade singular|plural)])
CATALOGO = [
    ("steel", "Steel frame", "Estrutura em aço galvanizado para paredes, lajes secas e coberturas.", "steel", [
        ("Perfil montante", "Perfil em C de aço galvanizado para os montantes da parede", "barra|barras"),
        ("Perfil guia", "Perfil em U que recebe os montantes no piso e no teto", "barra|barras"),
        ("Placa OSB", "Chapa estrutural para fechamento e contraventamento", "placa|placas"),
        ("Placa cimentícia", "Fechamento externo, resistente à água", "placa|placas"),
        ("Membrana hidrófuga", "Barreira contra a água por fora, deixa a parede respirar", "rolo|rolos"),
        ("Lã de vidro", "Isolamento térmico e acústico entre os montantes", "rolo|rolos"),
        ("Parafusos e fixadores", "Para perfil, placa e ancoragem na fundação", "caixa|caixas"),
    ]),
    ("telhados", "Telhados", "Cobertura completa, da estrutura à telha.", "telhado", [
        ("Telha shingle", "Telha asfáltica em placas, assentada sobre a base de OSB", "pacote|pacotes"),
        ("Subcobertura", "Manta entre a base e a telha, contra infiltração", "rolo|rolos"),
        ("Telha termoacústica", "Telha metálica com núcleo isolante", "peça|peças"),
        ("Estrutura em tesoura de aço", "Tesouras de perfil galvanizado na medida do projeto", "peça|peças"),
        ("Cumeeiras e rufos", "Arremates do topo e dos encontros do telhado", "peça|peças"),
    ]),
    ("drywall", "Divisórias em drywall", "Paredes e divisórias leves, rápidas e com bom acabamento.", "drywall", [
        ("Chapa ST", "Chapa padrão, para áreas secas", "chapa|chapas"),
        ("Chapa RU", "Chapa resistente à umidade, para banheiro e cozinha", "chapa|chapas"),
        ("Chapa RF", "Chapa resistente ao fogo, para onde a norma pede proteção", "chapa|chapas"),
        ("Montante", "Perfil vertical da parede de drywall", "barra|barras"),
        ("Guia", "Perfil horizontal do piso e do teto", "barra|barras"),
        ("Lã", "Isolamento acústico entre as chapas", "rolo|rolos"),
        ("Massa para juntas", "Para tratar as juntas e os parafusos", "embalagem|embalagens"),
        ("Fita para juntas", "Fita de papel ou telada para as juntas", "rolo|rolos"),
        ("Parafusos", "Para chapa e para perfil", "caixa|caixas"),
    ]),
    ("forros", "Forros", "Forro de gesso ou removível, com tudo que prende e acaba.", "forro", [
        ("Forro de gesso acartonado", "Chapa de gesso parafusada nos perfis, com acabamento liso", "chapa|chapas"),
        ("Forro removível", "Placas modulares, fáceis de tirar para manutenção", "placa|placas"),
        ("Perfis e tirantes", "Estrutura que sustenta o forro", "conjunto|conjuntos"),
        ("Massa e fita", "Para o acabamento das juntas do forro", "kit|kits"),
    ]),
]
PERFIS = [  # para quem compra: (título, texto, imagem, aba do catálogo)
    ("Aplicador", "Gesseiro, montador e instalador. Pedido rápido, material certo e entrega na obra para não parar a equipe.", "equipe", "drywall"),
    ("Construtora", "Fornecimento por obra: a Multihall cota o material do projeto inteiro e entrega por etapa.", "empreendimento", "empreendimentos"),
    ("Arquiteto", "Especificação com a linha completa de construção a seco e uma cotação para apresentar ao cliente.", "capacete", "steel"),
    ("Dono de obra", "Vai construir ou reformar e quer comprar de quem conhece o sistema. Monte a lista e tire as dúvidas pelo WhatsApp.", "steel", "telhados"),
]
OBRAS = [("steel", "Estrutura em steel frame"), ("telhado", "Telhado shingle sobre OSB"), ("drywall", "Parede em drywall com lã"), ("forro", "Forro removível")]

ARROW = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5"/></svg>'
PLUS = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6"/></svg>'


# ---------------------------------------------------------------- imagens
def img(base, sizes="(max-width:860px) 92vw, 46vw", lazy=True):
    """<img> responsivo a partir de base-900.webp e base-1600.webp, ou '' se a imagem ainda não chegou."""
    p900, p1600 = IMG / f"{base}-900.webp", IMG / f"{base}-1600.webp"
    if not p1600.exists():
        return ""
    from PIL import Image
    with Image.open(p1600) as im:
        w, h = im.size
    alt = FOTOS.get(base, ("", ""))[1]
    srcset = f' srcset="/assets/img/{base}-900.webp 900w, /assets/img/{base}-1600.webp {w}w" sizes="{sizes}"' if p900.exists() else ""
    lz = ' loading="lazy"' if lazy else ' fetchpriority="high"'
    return f'<img src="/assets/img/{base}-1600.webp"{srcset} alt="{alt}" width="{w}" height="{h}"{lz} decoding="async">'


FALTAM = []


def foto(base, cls="", sizes="(max-width:860px) 92vw, 46vw", lazy=True, attrs=""):
    """Moldura com a foto, ou a moldura vazia (símbolo apagado) enquanto a imagem não chega."""
    tag = img(base, sizes, lazy)
    if not tag:
        FALTAM.append(base)
        return f'<div class="ph ph--vazio {cls}" role="img" aria-label="{FOTOS.get(base, ("", ""))[1]}"{attrs}></div>'
    return f'<div class="ph {cls}"{attrs}>{tag}</div>'


# ---------------------------------------------------------------- blocos
def tabs():
    out = []
    for i, (aba, nome, *_r) in enumerate(CATALOGO + [("empreendimentos", "Empreendimentos")]):
        sel = "true" if i == 0 else "false"
        out.append(f'<button class="tab" type="button" role="tab" id="tab-{aba}" data-tab="{aba}" aria-selected="{sel}" aria-controls="pedido-{aba}" tabindex="{0 if i == 0 else -1}">{nome}</button>')
    return "\n            ".join(out)


def panels():
    out = []
    for i, (aba, nome, frase, imagem, itens) in enumerate(CATALOGO):
        lis = []
        for k, (n, desc, un) in enumerate(itens):
            iid = f"{aba}-{k}"
            lis.append(
                f'<li class="item" data-id="{iid}" data-nome="{n}" data-un="{un}" data-grupo="{nome}">'
                f'<div><span class="item__n">{n}</span><span class="item__d">{desc}</span></div>'
                f'<div><button class="item__add" type="button" aria-label="Adicionar {n} ao pedido">{PLUS} Adicionar</button>'
                f'<span class="qty"><button type="button" data-menos aria-label="Menos uma unidade de {n}">&minus;</button>'
                f'<input type="number" min="0" max="9999" value="1" aria-label="Quantidade de {n}">'
                f'<button type="button" data-mais aria-label="Mais uma unidade de {n}">+</button><small>{un.split("|")[1]}</small></span></div></li>')
        out.append(
            f'<div class="panel{" on" if i == 0 else ""}" id="pedido-{aba}" role="tabpanel" aria-labelledby="tab-{aba}" data-tab="{aba}">'
            f'<div class="panel__head"><div><h3>{nome}</h3></div>{foto(imagem, sizes="(max-width:860px) 92vw, 16rem")}</div>'
            f'<ul class="itens">' + "".join(lis) + "</ul></div>")
    # empreendimentos: não é item, é fornecimento por obra
    form = ('<form class="form" data-c="empreendimento" novalidate>'
            '<div class="field"><label for="e-nome">Nome</label><input id="e-nome" name="nome" autocomplete="name" required></div>'
            '<div class="field"><label for="e-emp">Construtora ou empresa</label><input id="e-emp" name="empresa" autocomplete="organization" required></div>'
            '<div class="field"><label for="e-zap">WhatsApp</label><input id="e-zap" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 90000-0000" required></div>'
            '<div class="field"><label for="e-cidade">Cidade da obra</label><input id="e-cidade" name="cidade" autocomplete="address-level2" required></div>'
            '<div class="field"><label for="e-tipo">Tipo de obra</label><select id="e-tipo" name="tipo" required><option value="" disabled selected>Escolha</option>'
            '<option>Casas</option><option>Sobrados</option><option>Comercial ou galpão</option><option>Reforma em escala</option><option>Outro</option></select></div>'
            '<div class="field"><label for="e-un">Quantas unidades</label><input id="e-un" name="unidades" inputmode="numeric" placeholder="Ex.: 12"></div>'
            '<div class="field field--full"><label for="e-msg">Etapas, prazo e o que já tem de projeto (opcional)</label><textarea id="e-msg" name="mensagem" rows="2"></textarea></div>'
            f'<button class="btn btn--pri" type="submit">Pedir cotação por obra {ARROW}</button>'
            '<p class="form__note">Mande o projeto depois, pelo próprio WhatsApp.</p></form>')
    out.append(
        '<div class="panel" id="pedido-empreendimentos" role="tabpanel" aria-labelledby="tab-empreendimentos" data-tab="empreendimentos">'
        '<div class="panel__head"><div><h3>Fornecimento por obra</h3><p>Para construtora e incorporadora: você manda o projeto, a Multihall cota o material completo e entrega por etapa, conforme o cronograma da obra.</p></div>'
        f'{foto("empreendimento", sizes="(max-width:860px) 92vw, 16rem")}</div>{form}</div>')
    return "\n          ".join(out)


# a confirmar com o Paulo: endereço do site antigo da empresa; o mapa usa o mesmo ponto (OpenStreetMap)
GEO = (-23.5013158, -46.8483703)
MAPA_URL = "https://www.google.com/maps/search/?api=1&query=Alameda+Rio+Negro+503+Alphaville+Barueri+SP"


def fundo(base):
    """Imagem parada atrás da seção (efeito parallax por clip-path), com a camada azul por cima."""
    if not (IMG / f"{base}-1600.webp").exists():
        return ""
    return (f'<div class="fixo__bg" aria-hidden="true"><img src="/assets/img/{base}-1600.webp" '
            f'srcset="/assets/img/{base}-900.webp 900w, /assets/img/{base}-1600.webp 1600w" sizes="100vw" alt="" '
            f'width="1600" height="900" loading="lazy" decoding="async"></div>')


def dms(v, pos, neg):
    s = pos if v >= 0 else neg
    v = abs(v); d = int(v); m = int((v - d) * 60); sec = round(((v - d) * 60 - m) * 60)
    return f"{d}°{m:02d}′{sec:02d}″{s}"


def mira():
    """Mapa da unidade: ruas reais de Alphaville (OpenStreetMap) em linha fina,
    régua, varredura e coordenadas. A unidade fica no centro (300,300)."""
    import sys
    sys.path.insert(0, str(RAIZ / "tools"))
    from mapa_osm import mapa
    t = []
    for k in range(20, 581, 20):
        L = 14 if k % 100 == 0 else 6
        t += [f"M{k} 20v{L}", f"M{k} 580v-{L}", f"M20 {k}h{L}", f"M580 {k}h-{L}"]
    ticks = " ".join(t)
    lat, lon = dms(GEO[0], "N", "S"), dms(GEO[1], "L", "O")
    return f'''<svg viewBox="0 0 600 600" role="img" aria-label="Mapa de Alphaville com a Multihall na Alameda Rio Negro">
<defs><linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f58a1f"/><stop offset="1" stop-color="#ffb04d"/></linearGradient>
<radialGradient id="wedge" cx="300" cy="300" r="262" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f58a1f" stop-opacity=".2"/><stop offset="1" stop-color="#f58a1f" stop-opacity="0"/></radialGradient>
<radialGradient id="vinheta" cx="300" cy="300" r="300" gradientUnits="userSpaceOnUse"><stop offset=".55" stop-color="#0d1426" stop-opacity="0"/><stop offset="1" stop-color="#0d1426" stop-opacity=".85"/></radialGradient>
<clipPath id="quadro"><rect x="20" y="20" width="560" height="560"/></clipPath></defs>
{mapa()}
<rect x="20" y="20" width="560" height="560" fill="url(#vinheta)"/>
<rect class="m-line" x="20" y="20" width="560" height="560"/>
<path class="m-line" d="{ticks}"/>
<path class="m-line m-cross" d="M20 300H580M300 20V580" stroke-dasharray="4 6"/>
<circle class="m-ring" cx="300" cy="300" r="120"/>
<circle class="m-ring" cx="300" cy="300" r="262" stroke-dasharray="2 8"/>
<g class="sweep"><path d="M300 300L300 38A262 262 0 0 1 431 73Z" fill="url(#wedge)"/><path class="m-acc" d="M300 300V38"/></g>
<circle class="m-acc pulse" cx="300" cy="300" r="60"/><circle class="m-acc pulse" cx="300" cy="300" r="60"/>
<rect x="293" y="293" width="14" height="14" fill="#f58a1f" transform="rotate(45 300 300)"/>
<g class="m-tag"><rect x="40" y="36" width="150" height="54" fill="#0d1426" fill-opacity=".8"/><text class="m-txt" x="48" y="58">{lat}</text><text class="m-txt" x="48" y="78">{lon}</text></g>
<text class="m-txt" x="560" y="58" text-anchor="end">N ↑</text>
<g class="m-tag"><rect x="34" y="520" width="232" height="56" fill="#0d1426" fill-opacity=".8"/><text class="m-big" x="40" y="548">Alphaville, Barueri</text><text class="m-txt" x="40" y="566">MULTIHALL ALPHAVILLE</text></g>
</svg>'''


def prazo():
    if not ENTREGA_HORAS:
        return ""
    return (f'<div class="prazo rv" data-d="1"><b>{ENTREGA_HORAS}<small>h</small></b>'
            f'<span>Prazo máximo de entrega para os itens do catálogo na região atendida.</span></div>')


def fatos():
    f = ["Entrega direta na obra"]
    if CD_REGIONAL:
        f.append("Centro de distribuição regional")
    f += [f"Primeira obra entregue em {PRIMEIRA_OBRA}", "Cotação pelo WhatsApp, sem cadastro"]
    return "\n          ".join(f"<li>{x}</li>" for x in f)


def perfis():
    out, fotos_ = [], []
    for i, (t, p, im, aba) in enumerate(PERFIS):
        out.append(f'<article class="perfil{" on" if i == 0 else ""}">'
                   f'<b>{i + 1:02d}</b><div><h3>{t}</h3><p>{p}</p>'
                   f'<a class="link" href="#pedido-{aba}" data-tab="{aba}">{"Fornecimento por obra" if aba == "empreendimentos" else "Ver no catálogo"} {ARROW}</a></div></article>')
        fotos_.append(foto(im, "on" if i == 0 else "", sizes="(max-width:860px) 1px, 40vw"))
    return "\n          ".join(out), "\n          ".join(fotos_)


def mosaico():
    out = []
    for i, (base, legenda) in enumerate(OBRAS):
        s = "(max-width:860px) 92vw, 58vw" if i in (0, 3) else "(max-width:860px) 46vw, 42vw"
        out.append(f'<figure>{foto(base, sizes=s)}<figcaption>{legenda}</figcaption></figure>')
    return "\n        ".join(out)


def modelos(completo):
    out = []
    for m in MODELOS:
        if completo:
            lista = '<ul class="modelo__lista">' + "".join(f"<li><span>{k}</span><span>{v}</span></li>" for k, v in m["invest"][1:] if "[A PREENCHER" not in v) + "</ul>"
            cta = f'<div class="ctas"><a class="btn btn--pri" href="#form" data-modelo="{m["nome"]}">Quero este modelo {ARROW}</a></div>'
        else:
            lista = ""
            cta = f'<div class="ctas"><a class="btn btn--line" href="/franquia#modelos">Ver a franquia {ARROW}</a></div>'
        out.append(f'<article class="modelo">{foto(m["img"], sizes="(max-width:860px) 92vw, 40vw")}<h3>{m["nome"]}</h3><p>{m["texto"]}</p>'
                   f'<div class="modelo__preco"><strong>{m["preco"]}</strong><small>investimento inicial</small></div>{lista}{cta}</article>')
    return "\n        ".join(out)


def lista_simples(pares):
    return "\n          ".join(f"<li><b>{t}</b><span>{p}</span></li>" for t, p in pares)


def opera():
    return "\n          ".join(f"<li><i></i><div><h3>{t}</h3><p>{p}</p></div></li>" for t, p in OPERA)


def etapas():
    return "\n        ".join(f'<div class="etapa rv" data-d="{min(i, 3)}"><b>{i + 1:02d}</b><h3>{t}</h3><p>{p}</p></div>' for i, (t, p) in enumerate(ETAPAS))


def foot_solucoes():
    lis = [f'<li><a href="/#pedido-{aba}">{nome}</a></li>' for aba, nome, *_r in CATALOGO]
    lis.append('<li><a href="/#pedido-empreendimentos">Empreendimentos</a></li>')
    return "\n          ".join(lis)


def texto(frag):
    from html import unescape
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", "", frag))).strip()


def fone():
    w = WHATSAPP
    return f"+{w[:2]} {w[2:4]} {w[4:-4]}-{w[-4:]}" if len(w) >= 12 else ""


# ---------------------------------------------------------------- busca e IA
def schema(nome, pg):
    S, url = DOMINIO, DOMINIO + pg["path"]
    org, loja = {"@id": f"{S}/#organizacao"}, {"@id": f"{S}/#loja"}
    endereco = {"@type": "PostalAddress", "addressLocality": "Barueri", "addressRegion": "SP", "addressCountry": "BR"}
    oferta = lambda n, desc, tipo, quem: {"@type": "Offer", "itemOffered": {"@type": "Product" if tipo == "produto" else "Service", "name": n, "description": desc, "brand" if tipo == "produto" else "provider": quem}}
    catalogo = []
    for aba, n, frase, _im, itens in CATALOGO:
        catalogo.append({"@type": "OfferCatalog", "name": n, "url": f"{S}/#pedido-{aba}", "description": frase,
                         "itemListElement": [oferta(i, d, "produto", org) for i, d, _u in itens]})
    catalogo.append({"@type": "OfferCatalog", "name": "Empreendimentos", "url": f"{S}/#pedido-empreendimentos",
                     "itemListElement": [oferta("Fornecimento por obra", "Cotação do material completo de um empreendimento, com entrega por etapa.", "servico", loja)]})
    franquia = []
    for m in MODELOS:
        o = oferta(f"Franquia Multihall, modelo {m['nome'].lower()}", m["texto"].split(" [")[0], "servico", org)
        o.update({"price": re.sub(r"\D", "", m["preco"]), "priceCurrency": "BRL", "url": f"{S}/franquia#modelos", "category": "Franquia", "seller": org})
        franquia.append(o)
    marca = {"@type": "Organization", **org, "name": "Multihall",
             "description": "Revenda de material de construção a seco (steel frame, telhados, divisórias e forros em drywall) com entrega direto na obra, e franquia.",
             "url": f"{S}/", "logo": {"@type": "ImageObject", "url": f"{S}/assets/img/logo.svg"}, "image": f"{S}/assets/img/og-image.jpg",
             "address": endereco, "parentOrganization": {"@type": "Organization", "name": "Massuo Group", "url": GRUPO},
             "hasOfferCatalog": {"@type": "OfferCatalog", "name": "Franquia Multihall", "itemListElement": franquia}}
    unidade = {"@type": "HardwareStore", **loja, "name": UNIDADE[0], "parentOrganization": org, "url": f"{S}/",
               "description": "Unidade Multihall em Alphaville, Barueri (SP): material de construção a seco com entrega direto na obra.",
               "image": f"{S}/assets/img/og-image.jpg", "address": endereco, "areaServed": "Barueri e região",
               "knowsAbout": ["Steel frame", "Drywall", "Telhado shingle", "Forro de gesso", "Construção a seco"],
               "hasOfferCatalog": {"@type": "OfferCatalog", "name": "Soluções em construção a seco", "itemListElement": catalogo}}
    if WHATSAPP:
        unidade["telephone"] = fone()
        marca["contactPoint"] = {"@type": "ContactPoint", "telephone": fone(), "contactType": "sales", "availableLanguage": "pt-BR"}
    pagina = {"@type": "WebPage", "@id": f"{url}#pagina", "url": url, "name": pg["title"], "description": pg["desc"],
              "isPartOf": {"@id": f"{S}/#site"}, "about": org if nome == "franquia" else loja, "inLanguage": "pt-BR",
              "primaryImageOfPage": {"@type": "ImageObject", "url": f"{S}/assets/img/og-image.jpg", "width": 1200, "height": 630}}
    grafo = [marca, unidade, {"@type": "WebSite", "@id": f"{S}/#site", "url": f"{S}/", "name": "Multihall", "inLanguage": "pt-BR", "publisher": org}, pagina]
    if pg["path"] != "/":
        pagina["breadcrumb"] = {"@id": f"{url}#trilha"}
        grafo.append({"@type": "BreadcrumbList", "@id": f"{url}#trilha", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Início", "item": f"{S}/"},
            {"@type": "ListItem", "position": 2, "name": pg["trilha"], "item": url}]})
    js = json.dumps({"@context": "https://schema.org", "@graph": grafo}, ensure_ascii=False, separators=(",", ":"))
    return '<script type="application/ld+json">' + js.replace("</", "<\\/") + "</script>"


def llms():
    S = DOMINIO
    lin = ["# Multihall", "",
           "> Revenda de material de construção a seco: steel frame, telhados, divisórias e forros em drywall, "
           f"com entrega direto na obra. Unidade em {UNIDADE[1]}. Também é franquia: "
           + " ou ".join(f"{m['nome'].lower()} ({m['preco']})" for m in MODELOS) + ". Uma empresa do Massuo Group.", "",
           "## Em poucas palavras", "",
           "- Empresa: Multihall, do Massuo Group (com a City Steel e a Reformuli).",
           "- O que faz: fornece material de construção a seco para aplicador, construtora, arquiteto e dono de obra, e cota o material completo de empreendimentos com entrega por etapa.",
           "- Como comprar: monta a lista no site, sem preço, e envia pelo WhatsApp; a cotação volta com condição e prazo.",
           "- Entrega: direto na obra" + (", a partir de um centro de distribuição regional" if CD_REGIONAL else "") + (f", em até {ENTREGA_HORAS} horas para os itens do catálogo na região atendida" if ENTREGA_HORAS else "") + ".",
           f"- Primeira obra entregue em {PRIMEIRA_OBRA}.",
           f"- Unidade: {UNIDADE[0]}, {UNIDADE[1]}.",
           "- Franquia: " + "; ".join(f"{m['nome'].lower()}, investimento inicial de {m['preco']}" for m in MODELOS) + ".",
           f"- Contato: WhatsApp {fone()}." if WHATSAPP else "- Contato: formulário do site.",
           "", "## Soluções e itens do catálogo", ""]
    for _aba, n, frase, _im, itens in CATALOGO:
        lin += [f"### {n}", "", frase, ""] + [f"- {i}: {d.lower()}" for i, d, _u in itens] + [""]
    lin += ["### Empreendimentos", "", "Fornecimento por obra: a construtora manda o projeto e recebe a cotação do material completo, com entrega por etapa.", ""]
    lin += ["## Para quem compra", ""] + [f"- **{t}:** {p}" for t, p, *_ in PERFIS]
    lin += ["", "## Franquia Multihall", "", "### Modelos", ""]
    for m in MODELOS:
        lin += [f"- **{m['nome']}:** {m['texto']} " + "; ".join(f"{k}: {v}" for k, v in m["invest"] if "[A PREENCHER" not in v) + "."]
    lin += ["", "### Como opera", ""] + [f"- **{t}:** {p}" for t, p in OPERA]
    lin += ["", "### Para quem é", ""] + [f"- **{t}:** {p}" for t, p in PARA_QUEM]
    lin += ["", "### O que a Multihall busca", ""] + [f"- **{t}:** {p}" for t, p in BUSCAMOS]
    lin += ["", "### Etapas", ""] + [f"{i}. **{t}.** {p}" for i, (t, p) in enumerate(ETAPAS, 1)]
    lin += ["", "## Páginas", "",
            f"- [Início]({S}/): história da montagem em 3D, catálogo para montar o pedido, por que comprar aqui, para quem compra, obras, unidade e contato.",
            f"- [Franquia]({S}/franquia): como opera, modelos, para quem é, etapas e formulário.",
            "", "## Contato", ""]
    if WHATSAPP:
        lin += [f"- WhatsApp: {fone()} (https://wa.me/{WHATSAPP})"]
    lin += [f"- Montar um pedido: {S}/#pedido", f"- Fornecimento por obra: {S}/#pedido-empreendimentos", f"- Ser franqueado: {S}/franquia#form", ""]
    return "\n".join(lin)


def robots_txt():
    if INDEXAR:
        corpo = "User-agent: *\nAllow: /\n\n"
    else:
        corpo = ("# Pré-lançamento (INDEXAR = False): o Google lê as páginas para ver o noindex delas,\n"
                 "# e os robôs de IA ficam fora até o domínio entrar no ar.\n"
                 "User-agent: *\nAllow: /\n\n" + "".join(f"User-agent: {b}\nDisallow: /\n\n" for b in ROBOS_IA))
    return corpo + f"Sitemap: {DOMINIO}/sitemap.xml\n"


def vercel_json():
    arq = RAIZ / "vercel.json"
    base = {"cleanUrls": True, "trailingSlash": False, "headers": [
        {"source": "/assets/fonts/(.*)", "headers": [{"key": "Cache-Control", "value": "public, max-age=31536000, immutable"}]},
        {"source": "/assets/js/(.*)", "headers": [{"key": "Cache-Control", "value": "public, max-age=31536000, immutable"}]},
        {"source": "/assets/img/(.*)", "headers": [{"key": "Cache-Control", "value": "public, max-age=604800"}]},
    ]}
    cfg = json.loads(arq.read_text()) if arq.exists() else base
    redir = [r for r in cfg.get("redirects", []) if not any(h.get("value") == VERCEL for h in r.get("has", []))]
    if INDEXAR and VERCEL not in DOMINIO:
        host = [{"type": "host", "value": VERCEL}]
        redir += [{"source": "/", "has": host, "destination": f"{DOMINIO}/", "permanent": True},
                  {"source": "/:path*", "has": host, "destination": f"{DOMINIO}/:path*", "permanent": True}]
    if redir:
        cfg["redirects"] = redir
    else:
        cfg.pop("redirects", None)
    cab = [h for h in cfg.get("headers", []) if not any(x["key"] == "X-Robots-Tag" for x in h["headers"])]
    if not INDEXAR:
        cab.append({"source": "/(.*)", "headers": [{"key": "X-Robots-Tag", "value": "noindex"}]})
    cfg["headers"] = cab
    novo = json.dumps(cfg, ensure_ascii=False, indent=2) + "\n"
    if not arq.exists() or arq.read_text() != novo:
        arq.write_text(novo)


# ---------------------------------------------------------------- montagem
def minificar(css):
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"\s*\n\s*", "\n", css)
    css = re.sub(r"\s*([{}:;,>])\s*", r"\1", css)
    css = re.sub(r";}", "}", css)
    css = re.sub(r"\n+", "", css)
    return css.replace("../fonts/", "/assets/fonts/").strip()


def hash_de(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()[:10] if p.exists() else "0"


def carimbar_3d():
    js = JS.read_text()
    novo = re.sub(r"/assets/js/build3d\.js(\?v=[a-z0-9]+)?", f"/assets/js/build3d.js?v={hash_de(B3D)}", js)
    if novo != js:
        JS.write_text(novo)


def preload_poster(base):
    out = []
    for suf, media in (("", "(min-width:861px)"), ("-m", "(max-width:860px)")):
        if (IMG / f"{base}{suf}.webp").exists():
            out.append(f'<link rel="preload" as="image" href="/assets/img/{base}{suf}.webp" media="{media}" fetchpriority="high">')
        else:
            print(f"  ! pôster faltando: {base}{suf}.webp (rode python3 tools/poster.py)")
    return "\n".join(out)


PAGINAS = {
    "index": dict(
        arquivo="index.html", path="/",
        title="Material de construção a seco entregue na obra | Multihall",
        desc="Steel frame, telhados, divisórias e forros em drywall com entrega direto na obra. Monte seu pedido no site e receba a cotação pelo WhatsApp. Unidade em Alphaville, Barueri.",
        poster="hero-poster", nav_home=' aria-current="page"', nav_franquia="", cta=("Fale com a gente", "/#contato")),
    "franquia": dict(
        arquivo="franquia.html", path="/franquia", trilha="Franquia",
        title="Franquia de material de construção a seco a partir de R$ 9.000 | Multihall",
        desc="Franquia Multihall: loja (R$ 90.000) ou home office (R$ 9.000), sem estoque na unidade e com entrega direto na obra pela franqueadora.",
        poster="franquia-poster", nav_home="", nav_franquia=' aria-current="page"', cta=("Quero ser franqueado", "#form")),
    "obrigado": dict(
        arquivo="obrigado.html", path="/obrigado",
        title="Multihall | Abrindo a conversa", desc="Estamos abrindo a conversa com a equipe da Multihall.",
        poster="", nav_home="", nav_franquia="", cta=("", ""), robots="noindex,nofollow"),
}


def main():
    carimbar_3d()
    css = minificar(CSS.read_text())
    head_t, top_t, foot_t = (SRC / "head.html").read_text(), (SRC / "top.html").read_text(), (SRC / "foot.html").read_text()
    perfis_html, quem_fotos = perfis()
    blocos = {
        "ARROW": ARROW, "TABS": tabs(), "PANELS": panels(), "PRAZO": prazo(), "FATOS": fatos(),
        "PERFIS": perfis_html, "QUEM_FOTOS": quem_fotos, "MOSAICO": mosaico(),
        "MODELOS_HOME": modelos(False), "MODELOS_FULL": modelos(True),
        "OPERA": opera(), "PARA_QUEM": lista_simples(PARA_QUEM), "BUSCAMOS": lista_simples(BUSCAMOS), "ETAPAS": etapas(),
        "BG_CD": fundo("cd"), "BG_FACHADA": fundo("fachada"), "MIRA": mira(), "MAPA_URL": MAPA_URL,
        "FOTO_CD": foto("cd", "rv", sizes="(max-width:860px) 80vw, 34vw"), "FOTO_ENTREGA": foto("entrega", "rv", sizes="(max-width:860px) 80vw, 34vw", attrs=' data-d="1"'),
        "FOTO_FACHADA": foto("fachada", "uni__foto", sizes="(max-width:860px) 92vw, 46vw"),
        "FOTO_EQUIPE": foto("equipe", "opera__foto", sizes="(max-width:860px) 92vw, 46vw"),
        "UNIDADE_NOME": UNIDADE[0], "UNIDADE_CIDADE": UNIDADE[1], "UNIDADE_HTML": f"{UNIDADE[0]}<br>{UNIDADE[1]}",
        "FOOT_SOLUCOES": foot_solucoes(), "FONE": fone(), "GRUPO": GRUPO, "CITYSTEEL": CITYSTEEL, "REFORMULI": REFORMULI,
        "WHATSAPP": WHATSAPP, "FRANQUIA_MAP": FRANQUIA_MAP, "ANO": str(date.today().year),
    }
    jsv = hash_de(JS)
    mudou = set()
    for nome, pg in PAGINAS.items():
        robots = pg.get("robots") or ("index,follow,max-image-preview:large" if INDEXAR else "noindex,nofollow")
        head = (head_t.replace("{{CSS}}", css).replace("{{TITLE}}", pg["title"]).replace("{{DESC}}", pg["desc"])
                .replace("{{URL}}", DOMINIO + pg["path"]).replace("{{ROBOTS}}", robots).replace("{{OG_BASE}}", OG_BASE)
                .replace("{{PRELOAD}}", preload_poster(pg["poster"]) if pg["poster"] else "")
                .replace("{{SCHEMA}}", schema(nome, pg) if nome != "obrigado" else ""))
        top = (top_t.replace("{{NAV_HOME}}", pg["nav_home"]).replace("{{NAV_FRANQUIA}}", pg["nav_franquia"])
               .replace("{{TOP_CTA}}", pg["cta"][0]).replace("{{TOP_CTA_HREF}}", pg["cta"][1]))
        foot = foot_t.replace("{{JSV}}", jsv)
        html = (SRC / f"{nome}.html").read_text().replace("{{HEAD}}", head).replace("{{TOP}}", top).replace("{{FOOT}}", foot)
        for k, v in blocos.items():
            html = html.replace("{{" + k + "}}", v)
        sobra = re.findall(r"\{\{[A-Z_0-9]+\}\}", html)
        if sobra:
            print(f"  ! {nome}: marcadores sem valor {sorted(set(sobra))}")
        if "—" in html:
            print(f"  ! {nome}: travessão no HTML")
        destino = RAIZ / pg["arquivo"]
        if not destino.exists() or destino.read_text() != html:
            mudou.add(pg["path"])
            destino.write_text(html)
        print(f"  {pg['arquivo']}: {len(html.encode())/1024:.1f} KB")

    (RAIZ / "robots.txt").write_text(robots_txt())
    mapa = RAIZ / "sitemap.xml"
    antes = dict(re.findall(r"<loc>https?://[^/<]+(/[^<]*)</loc><lastmod>([\d-]+)</lastmod>", mapa.read_text())) if mapa.exists() else {}
    hoje = date.today().isoformat()
    urls = "".join(f"  <url><loc>{DOMINIO}{p}</loc><lastmod>{hoje if p in mudou or p not in antes else antes[p]}</lastmod></url>\n" for p in ["/", "/franquia"])
    mapa.write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n')
    (RAIZ / "llms.txt").write_text(llms())
    vercel_json()
    if FALTAM:
        print("  ! imagens que ainda não chegaram (moldura vazia no site):", ", ".join(sorted(set(FALTAM))))
    print(f"  site.js v={jsv}  build3d.js v={hash_de(B3D)}  indexar={INDEXAR}  whatsapp={WHATSAPP}")


if __name__ == "__main__":
    main()
