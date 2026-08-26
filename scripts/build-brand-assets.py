#!/usr/bin/env python3
"""
Gera os assets de marca do Konvo a partir da arte aprovada.

NAO redesenha nada: extrai as formas exatas da arte original.
O wordmark vem com uma caixa branca chapada por tras das letras, dentro de um
canvas transparente. O canal R separa as duas coisas perfeitamente (letras R~0,
branco R~253), entao da pra derivar o alpha real preservando o antialiasing.

Uso:  python3 scripts/build-brand-assets.py
Requer: Pillow
"""

from PIL import Image
from pathlib import Path

SRC_WORDMARK = Path("/Users/administrador/Downloads/Konvo logo/5.png")
SRC_ICON = Path("/Users/administrador/Downloads/Konvo icon .png")
OUT = Path(__file__).resolve().parent.parent / "public" / "brand"

BRAND_BLUE = (0x00, 0x43, 0xFD)
WHITE = (0xFF, 0xFF, 0xFF)


def extract_wordmark(color):
    """Wordmark com transparencia real, recolorido no token pedido."""
    im = Image.open(SRC_WORDMARK).convert("RGBA")
    w, h = im.size
    px = im.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    o = out.load()
    r0, g0, b0 = color
    for y in range(h):
        for x in range(w):
            r, _, _, a = px[x, y]
            if a == 0:
                continue
            na = int((255 - r) * (a / 255))
            if na > 0:
                o[x, y] = (r0, g0, b0, na)
    return out.crop(out.getbbox())


def extract_icon():
    """Squircle recortado no proprio contorno, com cantos transparentes."""
    im = Image.open(SRC_ICON).convert("RGBA")
    w, h = im.size
    px = im.load()
    o = im.load()
    # o fundo fora do squircle e branco puro; o squircle e azul saturado.
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if r > 240 and g > 240 and b > 240:
                o[x, y] = (r, g, b, 0)
    return im.crop(im.getbbox())


def resized_to_height(img, height):
    ratio = img.size[0] / img.size[1]
    return img.resize((round(height * ratio), height), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    # --- wordmark ---------------------------------------------------------
    blue = extract_wordmark(BRAND_BLUE)
    white = extract_wordmark(WHITE)
    print(f"wordmark {blue.size}  ratio {blue.size[0] / blue.size[1]:.3f}")

    resized_to_height(blue, 96).save(OUT / "wordmark.png")
    resized_to_height(blue, 240).save(OUT / "wordmark-lg.png")
    resized_to_height(white, 96).save(OUT / "wordmark-white.png")
    resized_to_height(white, 240).save(OUT / "wordmark-white-lg.png")

    # --- icone ------------------------------------------------------------
    icon = extract_icon()
    print(f"icon {icon.size}")

    for size in (192, 512):
        icon.resize((size, size), Image.LANCZOS).save(OUT / f"icon-{size}.png")

    # apple-touch-icon: iOS nao lida bem com transparencia, achata em branco
    at = Image.new("RGBA", icon.size, (255, 255, 255, 255))
    at.alpha_composite(icon)
    at.convert("RGB").resize((180, 180), Image.LANCZOS).save(OUT / "apple-touch-icon.png")

    # maskable: full-bleed azul, K dentro da safe zone (~62%)
    for size in (512,):
        canvas = Image.new("RGBA", (size, size), BRAND_BLUE + (255,))
        inner = round(size * 0.62)
        canvas.alpha_composite(
            icon.resize((inner, inner), Image.LANCZOS),
            ((size - inner) // 2, (size - inner) // 2),
        )
        canvas.save(OUT / f"icon-maskable-{size}.png")

    # favicon
    icon.resize((32, 32), Image.LANCZOS).save(OUT / "favicon-32.png")

    for f in sorted(OUT.iterdir()):
        print(f"  {f.name:28} {f.stat().st_size // 1024:>4} KB")


if __name__ == "__main__":
    main()
