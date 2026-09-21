#!/usr/bin/env python3
"""Synchronize the public geometry copy in index.html with the 3D source."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from centrum_params import load_geometry


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"


def geometry_copy() -> dict[str, int]:
    source = load_geometry()
    required = ("SIZE", "R_HOLE", "R_BELT_HIGH", "LEVEL_1", "LEVEL_2", "TOP_THICK", "ENTRY_W")
    missing = [name for name in required if name not in source]
    if missing:
        raise SystemExit(f"Не хватает параметров геометрии: {', '.join(missing)}")

    return {
        "size": int(source["SIZE"]),
        "hole": int(source["R_HOLE"] * 2),
        "belt_depth": int(source["R_BELT_HIGH"] - source["R_HOLE"]),
        "level_1": int(source["LEVEL_1"]),
        "level_2": int(source["LEVEL_2"]),
        "niche": int(source["LEVEL_2"] - source["LEVEL_1"] - source["TOP_THICK"]),
        "entry": int(source["ENTRY_W"]),
    }


def update_index(values: dict[str, int]) -> bool:
    source = INDEX.read_text(encoding="utf-8")
    size = values["size"]
    replacements = (
        (r"\b(\d+)\s*[×x]\s*\1\s*мм\b", f"{size} × {size} мм"),
        (r"\b\d+\s*мм\b", None),
        (r"Ø\s*\d+(?:\s*мм)?", f"Ø{values['hole']} мм"),
        (r"\b\d+\s*/\s*\d+\s*мм\b", f"{values['level_1']} / {values['level_2']} мм"),
    )

    updated = source
    updated = re.sub(replacements[0][0], replacements[0][1], updated)
    updated = re.sub(r"Ø\s*\d+(?:\s*мм)?", replacements[2][1], updated)
    updated = re.sub(r"\b\d+\s*/\s*\d+\s*мм\b", replacements[3][1], updated)

    # Update only the known dimension phrases, leaving prices and unrelated copy intact.
    dimensions = (
        (r"\b820\s*мм\b", f"{values['level_1']} мм"),
        (r"\b1270\s*мм\b", f"{values['level_2']} мм"),
        (r"\b390\s*мм\b", f"{values['niche']} мм"),
        (r"\b800\s*мм\b", f"{values['entry']} мм"),
        (r"\b650\s*мм\b", f"{values['belt_depth']} мм"),
        (r"\b2900\s*мм\b", f"{size} мм"),
    )
    for pattern, replacement in dimensions:
        updated = re.sub(pattern, replacement, updated)

    if updated == source:
        return False
    INDEX.write_text(updated, encoding="utf-8")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Only report geometry values")
    args = parser.parse_args()

    values = geometry_copy()
    changed = False if args.dry_run else update_index(values)
    action = "would use" if args.dry_run else ("updated" if changed else "already current")
    print(
        f"{action}: geometry={values['size']}×{values['size']} мм, "
        f"hole=Ø{values['hole']} мм, levels={values['level_1']}/{values['level_2']} мм, "
        f"niche={values['niche']} мм, entry={values['entry']} мм, "
        f"belt={values['belt_depth']} мм"
    )


if __name__ == "__main__":
    main()
