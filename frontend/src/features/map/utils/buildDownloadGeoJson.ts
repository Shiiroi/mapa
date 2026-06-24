// Builds scoped GeoJSON FeatureCollections; uses province region_id for correct filtering.

import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { MpaLevel } from "../constants";
import { slugifyDivisionName } from "./slugifyDivisionName";
import type { MunicityGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";
import { fetchMunicitiesByProvinceFromStorage } from "../services/geoStorage";

export type DownloadScope =
    | { kind: "region"; regionId: number }
    | { kind: "provincesInRegion"; regionId: number }
    | { kind: "munisInRegion"; regionId: number }
    | { kind: "province"; provinceId: number }
    | { kind: "munisInProvince"; provinceId: number }
    | { kind: "municipality"; municityId: number; provinceId: number };

export interface BuildDownloadInput {
    level: MpaLevel;
    scope: DownloadScope;
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municities: MunicityGeoJSON[];
    municityMeta: MunicityMeta[];
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

function buildFilename(level: MpaLevel, slug: string): string {
    const date = new Date().toISOString().slice(0, 10);
    return `mapa-${level}-${slugifyDivisionName(slug)}-${date}.json`;
}

// Province-linked munis use the province's region_id; direct region_id only when province_id is null.
export function getEffectiveRegionId(
    m: Pick<MunicityMeta, "province_id" | "region_id">,
    provinces: ProvinceGeoJSON[],
): number | null {
    if (m.province_id != null) {
        const province = provinces.find((p) => p.id === m.province_id);
        if (province) return province.region_id;
    }
    return m.region_id;
}

// Returns province IDs belonging to a region via the provinces table (not municity region_id).
function provinceIdsInRegion(regionId: number, provinces: ProvinceGeoJSON[]): number[] {
    return provinces.filter((p) => p.region_id === regionId).map((p) => p.id);
}

// Loads municity geometries per province, using cache when available.
async function loadMunisForProvinces(
    provinceIds: number[],
    municities: MunicityGeoJSON[],
): Promise<MunicityGeoJSON[]> {
    const chunks = await Promise.all(
        provinceIds.map((pid) => {
            const cached = municities.filter((m) => m.province_id === pid);
            if (cached.length > 0) return Promise.resolve(cached);
            return fetchMunicitiesByProvinceFromStorage(pid);
        }),
    );
    return chunks.flat();
}

export async function buildDownloadGeoJson(input: BuildDownloadInput): Promise<BuildDownloadResult> {
    const { level, scope, regions, provinces, municities } = input;
    let features: Feature[] = [];
    let label = "philippines";

    switch (scope.kind) {
        case "region": {
            const region = regions.find((r) => r.id === scope.regionId);
            if (!region?.geometry) throw new Error("Region not found");
            label = region.name;
            features = [
                toFeature(region.geometry, {
                    id: region.id,
                    code: region.code,
                    name: region.name,
                    level: "region",
                }),
            ];
            break;
        }
        case "provincesInRegion": {
            const region = regions.find((r) => r.id === scope.regionId);
            if (!region) throw new Error("Region not found");
            label = `${region.name}-provinces`;
            features = provinces
                .filter((p) => p.region_id === scope.regionId && p.geometry)
                .map((p) =>
                    toFeature(p.geometry, {
                        id: p.id,
                        code: p.code,
                        name: p.name,
                        level: "province",
                        region_id: p.region_id,
                    }),
                );
            break;
        }
        case "munisInRegion": {
            const region = regions.find((r) => r.id === scope.regionId);
            if (!region) throw new Error("Region not found");
            label = `${region.name}-municipalities`;
            const pids = provinceIdsInRegion(scope.regionId, provinces);
            const munis = await loadMunisForProvinces(pids, municities);
            features = munis
                .filter((m) => m.geometry)
                .map((m) =>
                    toFeature(m.geometry, {
                        id: m.id,
                        code: m.code,
                        name: m.name,
                        level: "municipality",
                        region_id: getEffectiveRegionId(m, provinces),
                        province_id: m.province_id,
                        type: m.type,
                    }),
                );
            break;
        }
        case "province": {
            const province = provinces.find((p) => p.id === scope.provinceId);
            if (!province?.geometry) throw new Error("Province not found");
            label = province.name;
            features = [
                toFeature(province.geometry, {
                    id: province.id,
                    code: province.code,
                    name: province.name,
                    level: "province",
                    region_id: province.region_id,
                }),
            ];
            break;
        }
        case "munisInProvince": {
            const province = provinces.find((p) => p.id === scope.provinceId);
            if (!province) throw new Error("Province not found");
            label = `${province.name}-municipalities`;
            let munis = municities.filter((m) => m.province_id === scope.provinceId);
            if (munis.length === 0) {
                munis = await fetchMunicitiesByProvinceFromStorage(scope.provinceId);
            }
            features = munis
                .filter((m) => m.geometry)
                .map((m) =>
                    toFeature(m.geometry, {
                        id: m.id,
                        code: m.code,
                        name: m.name,
                        level: "municipality",
                        region_id: getEffectiveRegionId(m, provinces),
                        province_id: m.province_id,
                        type: m.type,
                    }),
                );
            break;
        }
        case "municipality": {
            let muni = municities.find((m) => m.id === scope.municityId);
            if (!muni) {
                const chunk = await fetchMunicitiesByProvinceFromStorage(scope.provinceId);
                muni = chunk.find((m) => m.id === scope.municityId);
            }
            if (!muni?.geometry) throw new Error("Municipality not found");
            label = muni.name;
            features = [
                toFeature(muni.geometry, {
                    id: muni.id,
                    code: muni.code,
                    name: muni.name,
                    level: "municipality",
                    region_id: getEffectiveRegionId(muni, provinces),
                    province_id: muni.province_id,
                    type: muni.type,
                }),
            ];
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
