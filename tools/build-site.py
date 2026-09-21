#!/usr/bin/env python3
"""Prepare the static site with the newest premium hero and detail renders."""

from __future__ import annotations

import argparse
import re
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
RENDER_DIR = ROOT / "output" / "render" / "premium"
LIGHT_OFF = RENDER_DIR / "led-wall-angle-off.png"
LIGHT_ON = RENDER_DIR / "led-wall-angle-on.png"
BRIDGE_OFF = RENDER_DIR / "bridge-front-closed-1600.png"
BRIDGE_ON = RENDER_DIR / "bridge-front-open-1600.png"
STORAGE_RENDER = RENDER_DIR / "drawers-detail-1600.png"
CONSTRUCTION_RENDER = RENDER_DIR / "camera-premium-01-three-quarter-1600.png"
ERGONOMICS_RENDER = RENDER_DIR / "camera-premium-02-workspace-1600.png"
FINISH_TEXTURES = {
    "Орех": ROOT / "assets" / "textures" / "tabletop-walnut.png",
    "Тёмный орех": ROOT / "assets" / "textures" / "pbr" / "smoked-walnut-veneer" / "diffuse.jpg",
    "Натуральный дуб": ROOT / "assets" / "textures" / "pbr" / "walnut-premium-generated" / "albedo.png",
    "Чёрный дуб": ROOT / "assets" / "textures" / "pbr" / "dark-oak-board" / "albedo.png",
}


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as image:
        if image.read(8) != b"\x89PNG\r\n\x1a\n":
            raise ValueError(f"Not a PNG file: {path}")
        image.seek(16)
        width, height = struct.unpack(">II", image.read(8))
    return width, height


def newest_hero() -> Path:
    candidates = sorted(
        (
            path
            for path in RENDER_DIR.glob("hero-*.png")
            if "preview" not in path.stem
        ),
        key=lambda path: path.stat().st_mtime_ns,
        reverse=True,
    )
    if not candidates:
        raise SystemExit(f"No hero renders found in {RENDER_DIR}")
    return candidates[0]


def newest_detail() -> Path:
    preferred = sorted(
        (
            path
            for path in RENDER_DIR.glob("camera-*-detail-*.png")
            if "preview" not in path.stem
        ),
        key=lambda path: path.stat().st_mtime_ns,
        reverse=True,
    )
    if preferred:
        return preferred[0]

    candidates = sorted(
        (
            path
            for path in RENDER_DIR.glob("*detail*.png")
            if "preview" not in path.stem and not path.name.startswith("led-")
        ),
        key=lambda path: path.stat().st_mtime_ns,
        reverse=True,
    )
    if not candidates:
        raise SystemExit(f"No detail renders found in {RENDER_DIR}")
    return candidates[0]


