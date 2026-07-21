#!/usr/bin/env python3
"""
Generate the BLKPVNTHR LLC icon and social-sharing assets.

Source mark: the existing BLKPVNTHR panther head used by BLKPVNTHR.OS. It is a
dark silhouette on transparency, so it is recoloured to ivory here rather than
redrawn — no new brand mark is invented.

Text is set in Helvetica Neue, which is the declared fallback for both Sora and
Inter in the site stylesheet, so the card stays visually consistent with the
page even though the webfonts themselves are not available offline.

Outputs (site/assets/):
    blkpvnthr-mark.png      ivory mark on transparency, 512px
    favicon-32.png          32x32
    favicon-180.png         180x180 (apple-touch-icon)
    favicon-512.png         512x512
    og-card.png             1200x630 social card

Usage: python3 scripts/build-assets.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "site" / "assets"
SOURCE_MARK = Path.home() / "BLKPVNTHR-OS" / "public" / "blkpvnthr-icon-transparent.png"

BG = (10, 10, 10, 255)          # --bg
INK = (245, 245, 240, 255)      # --ink
INK_MUTED = (156, 156, 150, 255)  # --ink-muted
INK_FAINT = (128, 128, 120, 255)  # --ink-faint
ACCENT = (143, 180, 162, 255)   # --accent
LINE = (245, 245, 240, 24)      # --line, flattened

HELVETICA = "/System/Library/Fonts/Helvetica.ttc"


def font(size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    """Helvetica Neue face; index 1 is the bold cut."""
    return ImageFont.truetype(HELVETICA, size, index=index)


def ivory_mark(size: int) -> Image.Image:
    """Recolour the source silhouette to ivory, preserving its alpha channel."""
    src = Image.open(SOURCE_MARK).convert("RGBA")
    alpha = src.split()[3]
    mark = Image.new("RGBA", src.size, INK)
    mark.putalpha(alpha)
    return mark.resize((size, size), Image.LANCZOS)


def rounded_icon(size: int, radius_ratio: float = 0.18) -> Image.Image:
    """Mark centred on a rounded near-black tile."""
    scale = 4  # supersample, then downsample for clean edges
    big = size * scale
    tile = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(tile).rounded_rectangle(
        (0, 0, big - 1, big - 1), radius=int(big * radius_ratio), fill=BG
    )

    inset = int(big * 0.14)
    mark = ivory_mark(big - inset * 2)
    tile.alpha_composite(mark, (inset, inset))

    return tile.resize((size, size), Image.LANCZOS)


def tracked_text(draw, xy, text, fnt, fill, tracking=0):
    """PIL has no letter-spacing, so advance manually per character."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking
    return x


def og_card() -> Image.Image:
    W, H = 1200, 630
    card = Image.new("RGBA", (W, H), BG)
    draw = ImageDraw.Draw(card)

    pad = 72

    # Hairline rails, echoing the .rail treatment on the site.
    draw.line([(pad, 0), (pad, H)], fill=LINE, width=1)
    draw.line([(W - pad, 0), (W - pad, H)], fill=LINE, width=1)
    draw.line([(0, H - 128), (W, H - 128)], fill=LINE, width=1)

    # Brand lockup
    mark = ivory_mark(52)
    card.alpha_composite(mark, (pad + 32, 64))
    tracked_text(
        draw, (pad + 96, 78), "BLKPVNTHR", font(25, 1), INK, tracking=1.4
    )
    draw.text((pad + 96 + 168, 78), " LLC", font=font(25, 0), fill=INK_FAINT)

    # Eyebrow
    tracked_text(
        draw,
        (pad + 32, 196),
        "MARYLAND · SECURE ANALYTICS · DECISION SYSTEMS",
        font(15),
        INK_FAINT,
        tracking=2.6,
    )

    # Headline
    headline = ["Decision intelligence", "for systems that matter."]
    y = 240
    for line in headline:
        draw.text((pad + 32, y), line, font=font(58, 1), fill=INK)
        y += 74

    # Accent rule — the single functional use of colour on the card.
    draw.line([(pad + 32, 412), (pad + 32 + 64, 412)], fill=ACCENT, width=3)

    # Supporting line
    draw.text(
        (pad + 32, 438),
        "Analytical engines · Research platforms · Decision support",
        font=font(22),
        fill=INK_MUTED,
    )

    # Footer
    draw.text((pad + 32, H - 88), "blkpvnthr.com", font=font(21, 1), fill=INK)
    tracked_text(
        draw,
        (W - pad - 262, H - 84),
        "MARYLAND, UNITED STATES",
        font(14),
        INK_FAINT,
        tracking=2.0,
    )

    return card


def main() -> None:
    if not SOURCE_MARK.exists():
        raise SystemExit(f"source mark not found: {SOURCE_MARK}")

    ASSETS.mkdir(parents=True, exist_ok=True)

    ivory_mark(512).save(ASSETS / "blkpvnthr-mark.png")
    for size in (32, 180, 512):
        rounded_icon(size).save(ASSETS / f"favicon-{size}.png")
    og_card().convert("RGB").save(ASSETS / "og-card.png", quality=95)

    for name in ("blkpvnthr-mark.png", "favicon-32.png", "favicon-180.png",
                 "favicon-512.png", "og-card.png"):
        path = ASSETS / name
        print(f"  {name:24} {path.stat().st_size / 1024:7.1f} KB")


if __name__ == "__main__":
    main()
