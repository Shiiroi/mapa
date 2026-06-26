#!/usr/bin/env python3
"""Extract COA CY2024 AFR Financial Profile tables (PDF pages 172-234) to CSV."""

from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

try:
    import fitz  # pymupdf
except ImportError:
    print("ERROR: pymupdf required. Run: pip install pymupdf", file=sys.stderr)
    sys.exit(1)

SCRIPT_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = SCRIPT_DIR / "../../public"
PDF_PATH = PUBLIC_DIR / "afr.pdf"
RAW_CSV = PUBLIC_DIR / "lgu_finance_2024_raw.csv"
SUBTOTAL_CSV = PUBLIC_DIR / "lgu_finance_2024_subtotals.csv"

PAGE_START = 172  # 1-based PDF viewer page
PAGE_END = 234

COLUMNS = [
    "level",
    "region",
    "province",
    "name",
    "assets",
    "liabilities",
    "equity",
    "revenue",
    "expenses",
    "net_assistance_subsidy",
    "surplus_deficit",
    "cash_begin",
    "net_cash",
    "cash_end",
]

ROW_RE = re.compile(r"^(\d+)\s+(.+)$")
VALUE_RE = re.compile(r"^-$|^\([\d,]+\)$|^[\d,]+$")
REGION_RE = re.compile(r"^CAR$|^BARMM$|^NCR$|^REGION\s+", re.I)
SUBTOTAL_RE = re.compile(r"^(Regional Total|Sub-Total)$", re.I)

HEADER_FRAGMENTS = (
    "Republic of the Philippines",
    "Financial Profile",
    "Calendar Year",
    "thousand pesos",
    "Financial Position",
    "Financial Performance",
    "Cash Position",
    "Net Cash",
    "Provided by",
    "Cash Balance",
    "Net Financial",
    "Assistance/",
    "Subsidy",
    "Surplus",
    "Deficit",
    "Beginning",
    "Ending",
    "Assets",
    "Liabilities",
    "Equity",
    "Revenue",
    "Expenses",
    "Provinces",
    "Cities",
    "Municipalities",
    "PART III",
    "FINANCIAL PROFILE",
    "LOCAL GOVERNMENT",
    "Component Unit",
)


def parse_value(token: str) -> int | None:
    token = token.strip()
    if token == "-":
        return None
    negative = token.startswith("(") and token.endswith(")")
    if negative:
        token = token[1:-1]
    digits = token.replace(",", "")
    if not digits.isdigit():
        return None
    n = int(digits)
    return -n if negative else n


def is_header_line(line: str) -> bool:
    if not line or line.isdigit():
        return True
    if line.startswith("-- ") and " of " in line:
        return True
    return any(frag in line for frag in HEADER_FRAGMENTS)


def read_ten_values(lines: list[str], idx: int) -> tuple[list[int | None], int]:
    values: list[int | None] = []
    while idx < len(lines) and len(values) < 10:
        line = lines[idx]
        if VALUE_RE.match(line):
            values.append(parse_value(line))
            idx += 1
        else:
            break
    return values, idx


def detect_section(line: str) -> str | None:
    lower = line.lower()
    if "financial profile - provinces" in lower:
        return "province"
    if "financial profile - cities" in lower:
        return "city"
    if "financial profile - municipalities" in lower:
        return "municipality"
    stripped = line.strip()
    if stripped == "Provinces":
        return "province"
    if stripped == "Cities":
        return "city"
    if stripped == "Municipalities":
        return "municipality"
    return None


def load_known_provinces() -> set[str]:
    import csv

    psgc_path = PUBLIC_DIR / "psgc.csv"
    names: set[str] = set()
    aliases = {
        "MT. PROVINCE": "MOUNTAIN PROVINCE",
        "NUEVA VIScAYA": "NUEVA VIZCAYA",
        "NUEVA VISAYA": "NUEVA VIZCAYA",
    }
    with psgc_path.open(encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f):
            if row.get("Geographic Level", "").strip() != "Prov":
                continue
            name = row.get("Name", "").strip().upper()
            if name:
                names.add(name)
    for alias, canonical in aliases.items():
        if canonical in names:
            names.add(alias)
    return names


