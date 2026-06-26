// Leaflet map; view mode driven by sidebar; click selects a division.

import { useMemo, useCallback, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, ZoomControl } from "react-leaflet";
import L from "leaflet";
import type { Feature, Geometry } from "geojson";
import { cn } from "../../../lib/cn";
import type { MpaLevel } from "../constants";
import { colorForDensity, legendItems, NO_DATA_COLOR } from "../utils/densityScale";
import {
    colorForPopulation,
    computePopulationBreaks,
    populationLegendItems,
} from "../utils/populationScale";
import { formatDensity, formatPopulation } from "../utils/formatStats";

const PH_CENTER: [number, number] = [12.8797, 121.774];
const PH_ZOOM = 6;
// Outermost zoom + hard pan limit so the map can't show beyond the Philippines.
const PH_MIN_ZOOM = 5;
const PH_MAX_BOUNDS: L.LatLngBoundsLiteral = [
    [3.0, 115.0],
    [22.5, 128.0],
];

const BASE_STYLE: L.PathOptions = {
    color: "#2b6cb0",
    weight: 0.8,
    fillColor: "#3182ce",
    fillOpacity: 0.15,
    renderer: L.canvas(),
};

const HOVER_STYLE: L.PathOptions = {
    weight: 2,
    fillOpacity: 0.85,
};

type DisplayMode = "outline" | "density" | "population";

const DENSITY_LEGEND = legendItems();

const SHADING_OPTIONS: { mode: DisplayMode; label: string }[] = [
    { mode: "outline", label: "Outline" },
    { mode: "density", label: "Density" },
    { mode: "population", label: "Population" },
];

const BASE_LEVELS: { level: MpaLevel; label: string }[] = [
    { level: "country", label: "Philippines" },
    { level: "region", label: "Region" },
    { level: "province", label: "Province" },
    { level: "municipality", label: "City / Mun" },
];

export interface MapEntity {
    psgc: string;
    name: string;
    geometry: Geometry;
    region_psgc?: string | null;
    province_psgc?: string | null;
    geo_lvl?: string;
    city_lvl?: string | null;
    density_2024?: number | null;
    pop_2024?: number | null;
}

interface MpaMapPanelProps {
    country?: MapEntity | null;
    provinces?: MapEntity[];
    regions?: MapEntity[];
    municities?: MapEntity[];
    barangays?: MapEntity[];
    mode: MpaLevel;
    onFeatureClick?: (entityPsgc: string, mode: MpaLevel) => void;
    onLevelChange?: (level: MpaLevel) => void;
    /** Barangay view is only selectable once a municipality is chosen. */
    barangayAvailable?: boolean;
    loading?: boolean;
    error?: Error | null;
}

function featureStyle(
    feature: Feature | undefined,
    displayMode: DisplayMode,
    psgcToColor: Map<string, string>,
    fillOpacity: number,
): L.PathOptions {
    if (displayMode === "outline" || !feature?.properties) {
        return BASE_STYLE;
    }
    const psgc = feature.properties.psgc as string;
    const fillColor = psgcToColor.get(psgc) ?? NO_DATA_COLOR;
    return {
        ...BASE_STYLE,
        fillColor,
        fillOpacity,
    };
}

