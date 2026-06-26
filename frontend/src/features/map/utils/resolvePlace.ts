// Resolves the currently selected administrative place for the Info tab.

import type { MpaLevel } from "../constants";
import type {
    BarangayGeoJSON,
    CountryGeoJSON,
    DivisionStatsFields,
    MunicityGeoJSON,
    MunicityMeta,
    ProvinceGeoJSON,
    Region,
} from "../types";

export interface ResolvedPlace extends DivisionStatsFields {
    psgc: string;
    name: string;
    level: MpaLevel;
    geo_lvl: string;
    breadcrumb: string;
    note?: string | null;
}

interface ResolvePlaceInput {
    level: MpaLevel;
    country: CountryGeoJSON | null;
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municities: MunicityGeoJSON[];
    municityMeta: MunicityMeta[];
    barangays: BarangayGeoJSON[];
    selectedRegionPsgc: string | null;
    selectedProvincePsgc: string | null;
    selectedMunicityPsgc: string | null;
    selectedBarangayPsgc: string | null;
}

function mergeStats<T extends DivisionStatsFields>(row: T): DivisionStatsFields {
    return {
        pop_2010: row.pop_2010 ?? null,
        pop_2015: row.pop_2015 ?? null,
        pop_2020: row.pop_2020 ?? null,
        pop_2024: row.pop_2024 ?? null,
        pop_male_2020: row.pop_male_2020 ?? null,
        pop_female_2020: row.pop_female_2020 ?? null,
        age_sex_2020: row.age_sex_2020 ?? null,
        area_km2: row.area_km2 ?? null,
        density_2024: row.density_2024 ?? null,
        pct_change_2020_2024: row.pct_change_2020_2024 ?? null,
        assets_2024: row.assets_2024 ?? null,
    };
}

function findMunicity(psgc: string, municities: MunicityGeoJSON[], meta: MunicityMeta[]): MunicityGeoJSON | MunicityMeta | undefined {
    return municities.find((m) => m.psgc === psgc) ?? meta.find((m) => m.psgc === psgc);
}

function breadcrumbFor(
    level: MpaLevel,
    regions: Region[],
    provinces: ProvinceGeoJSON[],
    municity: MunicityGeoJSON | MunicityMeta | undefined,
    provincePsgc: string | null,
    regionPsgc: string | null,
): string {
    const parts: string[] = ["Philippines"];
    if (regionPsgc) {
        const region = regions.find((r) => r.psgc === regionPsgc);
        if (region) parts.push(region.name.trim());
    }
    if (provincePsgc && level !== "region") {
        const province = provinces.find((p) => p.psgc === provincePsgc);
        if (province) parts.push(province.name.trim());
    }
    if (municity && (level === "municipality" || level === "barangay")) {
        parts.push(municity.name.trim());
    }
    return parts.join(" › ");
}

export function resolveSelectedPlace(input: ResolvePlaceInput): ResolvedPlace | null {
    const {
        level,
        country,
        regions,
        provinces,
        municities,
        municityMeta,
        barangays,
        selectedRegionPsgc,
        selectedProvincePsgc,
        selectedMunicityPsgc,
        selectedBarangayPsgc,
    } = input;

    if (level === "country") {
        if (!country) return null;
        return {
            psgc: country.psgc,
            name: country.name,
            level: "country",
            geo_lvl: country.geo_lvl,
            breadcrumb: "Philippines",
            ...mergeStats(country),
        };
    }

    if (level === "region") {
        if (!selectedRegionPsgc) return null;
        const region = regions.find((r) => r.psgc === selectedRegionPsgc);
        if (!region) return null;
        return {
            psgc: region.psgc,
            name: region.name.trim(),
            level: "region",
            geo_lvl: region.geo_lvl,
            breadcrumb: breadcrumbFor("region", regions, provinces, undefined, null, region.psgc),
            ...mergeStats(region),
        };
    }

    if (level === "province") {
        if (!selectedProvincePsgc) return null;
        const province = provinces.find((p) => p.psgc === selectedProvincePsgc);
        if (!province) return null;
        return {
            psgc: province.psgc,
            name: province.name.trim(),
            level: "province",
            geo_lvl: province.geo_lvl,
            breadcrumb: breadcrumbFor("province", regions, provinces, undefined, province.psgc, province.region_psgc),
            ...mergeStats(province),
        };
    }

    if (level === "municipality") {
        if (!selectedMunicityPsgc) return null;
        const muni = findMunicity(selectedMunicityPsgc, municities, municityMeta);
        if (!muni) return null;
        return {
            psgc: muni.psgc,
            name: muni.name.trim(),
            level: "municipality",
            geo_lvl: muni.geo_lvl,
            breadcrumb: breadcrumbFor(
                "municipality",
                regions,
                provinces,
                muni,
                muni.province_psgc,
                muni.region_psgc,
            ),
            ...mergeStats(muni),
        };
    }

    if (level === "barangay") {
        if (!selectedBarangayPsgc || !selectedMunicityPsgc) return null;
        const bgy = barangays.find((b) => b.psgc === selectedBarangayPsgc);
        if (!bgy) return null;
        const muni = findMunicity(selectedMunicityPsgc, municities, municityMeta);
        return {
            psgc: bgy.psgc,
            name: bgy.name.trim(),
            level: "barangay",
            geo_lvl: bgy.geo_lvl,
            breadcrumb: `${breadcrumbFor("municipality", regions, provinces, muni, bgy.province_psgc, bgy.region_psgc)} › ${bgy.name.trim()}`,
            note: bgy.note ?? null,
            ...mergeStats(bgy),
        };
    }

    return null;
}