KNOWN_PROVINCES: set[str] | None = None


def is_province_header(line: str, section: str | None) -> bool:
    global KNOWN_PROVINCES
    if KNOWN_PROVINCES is None:
        KNOWN_PROVINCES = load_known_provinces()
    if section != "municipality":
        return False
    if ROW_RE.match(line) or VALUE_RE.match(line) or REGION_RE.match(line):
        return False
    if SUBTOTAL_RE.match(line) or is_header_line(line):
        return False
    if "(" in line or ")" in line:
        return False
    if len(line) < 2:
        return False
    if not re.match(r"^[\w\s.\-ñÑ']+$", line):
        return False
    upper = line.strip().upper()
    if upper not in KNOWN_PROVINCES:
        return False
    return True


def extract_lines(pdf_path: Path) -> list[str]:
    doc = fitz.open(pdf_path)
    out: list[str] = []
    for pno in range(PAGE_START - 1, PAGE_END):
        if pno >= len(doc):
            break
        text = doc[pno].get_text()
        for line in text.splitlines():
            s = line.strip()
            if s:
                out.append(s)
    return out


def main() -> None:
    if not PDF_PATH.exists():
        print(f"ERROR: missing {PDF_PATH}", file=sys.stderr)
        sys.exit(1)

    lines = extract_lines(PDF_PATH)
    rows: list[dict[str, object]] = []
    subtotals: list[dict[str, object]] = []

    section: str | None = None
    region = ""
    province = ""
    skip_component = False
    i = 0

    while i < len(lines):
        line = lines[i]

        sec = detect_section(line)
        if sec:
            section = sec
            if section != "municipality":
                province = ""
            i += 1
            continue

        if "Component Unit" in line:
            skip_component = True
            i += 1
            continue

        if REGION_RE.match(line):
            region = line.strip()
            i += 1
            continue

        if SUBTOTAL_RE.match(line):
            name = line.strip()
            values, i = read_ten_values(lines, i + 1)
            if len(values) == 10:
                entry = {
                    "level": section or "",
                    "region": region,
                    "province": province,
                    "name": name,
                }
                for col, val in zip(COLUMNS[4:], values):
                    entry[col] = val
                subtotals.append(entry)
            if name.lower() == "regional total":
                skip_component = False
            continue

        if is_province_header(line, section):
            province = line.strip()
            i += 1
            continue

        m = ROW_RE.match(line)
        if m and section and not skip_component:
            name = m.group(2).strip()
            values, i = read_ten_values(lines, i + 1)
            if len(values) == 10:
                entry: dict[str, object] = {
                    "level": section,
                    "region": region,
                    "province": province if section == "municipality" else "",
                    "name": name,
                }
                for col, val in zip(COLUMNS[4:], values):
                    entry[col] = val
                rows.append(entry)
            continue

        i += 1

    RAW_CSV.parent.mkdir(parents=True, exist_ok=True)
    with RAW_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)

    with SUBTOTAL_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(subtotals)

    by_level: dict[str, int] = {}
    for r in rows:
        by_level[r["level"]] = by_level.get(r["level"], 0) + 1

    print(f"Wrote {len(rows)} rows -> {RAW_CSV.relative_to(PUBLIC_DIR.parent)}")
    print(f"Wrote {len(subtotals)} subtotals -> {SUBTOTAL_CSV.name}")
    for lvl, n in sorted(by_level.items()):
        print(f"  {lvl}: {n}")

    # Spot checks
    checks = [
        ("municipality", "Mambajao", 428381),
        ("city", "Cebu", 31402949),
        ("province", "Benguet", 6658318),
    ]
    for lvl, name, expected_assets in checks:
        hit = next(
            (r for r in rows if r["level"] == lvl and r["name"] == name),
            None,
        )
        if hit and hit["assets"] == expected_assets:
            print(f"  OK spot check: {name} assets={expected_assets:,}")
        else:
            got = hit["assets"] if hit else "MISSING"
            print(f"  WARN spot check: {name} expected {expected_assets:,} got {got}", file=sys.stderr)


if __name__ == "__main__":
    main()
