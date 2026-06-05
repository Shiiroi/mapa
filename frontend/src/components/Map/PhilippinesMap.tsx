import { useMemo, useState, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, ZoomControl } from "react-leaflet";
import L from "leaflet";
import type { Feature, Geometry } from "geojson";

const PH_CENTER: [number, number] = [12.8797, 121.774];
const PH_ZOOM = 6;

type MapMode = "region" | "province" | "municipality";

const MODE_STYLES: Record<MapMode, { color: string; fillColor: string }> = {
    region: { color: "#e53e3e", fillColor: "#fc8181" },
    province: { color: "#2b6cb0", fillColor: "#3182ce" },
    municipality: { color: "#38a169", fillColor: "#68d391" },
};

const BASE_STYLE = (mode: MapMode): L.PathOptions => ({
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

interface GeoEntity {
    id: number | string;
    name: string;
    geometry: Geometry;
}

interface PhilippinesMapProps {
    provinces?: GeoEntity[];
    regions?: GeoEntity[];
    municities?: GeoEntity[];
    defaultMode?: MapMode;
}

export function PhilippinesMap({ provinces = [], regions = [], municities = [], defaultMode = "province" }: PhilippinesMapProps) {
    const [mode, setMode] = useState<MapMode>(defaultMode);

    const currentData = useMemo(() => {
        let entities: GeoEntity[] = [];
        switch (mode) {
            case "region":
                entities = regions as GeoEntity[];
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
            features: entities.map((e) => ({
                type: "Feature" as const,
                properties: { name: e.name, mode },
                geometry: e.geometry,
            })),
        };
    }, [mode, provinces, regions, municities]);

    const onEachFeature = useCallback(
        (feature: Feature, layer: L.GeoJSON) => {
            const name = feature.properties?.name as string;
            if (name) {
                layer.bindTooltip(name, { sticky: true, direction: "top" });
            }
            layer.on("mouseover", () => layer.setStyle(HOVER_STYLE));
            layer.on("mouseout", () => layer.setStyle(BASE_STYLE(mode)));
            layer.on("click", () => console.log(`[${mode}] Clicked:`, name));
        },
        [mode],
    );

    const modes: MapMode[] = ["region", "province", "municipality"];

    return (
        <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 500 }}>
            <div
                style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    zIndex: 1000,
                    background: "white",
                    borderRadius: 8,
                    padding: "6px 10px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    display: "flex",
                    gap: 6,
                    fontSize: 13,
                }}
            >
                {modes.map((m) => (
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        style={{
                            padding: "4px 12px",
                            cursor: "pointer",
                            border: mode === m ? `2px solid ${MODE_STYLES[m].color}` : "1px solid #ccc",
                            borderRadius: 4,
                            background: mode === m ? MODE_STYLES[m].color : "white",
                            color: mode === m ? "white" : "#333",
                            fontWeight: mode === m ? 600 : 400,
                            textTransform: "capitalize",
                        }}
                    >
                        {m}
                    </button>
                ))}
            </div>

            <MapContainer
                center={PH_CENTER}
                zoom={PH_ZOOM}
                zoomControl={false}
                style={{ width: "100%", height: "100%" }}
                scrollWheelZoom={true}
                preferCanvas={true}
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
