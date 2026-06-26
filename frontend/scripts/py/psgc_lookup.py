"""Load PSGC CSV into lookup maps for barangay enrichment."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path


@dataclass
class PsgcEntry:
    psgc: str
    name: str
    correspondence: str | None
    geo_lvl: str
    city_lvl: str | None


def pad_psgc(code: str | int | float | None) -> str | None:
    if code is None or code == "":
        return None
    raw = str(code).strip()
    if raw.endswith(".0"):
        raw = raw[:-2]
    digits = "".join(c for c in raw if c.isdigit())
    if not digits:
        return None
    return digits.zfill(10)


def load_psgc_csv(csv_path: Path) -> tuple[dict[str, PsgcEntry], dict[str, PsgcEntry]]:
    """Returns (by_psgc, by_correspondence) maps for Bgy and SubMun rows."""
    by_psgc: dict[str, PsgcEntry] = {}
    by_corr: dict[str, PsgcEntry] = {}

    with csv_path.open(encoding="utf-8-sig", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            geo = (row.get("Geographic Level") or "").strip()
            if geo not in ("Bgy", "SubMun"):
                continue
            psgc = pad_psgc(row.get("10-digit PSGC"))
            if not psgc:
                continue
            corr_raw = (row.get("Correspondence Code") or "").strip()
            corr_digits = "".join(c for c in corr_raw if c.isdigit())
            corr = corr_digits.zfill(9) if corr_digits else None
            city = (row.get("City Class") or "").strip() or None
            entry = PsgcEntry(
                psgc=psgc,
                name=(row.get("Name") or "").strip(),
                correspondence=corr,
                geo_lvl=geo,
                city_lvl=city,
            )
            by_psgc[psgc] = entry
            if corr:
                by_corr[corr] = entry

    return by_psgc, by_corr


def correspondence_candidates(code_value: str | int | float | None) -> list[str]:
    """Generate 9-digit correspondence-code candidates for a shapefile code.

    Some shapefiles (e.g. NIR-renumbered regions) encode the old region code
    with the leading zero swapped: corr ``064502001`` appears as ``604502001``.
    Swapping the first two digits of the 9-digit form recovers the match.
    """
    if code_value is None:
        return []
    digits = "".join(c for c in str(code_value).strip() if c.isdigit())
    if not digits:
        return []

    candidates: list[str] = []

    def add(value: str) -> None:
        if value and len(value) == 9 and value not in candidates:
            candidates.append(value)

    nine = digits.zfill(9)[-9:]
    add(nine)
    add(digits.lstrip("0").zfill(9))
    # Swap first two digits (handles "0"+region encoded as region+"0").
    add(nine[1] + nine[0] + nine[2:])
    return candidates


def resolve_psgc_from_record(
    code_value: str | int | float | None,
    by_psgc: dict[str, PsgcEntry],
    by_corr: dict[str, PsgcEntry],
) -> tuple[str | None, PsgcEntry | None]:
    """Resolves a shapefile code to a 10-digit PSGC and CSV entry."""
    psgc10 = pad_psgc(code_value)
    if psgc10 and psgc10 in by_psgc:
        return psgc10, by_psgc[psgc10]

    if psgc10:
        corr9 = psgc10.lstrip("0")[:9].zfill(9)
        if corr9 in by_corr:
            entry = by_corr[corr9]
            return entry.psgc, entry

    for corr9 in correspondence_candidates(code_value):
        if corr9 in by_corr:
            entry = by_corr[corr9]
            return entry.psgc, entry

    return psgc10, None
