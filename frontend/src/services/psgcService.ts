import { parse } from "csv-parse/sync";
import regionsCsv from "../../scripts/regions.csv?raw";
import provincesCsv from "../../scripts/provinces.csv?raw";
import municitiesCsv from "../../scripts/municities.csv?raw";

export interface PsgcRegion {
    code: string;
    name: string;
}

export interface PsgcProvince {
    code: string;
    name: string;
    regionCode: string;
}

export interface PsgcMunicity {
    code: string;
    name: string;
    provinceCode: string | null;
    type: "city" | "municipality";
}

let cachedRegions: PsgcRegion[] | null = null;
let cachedProvinces: PsgcProvince[] | null = null;
let cachedMunicities: PsgcMunicity[] | null = null;

function parseCsv<T>(raw: string): T[] {
    return parse(raw, { columns: true, skip_empty_lines: true, delimiter: "," }) as T[];
}

export function getRegions(): PsgcRegion[] {
    if (!cachedRegions) {
        cachedRegions = parseCsv<PsgcRegion>(regionsCsv);
    }
    return cachedRegions;
}

export function getProvinces(): PsgcProvince[] {
    if (!cachedProvinces) {
        cachedProvinces = parseCsv<PsgcProvince>(provincesCsv);
    }
    return cachedProvinces;
}

export function getMunicities(): PsgcMunicity[] {
    if (!cachedMunicities) {
        cachedMunicities = parseCsv<PsgcMunicity>(municitiesCsv);
    }
    return cachedMunicities;
}
