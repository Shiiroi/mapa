// AFR name normalization and PSGC lookup indexes for COA CY2024 financial data.

import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";

interface MunicityMetaRow {
    psgc: string;
    name: string;
    geo_lvl: string;
    province_psgc: string | null;
    region_psgc: string | null;
}

export const AFR_REGION_TO_PSGC: Record<string, string> = {
    CAR: "1400000000",
    BARMM: "1900000000",
    NCR: "1300000000",
    "REGION I": "0100000000",
    "REGION II": "0200000000",
    "REGION III": "0300000000",
    "REGION IV-A": "0400000000",
    "REGION IV-B": "1700000000",
    "REGION V": "0500000000",
    "REGION VI": "0600000000",
    "REGION VII": "0700000000",
    "REGION VIII": "0800000000",
    "REGION IX": "0900000000",
    "REGION X": "1000000000",
    "REGION XI": "1100000000",
    "REGION XII": "1200000000",
    "REGION XIII": "1600000000",
};

/** Census / household xlsx region labels -> AFR region key. */
export const CENSUS_REGION_LABEL_TO_AFR: Record<string, string> = {
    PHILIPPINES: "PHILIPPINES",
    "NATIONAL CAPITAL REGION (NCR)": "NCR",
    "NATIONAL CAPITAL REGION": "NCR",
    "CORDILLERA ADMINISTRATIVE REGION (CAR)": "CAR",
    "CORDILLERA ADMINISTRATIVE REGION": "CAR",
    "REGION I (ILOCOS REGION)": "REGION I",
    "REGION II (CAGAYAN VALLEY)": "REGION II",
    "REGION III (CENTRAL LUZON)": "REGION III",
    "REGION IV-A (CALABARZON)": "REGION IV-A",
    CALABARZON: "REGION IV-A",
    "REGION IV-B (MIMAROPA)": "REGION IV-B",
    "MIMAROPA REGION": "REGION IV-B",
    MIMAROPA: "REGION IV-B",
    "REGION V (BICOL REGION)": "REGION V",
    "REGION VI (WESTERN VISAYAS)": "REGION VI",
    "REGION VII (CENTRAL VISAYAS)": "REGION VII",
    "NEGROS ISLAND REGION (NIR)": "NIR",
    "NEGROS ISLAND REGION": "NIR",
    "REGION VIII (EASTERN VISAYAS)": "REGION VIII",
    "REGION IX (ZAMBOANGA PENINSULA)": "REGION IX",
    "REGION X (NORTHERN MINDANAO)": "REGION X",
    "REGION XI (DAVAO REGION)": "REGION XI",
    "REGION XII (SOCCSKSARGEN)": "REGION XII",
    "REGION XIII (CARAGA)": "REGION XIII",
    CARAGA: "REGION XIII",
    "BANGSAMORO AUTONOMOUS REGION IN MUSLIM MINDANAO (BARMM)": "BARMM",
    "BANGSAMORO AUTONOMOUS REGION IN MUSLIM MINDANAO": "BARMM",
    BARMM: "BARMM",
};

/** Scoped aliases: "province|name" -> canonical normalized PSGC name. */
const SCOPED_ALIASES: Record<string, string> = {
    "lanao del norte|r. magsaysay": "MAGSAYSAY",
    "lanao del norte|s.n. dimaporo": "SULTAN NAGA DIMAPORO",
    "rizal|rodriguez": "RODRIGUEZ",
    "rizal|montalban": "RODRIGUEZ",
    "sulu|panamao": "OLD PANAMAO",
    "sulu|panglima omar": "OMAR",
    "sulu|parang": "PARANG",
    "sulu|tongkil (banguingui)": "TONGKIL",
    "basilan|tipo-tipo|tuburan": "TUBURAN",
};