def update_index(
    hero: Path,
    detail: Path,
    storage: Path,
    construction: Path,
    ergonomics: Path,
    width: int,
    height: int,
) -> tuple[bool, bool]:
    source = INDEX.read_text(encoding="utf-8")
    hero_relative = hero.relative_to(ROOT).as_posix()
    detail_relative = detail.relative_to(ROOT).as_posix()
    hero_pattern = re.compile(
        r'(<div\s+class="hero-media">\s*<img\b[^>]*?\bsrc=")[^"]+'
        r'("[^>]*>)',
        re.DOTALL,
    )
    hero_match = hero_pattern.search(source)
    if not hero_match:
        raise SystemExit("Hero image tag was not found in index.html")

    updated_tag = f'{hero_match.group(1)}{hero_relative}{hero_match.group(2)}'
    updated_tag = re.sub(r'\bwidth="\d+"', f'width="{width}"', updated_tag, count=1)
    updated_tag = re.sub(r'\bheight="\d+"', f'height="{height}"', updated_tag, count=1)

    updated = source[: hero_match.start()] + updated_tag + source[hero_match.end() :]
    detail_pattern = re.compile(
        r'(<img\b(?=[^>]*\balt="Крупный план:)[^>]*\bsrc=")[^"]+'
        r'("[^>]*>)',
        re.DOTALL,
    )
    detail_match = detail_pattern.search(updated)
    if not detail_match:
        raise SystemExit("Detail image tag was not found in index.html")
    updated = (
        updated[: detail_match.start()]
        + f'{detail_match.group(1)}{detail_relative}{detail_match.group(2)}'
        + updated[detail_match.end() :]
    )

    storage_pattern = re.compile(
        r'(<img\b(?=[^>]*\bdata-storage-image)[^>]*\bsrc=")[^"]+'
        r'("[^>]*>)',
        re.DOTALL,
    )
    storage_match = storage_pattern.search(updated)
    if not storage_match:
        raise SystemExit("Storage image tag was not found in index.html")
    storage_relative = storage.relative_to(ROOT).as_posix()
    updated = (
        updated[: storage_match.start()]
        + f'{storage_match.group(1)}{storage_relative}{storage_match.group(2)}'
        + updated[storage_match.end() :]
    )

    construction_pattern = re.compile(
        r'(<img\b(?=[^>]*\bdata-construction-image)[^>]*\bsrc=")[^"]+'
        r'("[^>]*>)',
        re.DOTALL,
    )
    construction_match = construction_pattern.search(updated)
    if not construction_match:
        raise SystemExit("Construction image tag was not found in index.html")
    construction_relative = construction.relative_to(ROOT).as_posix()
    updated = (
        updated[: construction_match.start()]
        + f'{construction_match.group(1)}{construction_relative}{construction_match.group(2)}'
        + updated[construction_match.end() :]
    )

    ergonomics_pattern = re.compile(
        r'(<img\b(?=[^>]*\bdata-ergonomics-image)[^>]*\bsrc=")[^"]+'
        r'("[^>]*>)',
        re.DOTALL,
    )
    ergonomics_match = ergonomics_pattern.search(updated)
    if not ergonomics_match:
        raise SystemExit("Ergonomics image tag was not found in index.html")
    ergonomics_relative = ergonomics.relative_to(ROOT).as_posix()
    updated = (
        updated[: ergonomics_match.start()]
        + f'{ergonomics_match.group(1)}{ergonomics_relative}{ergonomics_match.group(2)}'
        + updated[ergonomics_match.end() :]
    )

    for label, texture in FINISH_TEXTURES.items():
        if not texture.exists():
            raise SystemExit(f"Finish texture not found for {label}: {texture}")
        texture_pattern = re.compile(
            rf'(<div\s+class="finish">\s*<img\s+class="swatch"\s+src=")[^"]+'
            rf'("\s+alt="[^"]*"\s*/>\s*<b>{re.escape(label)}</b>)',
            re.DOTALL,
        )
        texture_match = texture_pattern.search(updated)
        if not texture_match:
            raise SystemExit(f"Finish card was not found for {label}")
        texture_relative = texture.relative_to(ROOT).as_posix()
        updated = (
            updated[: texture_match.start()]
            + f'{texture_match.group(1)}{texture_relative}{texture_match.group(2)}'
            + updated[texture_match.end() :]
        )

    light_changed = False
    for state, path in (("off", LIGHT_OFF), ("on", LIGHT_ON)):
        if not path.exists():
            continue
        relative = path.relative_to(ROOT).as_posix()
        light_pattern = re.compile(
            rf'(<img\b(?=[^>]*\bdata-light-state="{state}")[^>]*\bsrc=")[^"]+'
            rf'("[^>]*\bdata-light-src=")[^"]+(")',
            re.DOTALL,
        )
        light_match = light_pattern.search(updated)
        if not light_match:
            raise SystemExit(f"LED {state} image tag was not found in index.html")
        replacement = (
            f'{light_match.group(1)}{relative}{light_match.group(2)}{relative}{light_match.group(3)}'
        )
        next_updated = (
            updated[: light_match.start()]
            + replacement
            + updated[light_match.end() :]
        )
        light_changed = light_changed or next_updated != updated
        updated = next_updated

    for state, path in (("off", BRIDGE_OFF), ("on", BRIDGE_ON)):
        if not path.exists():
            continue
        relative = path.relative_to(ROOT).as_posix()
        bridge_pattern = re.compile(
            rf'(<img\b(?=[^>]*\bdata-bridge-state="{state}")[^>]*\bsrc=")[^"]+'
            rf'("[^>]*\bdata-bridge-src=")[^"]+',
            re.DOTALL,
        )
        bridge_match = bridge_pattern.search(updated)
        if not bridge_match:
            raise SystemExit(f"Bridge {state} image tag was not found in index.html")
        replacement = f'{bridge_match.group(1)}{relative}{bridge_match.group(2)}{relative}'
        next_updated = updated[: bridge_match.start()] + replacement + updated[bridge_match.end() :]
        light_changed = light_changed or next_updated != updated
        updated = next_updated

    if updated == source:
        return False, light_changed
    INDEX.write_text(updated, encoding="utf-8")
    return True, light_changed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Only report the selected render")
    args = parser.parse_args()

    hero = newest_hero()
    detail = newest_detail()
    storage = STORAGE_RENDER
    if not storage.exists():
        raise SystemExit(f"Storage render not found: {storage}")
    construction = CONSTRUCTION_RENDER
    if not construction.exists():
        raise SystemExit(f"Construction render not found: {construction}")
    ergonomics = ERGONOMICS_RENDER
    if not ergonomics.exists():
        raise SystemExit(f"Ergonomics render not found: {ergonomics}")
    width, height = png_size(hero)
    if args.dry_run:
        changed = False
        light_changed = False
    else:
        changed, light_changed = update_index(hero, detail, storage, construction, ergonomics, width, height)
    action = "updated" if changed else "already current"
    if args.dry_run:
        action = "would use"
    print(f"{action}: hero={hero.relative_to(ROOT)} ({width}×{height})")
    print(f"{action}: detail={detail.relative_to(ROOT)}")
    print(f"{action}: storage={storage.relative_to(ROOT)}")
    print(f"{action}: construction={construction.relative_to(ROOT)}")
    print(f"{action}: ergonomics={ergonomics.relative_to(ROOT)}")
    for label, texture in FINISH_TEXTURES.items():
        print(f"{action}: {label}={texture.relative_to(ROOT)}")
    for state, path in (("off", LIGHT_OFF), ("on", LIGHT_ON)):
        status = "available" if path.exists() else "waiting"
        if light_changed and path.exists() and not args.dry_run:
            status = "updated"
        print(f"{action}: LED {state}={status} ({path.relative_to(ROOT)})")
    for state, path in (("off", BRIDGE_OFF), ("on", BRIDGE_ON)):
        status = "available" if path.exists() else "waiting"
        if light_changed and path.exists() and not args.dry_run:
            status = "updated"
        print(f"{action}: bridge {state}={status} ({path.relative_to(ROOT)})")


if __name__ == "__main__":
    main()
