// Builds scoped GeoJSON FeatureCollections; uses province region_psgc for correct filtering.

import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { MpaLevel } from "../constants";
import { slugifyDivisionName } from "./slugifyDivisionName";
import type { BarangayGeoJSON, CountryGeoJSON, MunicityGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";
import {
    fetchBarangaysByMunicityFromStorage,
    fetchMunicitiesByProvinceFromStorage,
} from "../services/geoStorage";

export type DownloadScope =
    | { kind: "country" }
    | { kind: "region"; regionPsgc: string }
    | { kind: "provincesInRegion"; regionPsgc: string }
    | { kind: "munisInRegion"; regionPsgc: string }
    | { kind: "province"; provincePsgc: string }
    | { kind: "munisInProvince"; provincePsgc: string }
    | { kind: "municipality"; municityPsgc: string; provincePsgc: string }
    | { kind: "barangay"; municityPsgc: string; barangayPsgc: string }
    | { kind: "bgysInMunicity"; municityPsgc: string };

export interface BuildDownloadInput {
    level: MpaLevel;
    scope: DownloadScope;
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municities: MunicityGeoJSON[];
    municityMeta: MunicityMeta[];
    country: CountryGeoJSON | null;
}

export interface BuildDownloadResult {
    geojson: FeatureCollection;
    filename: string;
    label: string;
}

function toFeature(
    geometry: Geometry,
    properties: Record<string, string | number | null | undefined>,
): Feature {
    return {
        type: "Feature",
        properties,
        geometry,
    };
}

// Composes a dated, slugified export filename like "mapa-province-cebu-2026-06-28.json".
function buildFilename(level: MpaLevel, slug: string): string {
    const date = new Date().toISOString().slice(0, 10);
    return `mapa-${level}-${slugifyDivisionName(slug)}-${date}.json`;
}

// Converts a barangay record into a GeoJSON Feature with its PSGC properties.
function barangayToFeature(bgy: BarangayGeoJSON): Feature {
    return toFeature(bgy.geometry, {
        psgc: bgy.psgc,
        correspondence: bgy.correspondence,
        name: bgy.name,
        geo_lvl: bgy.geo_lvl,
        city_lvl: bgy.city_lvl,
        level: "barangay",
        municity_psgc: bgy.municity_psgc,
        province_psgc: bgy.province_psgc,
        region_psgc: bgy.region_psgc,
    });
}

// Province-linked munis use the province's region_psgc; direct region_psgc only when province_psgc is null.
export function getEffectiveRegionPsgc(
    m: Pick<MunicityMeta, "province_psgc" | "region_psgc">,
    provinces: ProvinceGeoJSON[],
): string | null {
    if (m.province_psgc != null) {
        const province = provinces.find((p) => p.psgc === m.province_psgc);
        if (province) return province.region_psgc;
    }
    return m.region_psgc;
}

function provincePsgcsInRegion(regionPsgc: string, provinces: ProvinceGeoJSON[]): string[] {
    return provinces.filter((p) => p.region_psgc === regionPsgc).map((p) => p.psgc);
}

// Gathers municities for the given provinces, using cached rows when available
// and fetching from storage only for provinces not yet loaded.
async function loadMunisForProvinces(
    provincePsgcs: string[],
    municities: MunicityGeoJSON[],
): Promise<MunicityGeoJSON[]> {
    const chunks = await Promise.all(
        provincePsgcs.map((psgc) => {
            const cached = municities.filter((m) => m.province_psgc === psgc);
            if (cached.length > 0) return Promise.resolve(cached);
            return fetchMunicitiesByProvinceFromStorage(psgc);
        }),
    );
    return chunks.flat();
}

// Assembles the GeoJSON FeatureCollection, filename, and label for a download scope.
export async function buildDownloadGeoJson(input: BuildDownloadInput): Promise<BuildDownloadResult> {
    const { level, scope, regions, provinces, municities, municityMeta, country } = input;
    let features: Feature[] = [];
    let label = "philippines";

    switch (scope.kind) {
        case "country": {
            if (!country?.geometry) throw new Error("Country boundary not found");
            label = country.name;
            features = [
                toFeature(country.geometry, {
                    psgc: country.psgc,
                    correspondence: country.correspondence,
                    name: country.name,
                    geo_lvl: country.geo_lvl,
                    city_lvl: country.city_lvl,
                    level: "country",
                }),
            ];
            break;
        }
        case "region": {
            const region = regions.find((r) => r.psgc === scope.regionPsgc);
            if (!region?.geometry) throw new Error("Region not found");
            label = region.name;
            features = [
                toFeature(region.geometry, {
                    psgc: region.psgc,
                    correspondence: region.correspondence,
                    name: region.name,
                    geo_lvl: region.geo_lvl,
                    city_lvl: region.city_lvl,
                    level: "region",
                }),
            ];
            break;
        }
        case "provincesInRegion": {
            const region = regions.find((r) => r.psgc === scope.regionPsgc);
            if (!region) throw new Error("Region not found");
            label = `${region.name}-provinces`;
            features = provinces
                .filter((p) => p.region_psgc === scope.regionPsgc && p.geometry)
                .map((p) =>
                    toFeature(p.geometry, {
                        psgc: p.psgc,
                        correspondence: p.correspondence,
                        name: p.name,
                        geo_lvl: p.geo_lvl,
                        city_lvl: p.city_lvl,
                        level: "province",
                        region_psgc: p.region_psgc,
                    }),
                );
            break;
        }
        case "munisInRegion": {
            const region = regions.find((r) => r.psgc === scope.regionPsgc);
            if (!region) throw new Error("Region not found");
            label = `${region.name}-municipalities`;
            const psgcs = provincePsgcsInRegion(scope.regionPsgc, provinces);
            const munis = await loadMunisForProvinces(psgcs, municities);
            features = munis
                .filter((m) => m.geometry)
                .map((m) =>
                    toFeature(m.geometry, {
                        psgc: m.psgc,
                        correspondence: m.correspondence,
                        name: m.name,
                        geo_lvl: m.geo_lvl,
                        city_lvl: m.city_lvl,
                        level: "municipality",
                        region_psgc: getEffectiveRegionPsgc(m, provinces),
                        province_psgc: m.province_psgc,
                    }),
                );
            break;
        }
        case "province": {
            const province = provinces.find((p) => p.psgc === scope.provincePsgc);
            if (!province?.geometry) throw new Error("Province not found");
            label = province.name;
            features = [
                toFeature(province.geometry, {
                    psgc: province.psgc,
                    correspondence: province.correspondence,
                    name: province.name,
                    geo_lvl: province.geo_lvl,
                    city_lvl: province.city_lvl,
                    level: "province",
                    region_psgc: province.region_psgc,
                }),
            ];
            break;
        }
        case "munisInProvince": {
            const province = provinces.find((p) => p.psgc === scope.provincePsgc);
            if (!province) throw new Error("Province not found");
            label = `${province.name}-municipalities`;
            let munis = municities.filter((m) => m.province_psgc === scope.provincePsgc);
            if (munis.length === 0) {
                munis = await fetchMunicitiesByProvinceFromStorage(scope.provincePsgc);
            }
            features = munis
                .filter((m) => m.geometry)
                .map((m) =>
                    toFeature(m.geometry, {
                        psgc: m.psgc,
                        correspondence: m.correspondence,
                        name: m.name,
                        geo_lvl: m.geo_lvl,
                        city_lvl: m.city_lvl,
                        level: "municipality",
                        region_psgc: getEffectiveRegionPsgc(m, provinces),
                        province_psgc: m.province_psgc,
                    }),
                );
            break;
        }
        case "municipality": {
            let muni = municities.find((m) => m.psgc === scope.municityPsgc);
            if (!muni) {
                const chunk = await fetchMunicitiesByProvinceFromStorage(scope.provincePsgc);
                muni = chunk.find((m) => m.psgc === scope.municityPsgc);
            }
            if (!muni?.geometry) throw new Error("Municipality not found");
            label = muni.name;
            features = [
                toFeature(muni.geometry, {
                    psgc: muni.psgc,
                    correspondence: muni.correspondence,
                    name: muni.name,
                    geo_lvl: muni.geo_lvl,
                    city_lvl: muni.city_lvl,
                    level: "municipality",
                    region_psgc: getEffectiveRegionPsgc(muni, provinces),
                    province_psgc: muni.province_psgc,
                }),
            ];
            break;
        }
        case "bgysInMunicity": {
            const muni = municityMeta.find((m) => m.psgc === scope.municityPsgc);
            const bgys = await fetchBarangaysByMunicityFromStorage(scope.municityPsgc);
            if (!bgys.length) throw new Error("No barangays found for this municipality");
            label = muni ? `${muni.name}-barangays` : `${scope.municityPsgc}-barangays`;
            features = bgys.filter((b) => b.geometry).map(barangayToFeature);
            break;
        }
        case "barangay": {
            const bgys = await fetchBarangaysByMunicityFromStorage(scope.municityPsgc);
            const bgy = bgys.find((b) => b.psgc === scope.barangayPsgc);
            if (!bgy?.geometry) throw new Error("Barangay not found");
            label = bgy.name;
            features = [barangayToFeature(bgy)];
            break;
        }
    }

    if (features.length === 0) {
        throw new Error("No features to download for the current selection");
    }

    return {
        geojson: { type: "FeatureCollection", features },
        filename: buildFilename(level, label),
        label,
    };
}
