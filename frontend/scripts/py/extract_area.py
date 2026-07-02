#!/usr/bin/env python3
"""Extract land area from area.pdf and map to PSGC codes.

Outputs: frontend/data-sets/data/clean/pdf_land_area.json
Run: scripts/py/.venv/bin/python scripts/py/extract_area.py
"""

import fitz
import re
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
FRONTEND = os.path.abspath(os.path.join(HERE, "..", ".."))
PDF_NAME = "2010-2015-2020 Population Density_Table A_Using 2013 Land Areas_12 July 2021.pdf"
PDF_PATH = os.path.join(FRONTEND, "data-sets", "source", PDF_NAME)
if not os.path.exists(PDF_PATH):
    PDF_PATH = os.path.join(FRONTEND, "data-sets", "source", "area.pdf")

POPCEN_CSV = os.path.join(FRONTEND, "data-sets", "data", "clean", "popcen_2010_2024.csv")
OUT_JSON = os.path.join(FRONTEND, "data-sets", "data", "clean", "pdf_land_area.json")

ABBREV = {
    'STO': 'SANTO',
    'STA': 'SANTA',
    'STO.': 'SANTO',
    'STA.': 'SANTA',
    'GEN': 'GENERAL',
    'MT': 'MOUNT',
}

def norm_strict(name):
    if name is None: return ''
    s = str(name).upper().strip()
    s = s.replace('Ñ', 'N').replace('Ã\'', 'N')
    s = re.sub(r'\(CAPITAL\)', ' ', s)
    s = re.sub(r'\(.*?\)', ' ', s)
    s = ' '.join(s.split())
    s = re.sub(r'[^A-Z0-9 ]', ' ', s)
    s = ' '.join(s.split())
    toks = [ABBREV.get(t, t) for t in s.split()]
    toks = [t for t in toks if not t.isdigit()]
    return ' '.join(toks).strip()

def norm_loose(name):
    s = norm_strict(name)
    s = re.sub(r'\bCITY OF\b', ' ', s)
    s = re.sub(r'\bCITY\b', ' ', s)
    return ' '.join(s.split())

def is_num_token(s):
    s = s.strip()
    if not s: return False
    s = re.sub(r'[a-zA-Z]\d+/', '', s)
    s = s.strip()
    s = s.replace(',', '')
    if s.startswith('(') and s.endswith(')'): s = s[1:-1].strip()
    if s in ('-', '—', '...'): return True
    try:
        float(s)
        return True
    except ValueError: return False

def parse_int(s):
    s = re.sub(r'[a-zA-Z]\d+/', '', s).strip().replace(',', '')
    try: return int(s)
    except: return 0

ignore_words = {
    'table', 'population', 'density', 'persons', 'percent', 'change', 'land', 'area',
    'square', 'kilometers', 'kilometers)', '2010', '2015', '2020', '2010-2015',
    '2010-2020', '2015-2020', 'a1/', 'a2/', 'a3/', 'region,', 'province/highly',
    'urbanized', 'city,', 'and', 'city/municipality', 'philippines', 'ncr)', 'car)'
}

def clean_token(t):
    return t.lower().strip().replace('*', '').replace('(', '').replace(')', '')