const PROVINCE_ALIASES: Record<string, string> = {
    "MT. PROVINCE": "MOUNTAIN PROVINCE",
    "NUEVA VIScAYA": "NUEVA VIZCAYA",
    "NUEVA VISAYA": "NUEVA VIZCAYA",
    "TIPO-TIPO": "BASILAN",
    "SOUTH UBIAN": "TAWI-TAWI",
    "NORTH COTABATO": "COTABATO",
};

/** Global aliases after normalization. */
const GLOBAL_ALIASES: Record<string, string> = {
    "R. MAGSAYSAY": "RODRIGUEZ",
    "S.N. DIMAPORO": "SULTAN NAGA DIMAPORO",
    "MONTALBAN": "RODRIGUEZ",
    "MENDEZ-NUÑEZ": "MENDEZ",
    "MENDEZ-NUNEZ": "MENDEZ",
    "MENDEZ NUNEZ": "MENDEZ",
    "DONA REMEDIOS TRINIDAD": "DOÑA REMEDIOS TRINIDAD",
    "SCIENCE CITY OF MUNOZ": "SCIENCE CITY OF MUÑOZ",
    "G. DEL PILAR": "GREGORIO DEL PILAR",
    "SAL-LAPADAN": "SALLAPADAN",
    "BALIWAG": "BALIUAG",
    "MEYCAUYAN": "MEYCAUAYAN",
    "OZAMIZ": "OZAMIS",
    "COTABATO": "COTABATO CITY",
    "LALLO": "LAL-LO",
    "BAGUILIN": "BAGULIN",
    "DISALAG": "DILASAG",
    "BULAKAN": "BULACAN",
    "CARRANGLAN": "CARRANGLAN",
    "G.M. NATIVIDAD": "GENERAL MAMERTO NATIVIDAD",
    "TALUGTOG": "TALUGTUG",
    "POLILIO": "POLILLO",
    "SAN JOSE DE BUENAVISTA": "SAN JOSE DE BUENAVISTA",
    "MAAYON": "MA-AYON",
    "PRES. ROXAS": "PRESIDENT ROXAS",
    "SAPIAN": "SAPIAN",
    "A. CASTANEDA": "ALFONSO CASTANEDA",
    "SANCHEZ MIRA": "SANCHEZ-MIRA",
    "SILVINO LUBOS": "SILVINO O. LOBOS",
    "LUMBAYA UNAYAN": "LUMBA-BAYABAO",
    "SULTAN MATSURA": "SULTAN MASTURA",
    "D.S. BENEDICTO": "SALVADOR BENEDICTO",
    "E.B. MAGALONA": "ENRIQUE B. MAGALONA",
    "GARCIA-HERNANDEZ": "GARCIA HERNANDEZ",
    "SIERRA-BULLONES": "SIERRA BULLONES",
    "BOLJO-ON": "BOLJOON",
    "PINAMUNGAJAN": "PINAMUNGAHAN",
    "LEON B. POSTIGO (BACUNGAN)": "LEON B. POSTIGO",
    "VINCENZO SAGUN": "VINCENZO A. SAGUN",
    "ROSELLER T. LIM": "ROSELLER LIM",
    "PANTAO-RAGAT": "PANTAO RAGAT",
    "TANGKAL": "TANGCAL",
    "BE DUJALI": "B E DUJALI",
    "SARANGGANI": "SARANGANI",
    "BANAY-BANAY": "BANAYBANAY",
    "GOV. GENEROSO": "GOVERNOR GENEROSO",
    "PIGCAWAYAN": "PIGKAWAYAN",
    "PRES. QUIRINO": "PRESIDENT QUIRINO",
    "R.T. ROMUALDEZ": "REMEDIOS T. ROMUALDEZ",
    "TAGANAAN": "TAGANA-AN",
    "BACOLOD KALAWI": "BACOLOD-KALAWI",
    "BUADIPUSO BUNTONG": "BUADIPOSO-BUNTONG",
    "CALANUGAS": "CALANOGAS",
    "LUMBA BAYABAO": "LUMBA BAYABAO",
    "DATU BLAH SINSUAT": "DATU BLAH T. SINSUAT",
    "NORTH UPI": "NORTH UPI",
    "SULTAN MASTURA": "SULTAN MASTURA",
    "DATU MONTAWAL": "DATU MONTAWAL",
    "DATU SAUDI AMPATUAN": "DATU SAUDI-AMPATUAN",
    "GEN. SALIPADA K. PENDATUN": "GENERAL SALIPADA K. PENDATUN",
    "TAWI TAWI": "TAWI-TAWI",
    "LAS PIÑAS": "LAS PIÑAS",
    "LAS PINAS": "LAS PIÑAS",
    "PARAÑAQUE": "PARAÑAQUE",
    "PARANAQUE": "PARAÑAQUE",
    "PEÑARANDA": "PEÑARANDA",
    "PENARANDA": "PEÑARANDA",
    "PEÑABLANCA": "PEÑABLANCA",
    "PENABLANCA": "PEÑABLANCA",
};

