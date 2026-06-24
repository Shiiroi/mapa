// Leaflet map; view mode driven by sidebar; click selects a division.

import { useMemo, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, ZoomControl } from "react-leaflet";
import L from "leaflet";
import type { Feature, Geometry } from "geojson";
import type { MpaLevel } from "../constants";

const PH_CENTER: [number, number] = [12.8797, 121.774];
const PH_ZOOM = 6;

const MODE_STYLES: Record<MpaLevel, { color: string; fillColor: string }> = {
    region: { color: "#e53e3e", fillColor: "#fc8181" },
    province: { color: "#2b6cb0", fillColor: "#3182ce" },
    municipality: { color: "#38a169", fillColor: "#68d391" },
};

const BASE_STYLE = (mode: MpaLevel): L.PathOptions => ({
    color: MODE_STYLES[mode].color,
    weight: 0.8,
    fillColor: MODE_STYLES[mode].fillColor,
    fillOpacity: 0.15,
    renderer: L.canvas(),
});

const HOVER_STYLE: L.PathOptions = {
    weight: 2,
    fillOpacity: 0.35,
};

export interface MapEntity {
    id: number;
    name: string;
    code: string;
    geometry: Geometry;
    region_id?: number | null;
    province_id?: number | null;
    type?: string;
}

interface MpaMapPanelProps {
    provinces?: MapEntity[];
    regions?: MapEntity[];
    municities?: MapEntity[];
    mode: MpaLevel;
    onFeatureClick?: (entityId: number, mode: MpaLevel) => void;
    loading?: boolean;
    error?: Error | null;
}

export function MpaMapPanel({
    provinces = [],
    regions = [],
    municities = [],
    mode,
    onFeatureClick,
    loading,
    error,
}: MpaMapPanelProps) {
    const currentData = useMemo(() => {
        let entities: MapEntity[] = [];
        switch (mode) {
            case "region":
                entities = regions;
                break;
            case "province":
                entities = provinces;
                break;
            case "municipality":
                entities = municities;
                break;
        }
        return {
            type: "FeatureCollection" as const,
            features: entities
                .filter((e) => e.geometry)
                .map((e) => ({
                    type: "Feature" as const,
                    properties: {
                        id: e.id,
                        name: e.name,
                        code: e.code,
                        region_id: e.region_id ?? null,
                        province_id: e.province_id ?? null,
                        type: e.type ?? null,
                        mode,
                    },
                    geometry: e.geometry,
                })),
        };
    }, [mode, provinces, regions, municities]);

    const onEachFeature = useCallback(
        (feature: Feature, layer: L.GeoJSON) => {
            const name = feature.properties?.name as string;
            const id = feature.properties?.id as number;
            if (name) {
                layer.bindTooltip(name, { sticky: true, direction: "top" });
            }
            layer.on("mouseover", () => layer.setStyle(HOVER_STYLE));
            layer.on("mouseout", () => layer.setStyle(BASE_STYLE(mode)));
            layer.on("click", () => {
                if (id != null) onFeatureClick?.(id, mode);
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
                    pathOptions={BASE_STYLE(mode)}
                    onEachFeature={onEachFeature}
                />
            </MapContainer>
        </div>
    );
}