def main():
    print("Loading spine from popcen CSV...")
    country_strict = {}
    country_loose = {}
    regions_strict = {}
    regions_loose = {}
    provinces = {}
    municities_strict = {}
    municities_loose = {}
    all_spine = {}

    with open(POPCEN_CSV, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            lvl = row['level']
            name = row['name']
            psgc = row['psgc']
            pop2020 = parse_int(row['pop_2020'])
            ns = norm_strict(name)
            nl = norm_loose(name)
            if lvl != 'barangay':
                all_spine[psgc] = (lvl, name)
                if lvl == 'country':
                    country_strict[ns] = psgc
                    country_loose[nl] = psgc
                elif lvl == 'region':
                    regions_strict[ns] = psgc
                    regions_loose[nl] = psgc
                elif lvl == 'province':
                    provinces[psgc] = {'name_strict': ns, 'name_loose': nl, 'reg': psgc[:2] + '00000000', 'pop_2020': pop2020}
                elif lvl == 'municipality':
                    if ns not in municities_strict: municities_strict[ns] = []
                    municities_strict[ns].append((psgc, name))
                    if nl not in municities_loose: municities_loose[nl] = []
                    municities_loose[nl].append((psgc, name))

    print(f"Loaded {len(all_spine)} countries/regions/provinces/municipalities.")

    print(f"Opening PDF: {PDF_PATH}...")
    doc = fitz.open(PDF_PATH)
    extracted = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        tokens = [t.strip() for t in page.get_text('text').split('\n') if t.strip()]
        
        i = 0
        row_starts = []
        while i < len(tokens) - 10:
            if not is_num_token(tokens[i]) and all(is_num_token(tokens[i+j]) for j in range(1, 11)):
                row_starts.append(i)
                i += 11
            else:
                i += 1
                
        for start_idx in row_starts:
            name_parts = [tokens[start_idx]]
            for step in range(1, 4):
                look_idx = start_idx - step
                if look_idx < 0: break
                prev_tok = tokens[look_idx]
                if is_num_token(prev_tok): break
                words = [clean_token(w) for w in prev_tok.split()]
                if any(w in ignore_words for w in words) or prev_tok.startswith(('Table', 'Region', 'Population', 'Percent')):
                    break
                name_parts.insert(0, prev_tok)
            
            name = ' '.join(name_parts)
            area_str = tokens[start_idx + 4]
            pop_2020_str = tokens[start_idx + 3]
            words = [clean_token(w) for w in name.split()]
            if not any(w in ignore_words for w in words) or 'bangsamoro' in name.lower() or 'capital region' in name.lower() or 'administrative region' in name.lower():
                extracted.append((name, area_str, pop_2020_str))

    print(f"Extracted {len(extracted)} potential rows from PDF.")

    current_reg_psgc = None
    current_prov_psgc = None

    special_mappings = {
        'BALIUAG': '0301403000',
        'PIO V CORPUZ': '0504116000',
        'BACUNGAN': '0907226000',
        'BULAKAN': '0301405000',
    }

    mapped = {}
    unmatched = []

    duplicate_provinces = {'AURORA', 'RIZAL', 'QUIRINO', 'SARANGANI', 'SIQUIJOR', 'LEYTE', 'BILIRAN', 'ROMBLON', 'QUEZON', 'BULACAN'}

    for name, area_str, pop_2020_str in extracted:
        ns = norm_strict(name)
        nl = norm_loose(name)
        area_val = float(area_str.replace(',', '')) if area_str not in ('-', '—', '...') else 0.0
        pdf_pop_2020 = parse_int(pop_2020_str)
        
        psgc = None
        
        # 1. Match country
        if ns in country_strict:
            psgc = country_strict[ns]
        elif nl in country_loose:
            psgc = country_loose[nl]
            
        # 2. Match region
        if not psgc:
            if ns in regions_strict:
                psgc = regions_strict[ns]
            elif nl in regions_loose:
                psgc = regions_loose[nl]
            
        if psgc:
            if psgc == '0000000000':
                current_reg_psgc = None
                current_prov_psgc = None
            else:
                current_reg_psgc = psgc
                current_prov_psgc = None
        else:
            # 3. Match province
            prov_match = None
            if 'CITY' not in name.upper():
                for p_psgc, p_info in provinces.items():
                    name_matches = (p_info['name_strict'] == ns) or (p_info['name_loose'] == nl)
                    if name_matches:
                        is_correct_reg = (p_info['reg'] == current_reg_psgc) or \
                                         (p_psgc == '1804500000' and current_reg_psgc == '0600000000') or \
                                         (p_psgc in ('1804600000', '1806100000') and current_reg_psgc == '0700000000') or \
                                         (p_psgc == '0906600000' and current_reg_psgc == '1900000000')
                        if is_correct_reg:
                            is_dup = (p_info['name_strict'] in duplicate_provinces) or (p_info['name_loose'] in duplicate_provinces)
                            if not is_dup or abs(p_info['pop_2020'] - pdf_pop_2020) < 40000:
                                prov_match = p_psgc
                                break
            if prov_match:
                psgc = prov_match
                current_prov_psgc = psgc
            elif ns in special_mappings:
                psgc = special_mappings[ns]
            elif nl in special_mappings:
                psgc = special_mappings[nl]
            elif nl == 'RIZAL' and current_prov_psgc == '1705300000':
                psgc = '1705323000'
            else:
                # 3. Match municipality
                candidates = []
                if ns in municities_strict: candidates.extend(municities_strict[ns])
                if nl in municities_loose:
                    for c in municities_loose[nl]:
                        if c not in candidates: candidates.append(c)
                        
                if candidates:
                    if current_prov_psgc:
                        prov_prefix = current_prov_psgc[:5]
                        matches = [c for c in candidates if c[0].startswith(prov_prefix)]
                        if matches: psgc = matches[0][0]
                    if not psgc and current_reg_psgc:
                        reg_prefix = current_reg_psgc[:2]
                        matches = [c for c in candidates if c[0].startswith(reg_prefix)]
                        if matches: psgc = matches[0][0]
                    if not psgc:
                        psgc = candidates[0][0]
                        
        if psgc:
            mapped[psgc] = area_val
        else:
            unmatched.append((name, ns, area_val))

    # Manually map the country tier (Philippines) statutory area as defined in Table A: 300000.00 km2
    mapped['0000000000'] = 300000.00

    print(f"Mapped {len(mapped)} unique geographic elements directly.")

    # 4. Handle split provinces (Maguindanao del Norte/del Sur) by summing constituent municipalities
    print("Summing municipal areas for Maguindanao del Norte/del Sur...")
    for prov_psgc in ('1908700000', '1908800000'):
        prov_prefix = prov_psgc[:5]
        total_area = sum(area for psgc, area in mapped.items() if psgc.startswith(prov_prefix) and psgc != prov_psgc)
        mapped[prov_psgc] = round(total_area, 2)
        print(f"  {provinces[prov_psgc]['name_strict']} area: {mapped[prov_psgc]} km²")

    # 5. Handle Negros Island Region (NIR) by summing Negros Occidental, Negros Oriental, and Siquijor
    print("Summing provincial areas for Negros Island Region (NIR)...")
    total_nir_area = mapped.get('1804500000', 0.0) + mapped.get('1804600000', 0.0) + mapped.get('1806100000', 0.0)
    mapped['1800000000'] = round(total_nir_area, 2)
    print(f"  Negros Island Region (NIR) area: {mapped['1800000000']} km²")

    # 6. Save to JSON file
    print(f"Saving mappings to {OUT_JSON}...")
    with open(OUT_JSON, 'w') as f:
        json.dump(mapped, f, indent=4)

    # 7. Print final statistics
    unmapped_count = 0
    for psgc, (lvl, name) in all_spine.items():
        if psgc not in mapped:
            unmapped_count += 1
            
    print(f"Data extraction complete. Total unmapped spine elements: {unmapped_count}")
    print("Unmapped spine elements (excluding Kapalawan SGA municipalities):")
    for psgc, (lvl, name) in all_spine.items():
        if psgc not in mapped and not psgc.startswith('19999'):
            print(f"  {lvl} {name} ({psgc})")

if __name__ == '__main__':
    main()