export interface AfrRawRow {
    level: string;
    region: string;
    province: string;
    name: string;
    assets: number | null;
    liabilities: number | null;
    equity: number | null;
    revenue: number | null;
    expenses: number | null;
    net_assistance_subsidy: number | null;
    surplus_deficit: number | null;
    cash_begin: number | null;
    net_cash: number | null;
    cash_end: number | null;
}

export interface AfrMappedRow extends AfrRawRow {
    psgc: string;
}

export interface PsgcIndexes {
    provincesByRegion: Map<string, Map<string, string>>;
    citiesByRegion: Map<string, Map<string, string>>;
    citiesGlobal: Map<string, string>;
    munsByProvince: Map<string, Map<string, string>>;
    munsByRegion: Map<string, { psgc: string; normName: string; provinceNorm: string }[]>;
    provinceNameToPsgc: Map<string, string>;
    provincePsgcToNorm: Map<string, string>;
}

function normalizeProvinceName(name: string): string {
    const base = normalizeAfrName(name);
    return PROVINCE_ALIASES[base] ?? base;
}

function stripDiacritics(s: string): string {
    return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function expandAbbreviations(s: string): string {
    return s
        .replace(/\bSTO\.\s*/g, "SANTO ")
        .replace(/\bSTA\.\s*/g, "SANTA ")
        .replace(/\bGEN\.\s*/g, "GENERAL ")
        .replace(/\bMT\.\s*/g, "MOUNT ")
        .replace(/\bDR\.\s*/g, "DOCTOR ")
        .replace(/\bDONA\b/g, "DOÑA")
        .replace(/\s+/g, " ")
        .trim();
}

export function normalizeAfrRegion(label: string): string {
    return stripDiacritics(label).trim().toUpperCase().replace(/\s*-\s*/g, "-");
}

export function normalizeAfrName(name: string, scope?: { province?: string; region?: string }): string {
    let s = stripDiacritics(name).trim().toUpperCase();
    s = s.replace(/\s+/g, " ");
    s = expandAbbreviations(s);
    s = s.replace(/^CITY OF /, "");
    s = s.replace(/^SCIENCE CITY OF /, "SCIENCE CITY OF ");
    s = s.replace(/\s+CITY$/, "");
    s = s.replace(/\s+COLLEGE$/, "");
    s = s.replace(/\s+\(CAPITAL\)$/, "");
    s = s.replace(/\s+\([^)]+\)$/, "");

    if (scope?.province) {
        const provKey = normalizeProvinceName(scope.province).toLowerCase();
        const scopedKey = `${provKey}|${s.toLowerCase()}`;
        const scoped = SCOPED_ALIASES[scopedKey];
        if (scoped) return scoped;
    }

    const alias = GLOBAL_ALIASES[s];
    if (alias) return alias;

    return s;
}

export function normalizePsgcName(name: string): string {
    let s = stripDiacritics(name).trim().toUpperCase();
    s = s.replace(/\s+/g, " ");
    s = s.replace(/^CITY OF /, "");
    s = s.replace(/^MUNICIPALITY OF /, "");
    s = expandAbbreviations(s);
    s = s.replace(/\s+CITY$/, "");
    return s.replace(/\s+COLLEGE$/, "").trim();
}

