# Multihall, site

Site estático da Multihall (material de construção a seco, Massuo Group): home com a história em 3D (a unidade que se monta peça a peça), o catálogo "Monte seu pedido" que manda a lista pelo WhatsApp, por que comprar aqui, para quem compra, obras, unidade, franquia e contato; página `/franquia` e `/obrigado` (ponte para o WhatsApp, que registra a conversão no `dataLayer`).

## Como editar

- Dados da empresa, catálogo, franquia e textos repetidos: `build.py` (tudo no topo). O que veio do site antigo está marcado com "a confirmar com o Paulo".
- Páginas: `_src/*.html`. Estilo: `assets/css/site.css` (vai minificado para o `<head>`). Comportamento: `assets/js/site.js`.
- O 3D é `assets/js/build3d.js` (three.js via CDN, carregado na primeira interação; até lá aparece o pôster).
- Imagens: a lista única fica em `tools/fotos.py` (`FOTOS`, com o texto alternativo). `python3 tools/fotos.py` converte o que existir em `~/dev/_massuo-imagens/geradas/` para webp 900 e 1600. Pode rodar quantas vezes quiser. Imagem que ainda não chegou vira moldura vazia no site.
- Depois de qualquer mudança: `python3 build.py`.
- Prévia local: `python3 tools/serve.py 4245`. Fotos de conferência: `python3 tools/shots.py _shots --etapas`. Pôsteres do 3D e imagem de compartilhamento: `python3 tools/poster.py` (com o servidor no ar) e depois `python3 build.py`.

## Busca e IA

- Tudo sai de `DOMINIO` no `build.py` (hoje `https://multihall.vercel.app`): canonical, og:url, schema, `sitemap.xml`, `robots.txt` e `llms.txt`.
- Enquanto `INDEXAR = False`: `noindex` na meta e no `X-Robots-Tag` do `vercel.json`, robôs de IA barrados no `robots.txt`.
- Para ir ao ar com domínio: ligar o domínio na Vercel, trocar `DOMINIO`, virar `INDEXAR = True`, rodar `python3 build.py` e publicar.

## Pendências com o Paulo

- Validade dos dados do site antigo (2009, entrega em 48 horas, sem estoque, centro de distribuição, composição do investimento, etapas).
- O que muda no modelo home office (R$ 9.000) e a composição desse investimento.
- Itens do catálogo e unidades de venda; endereço da unidade; WhatsApp; fotos reais de obra.
