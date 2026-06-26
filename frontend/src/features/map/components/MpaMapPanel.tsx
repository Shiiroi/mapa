// Leaflet map; view mode driven by sidebar; click selects a division.

import { useMemo, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, ZoomControl } from "react-leaflet";
import L from "leaflet";
import type { Feature, Geometry } from "geojson";
import type { MpaLevel } from "../constants";

const PH_CENTER: [number, number] = [12.8797, 121.774];
const PH_ZOOM = 6;

const BASE_STYLE: L.PathOptions = {
    color: "#2b6cb0",
    weight: 0.8,
    fillColor: "#3182ce",
    fillOpacity: 0.15,
    renderer: L.canvas(),
};

const HOVER_STYLE: L.PathOptions = {
    weight: 2,
    fillOpacity: 0.35,
};

export interface MapEntity {
    psgc: string;
    name: string;
    geometry: Geometry;
    region_psgc?: string | null;
    province_psgc?: string | null;
    geo_lvl?: string;
    city_lvl?: string | null;
}

interface MpaMapPanelProps {
    country?: MapEntity | null;
    provinces?: MapEntity[];
    regions?: MapEntity[];
    municities?: MapEntity[];
    barangays?: MapEntity[];
    mode: MpaLevel;
    onFeatureClick?: (entityPsgc: string, mode: MpaLevel) => void;
    loading?: boolean;
    error?: Error | null;
}

export function MpaMapPanel({
    country = null,
    provinces = [],
    regions = [],
    municities = [],
    barangays = [],
    mode,
    onFeatureClick,
    loading,
    error,
}: MpaMapPanelProps) {
    const currentData = useMemo(() => {
        let entities: MapEntity[] = [];
        switch (mode) {
            case "country":
                entities = country ? [country] : [];
                break;
            case "region":
                entities = regions;
                break;
            case "province":
                entities = provinces;
                break;
            case "municipality":
                entities = municities;
                break;
            case "barangay":
                entities = barangays;
                break;
        }
        return {
            type: "FeatureCollection" as const,
            features: entities
                .filter((e) => e.geometry)
                .map((e) => ({
                    type: "Feature" as const,
                    properties: {
                        psgc: e.psgc,
                        name: e.name,
                        region_psgc: e.region_psgc ?? null,
                        province_psgc: e.province_psgc ?? null,
                        geo_lvl: e.geo_lvl ?? null,
                        city_lvl: e.city_lvl ?? null,
                        mode,
                    },
                    geometry: e.geometry,
                })),
        };
    }, [mode, country, provinces, regions, municities, barangays]);

    const onEachFeature = useCallback(
        (feature: Feature, layer: L.GeoJSON) => {
            const name = feature.properties?.name as string;
            const psgc = feature.properties?.psgc as string;
            if (name) {
                layer.bindTooltip(name, { sticky: true, direction: "top" });
            }
            layer.on("mouseover", () => layer.setStyle(HOVER_STYLE));
            layer.on("mouseout", () => layer.setStyle(BASE_STYLE));
            layer.on("click", () => {
                if (psgc) onFeatureClick?.(psgc, mode);
            });
        },
        [mode, onFeatureClick],
    );

    return (
        <div className="relative h-full min-h-[50dvh] w-full">
            {loading && (
                <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-parchment/80">
                    <p className="rounded-lg bg-white px-6 py-4 shadow-soft">Loading Philippines map…</p>
                </div>
            )}

            {error && (
                <div className="absolute top-3 right-3 z-[1001] max-w-sm rounded-lg bg-red-100 px-4 py-3 text-sm text-red-800 shadow-soft">
                    Failed to load map: {error.message}
                </div>
            )}

            <MapContainer
                center={PH_CENTER}
                zoom={PH_ZOOM}
                zoomControl={false}
                className="h-full w-full"
                scrollWheelZoom
                preferCanvas
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ZoomControl position="bottomright" />
                <GeoJSON
                    key={`${mode}-${currentData.features.length}`}
                    data={currentData}
                    pathOptions={BASE_STYLE}
                    onEachFeature={onEachFeature}
                />
            </MapContainer>
        </div>
    );
}