export function regionPsgcFromAfrLabel(label: string): string | null {
    const key = normalizeAfrRegion(label);
    return AFR_REGION_TO_PSGC[key] ?? null;
}

export function normalizeCensusRegionLabel(label: string): string {
    return stripDiacritics(label).trim().toUpperCase().replace(/\s+/g, " ");
}

export function regionPsgcFromCensusLabel(label: string): string | null {
    const norm = normalizeCensusRegionLabel(label);
    const afrKey = CENSUS_REGION_LABEL_TO_AFR[norm];
    if (afrKey && afrKey !== "PHILIPPINES" && afrKey !== "NIR") {
        return AFR_REGION_TO_PSGC[afrKey] ?? null;
    }
    return regionPsgcFromAfrLabel(label);
}

export interface PlaceRow {
    level: string;
    region: string;
    province: string;
    name: string;
}

const EMPTY_AFR_FIN: Pick<
    AfrRawRow,
    | "assets"
    | "liabilities"
    | "equity"
    | "revenue"
    | "expenses"
    | "net_assistance_subsidy"
    | "surplus_deficit"
    | "cash_begin"
    | "net_cash"
    | "cash_end"
> = {
    assets: null,
    liabilities: null,
    equity: null,
    revenue: null,
    expenses: null,
    net_assistance_subsidy: null,
    surplus_deficit: null,
    cash_begin: null,
    net_cash: null,
    cash_end: null,
};

export function censusRegionToAfrLabel(region: string): string {
    if (!region.trim()) return region;
    const norm = normalizeCensusRegionLabel(region);
    return CENSUS_REGION_LABEL_TO_AFR[norm] ?? region;
}

export function matchPlace(row: PlaceRow, indexes: PsgcIndexes): string | null {
    if (row.level === "country") return "0000000000";
    if (row.level === "region") {
        return regionPsgcFromCensusLabel(row.name);
    }
    const afrRegion = censusRegionToAfrLabel(row.region);
    return matchAfrRow({ ...EMPTY_AFR_FIN, ...row, region: afrRegion }, indexes);
}

export function loadPsgcIndexes(publicDir: string): PsgcIndexes {
    const psgcPath = path.join(publicDir, "psgc.csv");
    const metaPath = path.join(publicDir, "geo/municities/meta.json");

    const raw = fs.readFileSync(psgcPath);
    const rows = parse(raw, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true }) as Record<
        string,
        string
    >[];

    const provincesByRegion = new Map<string, Map<string, string>>();
    const provinceNameToPsgc = new Map<string, string>();

    for (const row of rows) {
        const geoLvl = row["Geographic Level"]?.trim();
        if (geoLvl !== "Prov") continue;
        const psgc = row["10-digit PSGC"].trim().padStart(10, "0");
        const name = row.Name?.trim() ?? "";
        const regionPsgc = `${psgc.slice(0, 2)}00000000`;
        const norm = normalizePsgcName(name);
        if (!provincesByRegion.has(regionPsgc)) provincesByRegion.set(regionPsgc, new Map());
        provincesByRegion.get(regionPsgc)!.set(norm, psgc);
        provinceNameToPsgc.set(norm, psgc);
    }

    const provincePsgcToNorm = new Map<string, string>();
    for (const [norm, psgc] of provinceNameToPsgc) {
        provincePsgcToNorm.set(psgc, norm);
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as MunicityMetaRow[];
    const citiesByRegion = new Map<string, Map<string, string>>();
    const citiesGlobal = new Map<string, string>();
    const munsByProvince = new Map<string, Map<string, string>>();
    const munsByRegion = new Map<string, { psgc: string; normName: string; provinceNorm: string }[]>();

    for (const row of meta) {
        const norm = normalizePsgcName(row.name);
        if (row.geo_lvl === "City") {
            const region = row.region_psgc ?? `${row.psgc.slice(0, 2)}00000000`;
            if (!citiesByRegion.has(region)) citiesByRegion.set(region, new Map());
            citiesByRegion.get(region)!.set(norm, row.psgc);
            citiesGlobal.set(norm, row.psgc);
        } else if (row.geo_lvl === "Mun") {
            const prov = row.province_psgc;
            if (!prov) continue;
            const provinceNorm = provincePsgcToNorm.get(prov) ?? "";
            if (!munsByProvince.has(prov)) munsByProvince.set(prov, new Map());
            munsByProvince.get(prov)!.set(norm, row.psgc);
            const region = row.region_psgc ?? `${row.psgc.slice(0, 2)}00000000`;
            if (!munsByRegion.has(region)) munsByRegion.set(region, []);
            munsByRegion.get(region)!.push({ psgc: row.psgc, normName: norm, provinceNorm });
        }
    }

    return {
        provincesByRegion,
        citiesByRegion,
        citiesGlobal,
        munsByProvince,
        munsByRegion,
        provinceNameToPsgc,
        provincePsgcToNorm,
    };
}