export function MpaMapPanel({
    country = null,
    provinces = [],
    regions = [],
    municities = [],
    barangays = [],
    mode,
    onFeatureClick,
    onLevelChange,
    barangayAvailable = false,
    loading,
    error,
}: MpaMapPanelProps) {
    const [displayMode, setDisplayMode] = useState<DisplayMode>("outline");
    const [fillOpacity, setFillOpacity] = useState(0.7);

    const levelOptions = [...BASE_LEVELS, { level: "barangay" as MpaLevel, label: "Barangay" }];

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
                        density_2024: e.density_2024 ?? null,
                        pop_2024: e.pop_2024 ?? null,
                        mode,
                    },
                    geometry: e.geometry,
                })),
        };
    }, [mode, country, provinces, regions, municities, barangays]);

    // Density uses a fixed absolute scale; population is adaptive (quantile)
    // per current view since absolute counts differ hugely between levels.
    const { densityColors, populationColors, populationLegend } = useMemo(() => {
        const densityColors = new Map<string, string>();
        const populationColors = new Map<string, string>();
        const pops: number[] = [];
        for (const f of currentData.features) {
            const psgc = f.properties.psgc as string;
            densityColors.set(psgc, colorForDensity(f.properties.density_2024 as number | null));
            const pop = f.properties.pop_2024 as number | null;
            if (pop != null && pop > 0) pops.push(pop);
        }
        const popBreaks = computePopulationBreaks(pops);
        for (const f of currentData.features) {
            const psgc = f.properties.psgc as string;
            populationColors.set(psgc, colorForPopulation(f.properties.pop_2024 as number | null, popBreaks));
        }
        return {
            densityColors,
            populationColors,
            populationLegend: populationLegendItems(popBreaks, pops),
        };
    }, [currentData]);

    const activeColors = useMemo(
        () => (displayMode === "population" ? populationColors : densityColors),
        [displayMode, populationColors, densityColors],
    );

    const getStyle = useCallback(
        (feature?: Feature) => featureStyle(feature, displayMode, activeColors, fillOpacity),
        [displayMode, activeColors, fillOpacity],
    );

    const onEachFeature = useCallback(
        (feature: Feature, layer: L.GeoJSON) => {
            const name = feature.properties?.name as string;
            const psgc = feature.properties?.psgc as string;
            const density = feature.properties?.density_2024 as number | null | undefined;
            const pop = feature.properties?.pop_2024 as number | null | undefined;
            let tooltip = name;
            if (displayMode === "density" && density != null && density > 0) {
                tooltip = `${name} — ${formatDensity(density)}/km²`;
            } else if (displayMode === "population" && pop != null && pop > 0) {
                tooltip = `${name} — ${formatPopulation(pop)}`;
            }
            if (tooltip) {
                layer.bindTooltip(tooltip, { sticky: true, direction: "top" });
            }
            const baseForFeature = () =>
                featureStyle(feature, displayMode, activeColors, fillOpacity);
            layer.on("mouseover", () => {
                layer.setStyle({ ...baseForFeature(), ...HOVER_STYLE });
            });
            layer.on("mouseout", () => layer.setStyle(baseForFeature()));
            layer.on("click", () => {
                if (psgc) onFeatureClick?.(psgc, mode);
            });
        },
        [mode, onFeatureClick, displayMode, activeColors, fillOpacity],
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

            <div className="absolute top-3 left-3 z-[1000] flex flex-col items-start gap-2">
                {onLevelChange && (
                    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border-light bg-white p-1 shadow-soft">
                        <span className="px-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                            View by
                        </span>
                        {levelOptions.map((opt) => {
                            const disabled = opt.level === "barangay" && !barangayAvailable;
                            return (
                                <button
                                    key={opt.level}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => onLevelChange(opt.level)}
                                    title={disabled ? "Select a municipality first" : undefined}
                                    className={cn(
                                        "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                                        mode === opt.level
                                            ? "bg-accent text-white"
                                            : "text-primary hover:bg-surface",
                                        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
                                    )}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="flex items-center gap-1 rounded-lg border border-border-light bg-white p-1 shadow-soft">
                    <span className="px-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                        Shading
                    </span>
                    {SHADING_OPTIONS.map((opt) => (
                        <button
                            key={opt.mode}
                            type="button"
                            onClick={() => setDisplayMode(opt.mode)}
                            className={cn(
                                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                                displayMode === opt.mode
                                    ? "bg-accent text-white"
                                    : "text-primary hover:bg-surface",
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {displayMode !== "outline" && (
                    <div className="flex items-center gap-2 rounded-lg border border-border-light bg-white px-2 py-1.5 shadow-soft">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
                            Opacity
                        </span>
                        <input
                            type="range"
                            min={20}
                            max={100}
                            step={5}
                            value={Math.round(fillOpacity * 100)}
                            onChange={(e) => setFillOpacity(Number(e.target.value) / 100)}
                            className="w-24 accent-accent"
                        />
                        <span className="w-8 text-right text-[10px] tabular-nums text-muted">
                            {Math.round(fillOpacity * 100)}%
                        </span>
                    </div>
                )}
            </div>

            {displayMode === "density" && (
                <div className="absolute bottom-6 left-3 z-[1000] rounded-lg border border-border-light bg-white/95 px-3 py-2.5 text-[11px] shadow-soft">
                    <p className="font-medium text-primary">Population density [2024]</p>
                    <p className="mb-2 text-[10px] text-muted">inhabitants / km²</p>
                    <div className="flex">
                        <div className="flex flex-col overflow-hidden rounded-sm border border-border-light">
                            {DENSITY_LEGEND.map((item) => (
                                <span
                                    key={item.label}
                                    className="h-3.5 w-5"
                                    style={{ backgroundColor: item.color }}
                                />
                            ))}
                        </div>
                        <div className="flex flex-col">
                            {DENSITY_LEGEND.map((item) => (
                                <span
                                    key={item.label}
                                    className="flex h-3.5 items-center pl-2 leading-none text-muted tabular-nums"
                                >
                                    {item.label}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-muted">
                        <span
                            className="h-3.5 w-5 shrink-0 rounded-sm border border-border-light"
                            style={{ backgroundColor: NO_DATA_COLOR }}
                        />
                        <span>No data</span>
                    </div>
                </div>
            )}

            {displayMode === "population" && (
                <div className="absolute bottom-6 left-3 z-[1000] rounded-lg border border-border-light bg-white/95 px-3 py-2.5 text-[11px] shadow-soft">
                    <p className="font-medium text-primary">Population [2024]</p>
                    <p className="mb-2 text-[10px] text-muted">inhabitants · scaled to this view</p>
                    {populationLegend.length === 0 ? (
                        <p className="text-muted">No data</p>
                    ) : (
                        <>
                            <div className="flex">
                                <div className="flex flex-col overflow-hidden rounded-sm border border-border-light">
                                    {populationLegend.map((item) => (
                                        <span
                                            key={item.label}
                                            className="h-5 w-5"
                                            style={{ backgroundColor: item.color }}
                                        />
                                    ))}
                                </div>
                                <div className="flex flex-col">
                                    {populationLegend.map((item) => (
                                        <span
                                            key={item.label}
                                            className="flex h-5 items-center pl-2 leading-none text-muted tabular-nums"
                                        >
                                            {item.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-muted">
                                <span
                                    className="h-3.5 w-5 shrink-0 rounded-sm border border-border-light"
                                    style={{ backgroundColor: NO_DATA_COLOR }}
                                />
                                <span>No data</span>
                            </div>
                        </>
                    )}
                </div>
            )}

            <MapContainer
                center={PH_CENTER}
                zoom={PH_ZOOM}
                minZoom={PH_MIN_ZOOM}
                maxBounds={PH_MAX_BOUNDS}
                maxBoundsViscosity={1.0}
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
                    key={`${mode}-${displayMode}-${fillOpacity}-${currentData.features.length}`}
                    data={currentData}
                    style={getStyle}
                    onEachFeature={onEachFeature}
                />
            </MapContainer>
        </div>
    );
}
