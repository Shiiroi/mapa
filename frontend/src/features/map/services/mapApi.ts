import { supabase } from "../../../config/supabase";
import type { GeoJSON } from "geojson";
import type { ProvinceGeoJSON, MunicityGeoJSON, MunicityMeta, Region } from "../types";

interface RawRegion {
    id: number;
    code: string;
    name: string;
    geojson: GeoJSON.Geometry;
}

interface RawProvince {
    id: number;
    code: string;
    name: string;
    region_id: number;
    geojson: GeoJSON.Geometry;
}

interface RawMunicity {
    id: number;
    name: string;
    code: string;
    province_id: number | null;
    region_id: number | null;
    type: "city" | "municipality";
    geojson: GeoJSON.Geometry;
}

export async function fetchRegions(): Promise<Region[]> {
    const { data, error } = await supabase.from("regions").select("id, code, name, geojson").order("id");

    if (error) throw error;
    return ((data ?? []) as RawRegion[]).map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        geometry: r.geojson,
    })) as Region[];
}

export async function fetchProvinces(): Promise<ProvinceGeoJSON[]> {
    const { data, error } = await supabase.from("provinces").select("id, code, name, region_id, geojson").order("name");

    if (error) throw error;
    return ((data ?? []) as RawProvince[]).map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        region_id: p.region_id,
        geometry: p.geojson,
    })) as ProvinceGeoJSON[];
}

/** Quick metadata-only fetch (no geometry) — guaranteed to be fast */
export async function fetchMunicitiesMeta(): Promise<MunicityMeta[]> {
    const { data, error } = await supabase.from("municities").select("id, name, code, province_id, region_id, type").order("name");

    if (error) throw error;
    return (data ?? []) as MunicityMeta[];
}

/** Fetch full geometry for all municities using paginated range queries */
export async function fetchMunicitiesGeometry(): Promise<MunicityGeoJSON[]> {
    const BATCH_SIZE = 200;
    const all: MunicityGeoJSON[] = [];
    let from = 0;
    let chunk: RawMunicity[];

    do {
        const { data, error } = await supabase
            .from("municities")
            .select("id, name, code, province_id, region_id, type, geojson")
            .range(from, from + BATCH_SIZE - 1)
            .order("name");
        if (error) throw error;
        chunk = (data ?? []) as RawMunicity[];
        const mapped = chunk.map((m) => ({
            id: m.id,
            name: m.name,
            code: m.code,
            province_id: m.province_id,
            region_id: m.region_id,
            type: m.type,
            geometry: m.geojson,
        })) as MunicityGeoJSON[];
        all.push(...mapped);
        from += BATCH_SIZE;
    } while (chunk.length === BATCH_SIZE);

    console.info(`[fetchMunicitiesGeometry] Loaded ${all.length} municities with geometry`);
    return all;
}

export async function fetchProvincesByRegion(regionId: number): Promise<ProvinceGeoJSON[]> {
    const { data, error } = await supabase.from("provinces").select("id, code, name, region_id, geojson").eq("region_id", regionId).order("name");

    if (error) throw error;
    return ((data ?? []) as RawProvince[]).map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        region_id: p.region_id,
        geometry: p.geojson,
    })) as ProvinceGeoJSON[];
}

export async function fetchMunicitiesByProvince(provinceId: number): Promise<MunicityGeoJSON[]> {
    const { data, error } = await supabase
        .from("municities")
        .select("id, name, code, province_id, region_id, type, geojson")
        .eq("province_id", provinceId)
        .order("name");

    if (error) throw error;
    return ((data ?? []) as RawMunicity[]).map((m) => ({
        id: m.id,
        name: m.name,
        code: m.code,
        province_id: m.province_id,
        region_id: m.region_id,
        type: m.type,
        geometry: m.geojson,
    })) as MunicityGeoJSON[];
}