export function matchAfrRow(row: AfrRawRow, indexes: PsgcIndexes): string | null {
    const regionPsgc = regionPsgcFromAfrLabel(row.region);
    if (!regionPsgc) return null;

    const scope = { province: row.province, region: row.region };
    const normName = normalizeAfrName(row.name, scope);

    if (row.level === "province") {
        const map = indexes.provincesByRegion.get(regionPsgc);
        const provNorm = normalizeProvinceName(row.name);
        return (
            map?.get(provNorm) ??
            indexes.provinceNameToPsgc.get(provNorm) ??
            null
        );
    }

    if (row.level === "city") {
        const map = indexes.citiesByRegion.get(regionPsgc);
        const candidates = [
            normName,
            normalizePsgcName(`City of ${row.name}`),
            normalizePsgcName(`${row.name} City`),
            normalizePsgcName(row.name),
        ];
        for (const c of candidates) {
            const hit = map?.get(c);
            if (hit) return hit;
        }
        for (const c of candidates) {
            const hit = indexes.citiesGlobal.get(c);
            if (hit) return hit;
        }
        return null;
    }

    if (row.level === "municipality") {
        const provNorm = normalizeProvinceName(row.province);
        let provincePsgc =
            indexes.provincesByRegion.get(regionPsgc)?.get(provNorm) ??
            indexes.provinceNameToPsgc.get(provNorm) ??
            null;
        if (!provincePsgc && regionPsgc === "1300000000" && !row.province.trim()) {
            provincePsgc = "1300000000";
        }

        const tryProvinceMap = (psgc: string | null) => {
            if (!psgc) return null;
            const map = indexes.munsByProvince.get(psgc);
            return map?.get(normName) ?? null;
        };

        let hit = tryProvinceMap(provincePsgc);
        if (hit) return hit;

        if (provNorm === "SULU") {
            const legacy = indexes.munsByRegion.get(regionPsgc)?.find(
                (m) => m.normName === normName && m.psgc.startsWith("09066"),
            );
            if (legacy) return legacy.psgc;
        }

        const pool = indexes.munsByRegion.get(regionPsgc) ?? [];
        const matches = pool.filter(
            (m) => m.normName === normName || m.normName.replace(/\s+/g, "") === normName.replace(/\s+/g, ""),
        );
        if (matches.length === 1) return matches[0].psgc;
        if (matches.length > 1 && provNorm) {
            const byProv = matches.filter((m) => m.provinceNorm === provNorm);
            if (byProv.length === 1) return byProv[0].psgc;
            const legacySulu = matches.filter((m) => provNorm === "SULU" && m.psgc.startsWith("09066"));
            if (legacySulu.length === 1) return legacySulu[0].psgc;
        }
        return null;
    }

    return null;
}
