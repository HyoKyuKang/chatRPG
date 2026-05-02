#!/usr/bin/env python3
"""Resize /tmp/icon.png → 512 (Play Console) + 432 adaptive foreground (Android)."""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow not installed. Run: pip install Pillow", file=sys.stderr)
    sys.exit(1)

SRC = Path("/tmp/icon.png")
DST_DIR = Path("notes/store-assets")

def main() -> int:
    if not SRC.exists():
        print(f"Source not found: {SRC}. Run scripts/gen-icon.ts first.", file=sys.stderr)
        return 1
    DST_DIR.mkdir(parents=True, exist_ok=True)
    with Image.open(SRC) as img:
        if img.mode != "RGB":
            img = img.convert("RGB")
        # 512×512 (Play Console)
        out512 = DST_DIR / "icon-512.png"
        img.resize((512, 512), Image.LANCZOS).save(out512, "PNG", optimize=True)
        size_kb = out512.stat().st_size / 1024
        print(f"✓ {out512} ({size_kb:.0f} KB) — Play Console upload")
        # 432×432 adaptive foreground (Android Studio recommended)
        out432 = DST_DIR / "icon-432-foreground.png"
        img.resize((432, 432), Image.LANCZOS).save(out432, "PNG", optimize=True)
        size_kb = out432.stat().st_size / 1024
        print(f"✓ {out432} ({size_kb:.0f} KB) — Android adaptive foreground")
        # 192×192 mipmap-xxxhdpi
        out192 = DST_DIR / "icon-192.png"
        img.resize((192, 192), Image.LANCZOS).save(out192, "PNG", optimize=True)
        print(f"✓ {out192} — Android mipmap-xxxhdpi launcher")
    return 0

if __name__ == "__main__":
    sys.exit(main())
