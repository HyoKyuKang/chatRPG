#!/usr/bin/env python3
"""Convert /tmp/portraits/*.png → public/portraits/*.webp (quality 85)."""

import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow not installed. Run: pip install Pillow", file=sys.stderr)
    sys.exit(1)

SRC = Path("/tmp/portraits")
DST = Path("public/portraits")
QUALITY = 85

def main() -> int:
    if not SRC.exists():
        print(f"Source dir not found: {SRC}", file=sys.stderr)
        return 1
    DST.mkdir(parents=True, exist_ok=True)
    pngs = sorted(SRC.glob("*.png"))
    if not pngs:
        print(f"No PNG files in {SRC}", file=sys.stderr)
        return 1
    for png in pngs:
        out = DST / f"{png.stem}.webp"
        with Image.open(png) as img:
            # Convert RGBA → RGB (DALL-E 3 PNGs are RGB but be safe)
            if img.mode != "RGB":
                img = img.convert("RGB")
            img.save(out, "WEBP", quality=QUALITY, method=6)
        in_kb = png.stat().st_size / 1024
        out_kb = out.stat().st_size / 1024
        print(f"  {png.name} ({in_kb:.0f} KB) → {out.name} ({out_kb:.0f} KB)")
    print(f"\n✓ {len(pngs)} portraits converted to {DST}/")
    return 0

if __name__ == "__main__":
    sys.exit(main())
