#!/usr/bin/env python3
"""Renderiza os pôsteres do 3D (o que aparece até a primeira interação) e a imagem de
compartilhamento, a partir da própria cena, no Chromium próprio do Playwright.

    python3 tools/serve.py 4245 &      # o servidor precisa estar no ar
    python3 tools/poster.py

Gera em assets/img: hero-poster.webp (1600x900), hero-poster-m.webp (900x1950),
franquia-poster(.m).webp e og-image.jpg (1200x630). Depois rode python3 build.py.
"""
import asyncio, io, os
from pathlib import Path
from playwright.async_api import async_playwright
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
IMG = RAIZ / "assets/img"
URL = os.environ.get("URL", "http://127.0.0.1:4245")
CHROME = os.path.expanduser("~/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell")
POSTERS = [("hero-poster", "/", 1600, 900), ("hero-poster-m", "/", 900, 1950), ("franquia-poster", "/franquia", 1600, 900), ("franquia-poster-m", "/franquia", 900, 1950)]


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        for nome, path, w, h in POSTERS:
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, is_mobile=w < h, has_touch=w < h)
            pg = await ctx.new_page()
            await pg.goto(f"{URL}{path}?poster=1&p=0", wait_until="load")
            await pg.wait_for_selector(".story.live", timeout=120000)
            await pg.wait_for_timeout(1500)
            png = await pg.locator(".story__stage").screenshot(type="png")
            im = Image.open(io.BytesIO(png)).convert("RGB")
            im.save(IMG / f"{nome}.webp", "WEBP", quality=80, method=6)
            print(nome, im.size, f"{(IMG / f'{nome}.webp').stat().st_size // 1024} KB")
            if nome == "hero-poster":
                og = await ctx.new_page()
                await og.set_viewport_size({"width": 1200, "height": 630})
                await og.set_content(
                    '<body style="margin:0;width:1200px;height:630px;position:relative;overflow:hidden;background:#0d1426">'
                    f'<img src="{URL}/assets/img/hero-poster.webp" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:70% 50%">'
                    '<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,20,38,.96) 0,rgba(13,20,38,.75) 42%,rgba(13,20,38,0) 70%)"></div>'
                    f'<img src="{URL}/assets/img/logo.svg" style="position:absolute;left:80px;top:72px;height:96px">'
                    '<div style="position:absolute;left:84px;top:236px;width:560px;font:600 54px/1.08 Poppins,Arial,sans-serif;letter-spacing:-.03em;color:#f3f4f7">'
                    'Material de construção a seco, <span style="color:#f58a1f">entregue na obra.</span></div>'
                    '<div style="position:absolute;left:84px;top:430px;width:520px;font:400 24px/1.4 Poppins,Arial,sans-serif;color:#a6aec0">Steel frame, telhados, drywall e forros. Monte o pedido e receba a cotação pelo WhatsApp.</div>'
                    '</body>')
                await og.wait_for_timeout(1200)
                png = await og.screenshot(type="png")
                Image.open(io.BytesIO(png)).convert("RGB").save(IMG / "og-image.jpg", quality=86)
                print("og-image.jpg")
            await ctx.close()
        await b.close()

asyncio.run(main())
