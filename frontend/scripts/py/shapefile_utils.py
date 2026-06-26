"""Shared helpers for reading and validating ESRI shapefiles."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import shapefile  # pyshp


REQUIRED_EXTENSIONS = (".shp", ".shx", ".dbf", ".prj")


def resolve_shapefile_base(path: str | Path) -> Path:
    """Normalizes a path to the pyshp base (companions are {base}.shp/.dbf/.shx/.prj)."""
    p = Path(path)
    # e.g. PH_Adm4_BgySubMuns.shp.shp -> base PH_Adm4_BgySubMuns.shp
    if p.name.endswith(".shp.shp"):
        return p.parent / p.name[:-4]
    # e.g. PH_Adm4_BgySubMuns.shp when PH_Adm4_BgySubMuns.shp.shp exists
    if p.suffix == ".shp" and (p.parent / f"{p.name}.shp").exists():
        return p
    # standard: regions.shp -> base regions
    if p.suffix == ".shp":
        return p.with_suffix("")
    return p


def companion_path(base: Path, ext: str) -> Path:
    """Returns companion file path (handles double-.shp naming)."""
    return Path(str(base) + ext)


def verify_shapefile_set(base: Path) -> None:
    """Fails loudly if any required companion file is missing."""
    missing = [ext for ext in REQUIRED_EXTENSIONS if not companion_path(base, ext).exists()]
    if missing:
        print(f"ERROR: incomplete shapefile set for {base}", file=sys.stderr)
        for ext in missing:
            print(f"  missing: {base}{ext}", file=sys.stderr)
        sys.exit(1)


def read_prj_wkt(base: Path) -> str:
    return companion_path(base, ".prj").read_text(encoding="utf-8", errors="replace").strip()


def shp_path(base: Path) -> Path:
    return Path(str(base) + ".shp")


def open_reader(base: Path) -> shapefile.Reader:
    verify_shapefile_set(base)
    return shapefile.Reader(str(shp_path(base)), encoding="latin-1", encodingErrors="replace")


def field_names(reader: shapefile.Reader) -> list[str]:
    return [f[0] for f in reader.fields[1:]]


def record_as_dict(reader: shapefile.Reader, record: tuple) -> dict:
    names = field_names(reader)
    return {names[i]: record[i] for i in range(len(names))}
