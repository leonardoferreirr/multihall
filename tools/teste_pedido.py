#!/usr/bin/env python3
"""Testa o Monte seu pedido: adiciona, muda quantidade, recarrega, envia e mostra a mensagem gerada."""
import asyncio, os, sys, urllib.parse
from playwright.async_api import async_playwright
CHROME = os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell')
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4245/'

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME)
        for w in (1440, 390):
            ctx = await b.new_context(viewport={'width': w, 'height': 900 if w > 800 else 844}, is_mobile=w < 800, has_touch=w < 800)
            pg = await ctx.new_page()
            erros = []
            pg.on('console', lambda m: m.type == 'error' and erros.append(m.text))
            pg.on('pageerror', lambda e: erros.append(str(e)))
            await pg.goto(URL, wait_until='load')
            await pg.click('#pedido-steel [data-id="steel-0"] .item__add')
            await pg.click('#pedido-steel [data-id="steel-0"] [data-mais]')
            await pg.click('#pedido-steel [data-id="steel-0"] [data-mais]')
            await pg.click('#pedido-steel [data-id="steel-2"] .item__add')
            await pg.fill('#pedido-steel [data-id="steel-2"] .qty input', '20')
            await pg.press('#pedido-steel [data-id="steel-2"] .qty input', 'Enter')
            await pg.click('#tab-drywall')
            assert await pg.is_visible('#pedido-drywall'), 'aba drywall não abriu'
            await pg.click('#pedido-drywall [data-id="drywall-0"] .item__add')
            await pg.click('#pedido-drywall [data-id="drywall-6"] .item__add')
            await pg.click('#pedido-drywall [data-id="drywall-6"] [data-menos]')   # volta a zero: sai da lista
            n = await pg.evaluate('document.querySelectorAll(".carrinho__lista li:not(.carrinho__grupo)").length')
            print(w, 'itens na lista antes do reload:', n)
            await pg.reload(wait_until='load')
            n2 = await pg.evaluate('document.querySelectorAll(".carrinho__lista li:not(.carrinho__grupo)").length')
            q = await pg.evaluate('document.querySelector("#pedido-steel [data-id=\\"steel-0\\"] .qty input").value')
            print(w, 'depois do reload:', n2, 'itens; qtd do montante =', q, '; aba ativa =', await pg.evaluate('document.querySelector(".tab[aria-selected=true]").dataset.tab'))
            await pg.fill('#p-nome', 'Leonardo teste')
            await pg.fill('#p-cidade', 'Barueri, SP')
            await pg.fill('#p-obs', 'Entregar em duas etapas')
            msg = await pg.evaluate('window.__mhMensagem()')
            await pg.route('**/wa.me/**', lambda r: r.abort())
            await pg.route('https://wa.me/**', lambda r: r.abort())
            await pg.click('.carrinho .btn')
            await pg.wait_for_url('**/obrigado?c=pedido')
            href = await pg.evaluate('document.getElementById("go").href')
            texto = urllib.parse.unquote(href.split('text=')[1])
            print(w, 'URL:', pg.url, '| destino:', href[:40])
            print(texto if texto == msg else f'DIFERENTE\n{texto}\n---\n{msg}')
            print(w, 'erros:', erros)
            await ctx.close()
        await b.close()
asyncio.run(main())
