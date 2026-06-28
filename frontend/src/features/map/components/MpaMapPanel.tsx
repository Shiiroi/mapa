// Leaflet map; view mode driven by sidebar; click selects a division.

import { useMemo, useCallback, useState, type ReactNode } from "react";
import { MapContainer, TileLayer, GeoJSON, ZoomControl } from "react-leaflet";
import L from "leaflet";
import type { Feature, Geometry } from "geojson";
import { cn } from "../../../lib/cn";
import type { MpaLevel } from "../constants";
import type { CustomOverlay, SeriesViewState } from "../types";
import { colorForDensity, densityLegendItems, NO_DATA_COLOR } from "../utils/densityScale";
import { colorForPopulation, populationLegendItems, POPULATION_RAMP } from "../utils/populationScale";
import {
    assetsLegendItems,
    buildCategoricalOverlayScale,
    buildNumericOverlayScale,
    colorForAssets,
    colorForGdp,
    gdpLegendItems,
} from "../utils/customScale";
import { overlayActiveAtLevel } from "../utils/customOverlay";
import { SCALE_LEVEL_LABELS, scaleLevelFor } from "../utils/mapScale";
import { formatDensity, formatGdp, formatAssets, formatPopulation } from "../utils/formatStats";
import { buildSeriesScale, formatSeriesTooltip } from "../utils/seriesScale";

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

type DisplayMode = "outline" | "density" | "population" | "gdp" | "assets" | "custom";

const SHADING_OPTIONS: { mode: DisplayMode; label: string; requiresOverlay?: boolean }[] = [
    { mode: "outline", label: "Outline" },
    { mode: "density", label: "Density" },
    { mode: "population", label: "Population" },
    { mode: "gdp", label: "GDP" },
    { mode: "assets", label: "Assets" },
    { mode: "custom", label: "Custom", requiresOverlay: true },
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
    gdp_2024?: number | null;
    assets_2024?: number | null;
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
    overlay?: CustomOverlay | null;
    overlayView?: SeriesViewState;
}

// Shared legend box with a collapse toggle styled like the Controls pill for UI
// consistency. Collapsed shows just the "Legend" pill; the title moves into the panel.
function LegendShell({
    title,
    collapsed,
    onToggle,
    children,
}: {
    title: ReactNode;
    collapsed: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    return (
        <div className="absolute bottom-6 left-3 z-[1000] flex flex-col-reverse items-start gap-2">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={!collapsed}
                title={collapsed ? "Show legend" : "Hide legend"}
                className="flex items-center gap-1.5 rounded-lg border border-border-light bg-white px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted shadow-soft transition-colors hover:bg-surface hover:text-primary"
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="10" y1="6" x2="20" y2="6" />
                    <line x1="10" y1="12" x2="20" y2="12" />
                    <line x1="10" y1="18" x2="20" y2="18" />
                    <circle cx="4.5" cy="6" r="1.5" />
                    <circle cx="4.5" cy="12" r="1.5" />
                    <circle cx="4.5" cy="18" r="1.5" />
                </svg>
                <span>Legend</span>
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className={cn("transition-transform", collapsed ? "rotate-180" : "")}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>
            {!collapsed && (
                <div className="rounded-lg border border-border-light bg-white/95 px-3 py-2.5 text-[11px] shadow-soft">
                    <p className="mb-1.5 font-medium text-primary">{title}</p>
                    {children}
                </div>
            )}
        </div>
    );
}

function featureStyle(
    feature: Feature | undefined,
    displayMode: DisplayMode,
    psgcToColor: Map<string, string>,
    fillOpacity: number,
    overlayActive: boolean,
): L.PathOptions {
    if (displayMode === "outline" || !feature?.properties) {
        return BASE_STYLE;
    }
    if (displayMode === "custom" && !overlayActive) {
        return { ...BASE_STYLE, fillColor: NO_DATA_COLOR, fillOpacity };
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
    overlay = null,
    overlayView = { mode: "lead" },
}: MpaMapPanelProps) {
    const [userDisplayMode, setUserDisplayMode] = useState<DisplayMode>("outline");
    const [fillOpacity, setFillOpacity] = useState(0.7);
    const [controlsCollapsed, setControlsCollapsed] = useState(false);
    const [legendCollapsed, setLegendCollapsed] = useState(false);
    const toggleLegend = useCallback(() => setLegendCollapsed((v) => !v), []);

    const displayMode = useMemo((): DisplayMode => {
        if (overlay) return "custom";
        if (userDisplayMode === "custom") return "outline";
        return userDisplayMode;
    }, [overlay, userDisplayMode]);

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
                        gdp_2024: e.gdp_2024 ?? null,
                        assets_2024: e.assets_2024 ?? null,
                        mode,
                    },
                    geometry: e.geometry,
                })),
        };
    }, [mode, country, provinces, regions, municities, barangays]);

    // Per-level constant scales for density and population.
    const scaleLevel = scaleLevelFor(mode);
    // Country has a single feature, so population shading is just flat green
    // (a per-level scale would be meaningless for one value).
    const flatCountryPopulation = mode === "country";

    const { densityColors, populationColors, densityLegend, populationLegend } = useMemo(() => {
        const densityColors = new Map<string, string>();
        const populationColors = new Map<string, string>();
        for (const f of currentData.features) {
            const psgc = f.properties.psgc as string;
            densityColors.set(
                psgc,
                colorForDensity(f.properties.density_2024 as number | null, scaleLevel),
            );
            populationColors.set(
                psgc,
                flatCountryPopulation
                    ? POPULATION_RAMP[0]
                    : colorForPopulation(f.properties.pop_2024 as number | null, scaleLevel),
            );
        }
        return {
            densityColors,
            populationColors,
            densityLegend: densityLegendItems(scaleLevel),
            populationLegend: populationLegendItems(scaleLevel),
        };
    }, [currentData, scaleLevel, flatCountryPopulation]);

    const { gdpColors, gdpLegend, assetsColors, assetsLegend } = useMemo(() => {
        const gdpColors = new Map<string, string>();
        const assetsColors = new Map<string, string>();
        for (const f of currentData.features) {
            const psgc = f.properties.psgc as string;
            gdpColors.set(psgc, colorForGdp(f.properties.gdp_2024 as number | null, scaleLevel));
            assetsColors.set(psgc, colorForAssets(f.properties.assets_2024 as number | null, scaleLevel));
        }
        return {
            gdpColors,
            gdpLegend: gdpLegendItems(scaleLevel) ?? [],
            assetsColors,
            assetsLegend: assetsLegendItems(scaleLevel) ?? [],
        };
    }, [currentData, scaleLevel]);

    const overlayLevelOk = overlay != null && overlayActiveAtLevel(overlay, scaleLevel);
    const activeValues = useMemo(
        () => overlay?.valuesByLevel[scaleLevel] ?? {},
        [overlay, scaleLevel],
    );

    const { customColors, customLegend, customLegendTitle, customLegendNote } = useMemo(() => {
        if (!overlay || !overlayLevelOk) {
            return {
                customColors: new Map<string, string>(),
                customLegend: [],
                customLegendTitle: "",
                customLegendNote: undefined as string | undefined,
            };
        }
        const colors = new Map<string, string>();
        if (overlay.kind === "numeric") {
            const values = Object.values(activeValues)
                .map((v) => v.value)
                .filter((v): v is number => v != null);
            const { colorForValue, legend } = buildNumericOverlayScale(values);
            for (const [psgc, cell] of Object.entries(activeValues)) {
                colors.set(psgc, colorForValue(cell.value));
            }
            return {
                customColors: colors,
                customLegend: legend,
                customLegendTitle: overlay.meta.unit ? `(${overlay.meta.unit})` : "",
                customLegendNote: undefined,
            };
        }
        if (overlay.kind === "series") {
            const { colorForPsgc, legend, legendTitle, legendNote } = buildSeriesScale(overlay, overlayView);
            for (const psgc of Object.keys(activeValues)) {
                colors.set(psgc, colorForPsgc(psgc));
            }
            return {
                customColors: colors,
                customLegend: legend,
                customLegendTitle: legendTitle,
                customLegendNote: legendNote,
            };
        }
        const categories = Object.values(activeValues)
            .map((v) => v.category)
            .filter((c): c is string => !!c);
        const { categoryToColor, legend } = buildCategoricalOverlayScale(categories);
        for (const [psgc, cell] of Object.entries(activeValues)) {
            if (cell.category) colors.set(psgc, categoryToColor.get(cell.category) ?? NO_DATA_COLOR);
        }
        return {
            customColors: colors,
            customLegend: legend,
            customLegendTitle: "",
            customLegendNote: undefined,
        };
    }, [overlay, overlayLevelOk, overlayView, activeValues]);

    const activeColors = useMemo(() => {
        if (displayMode === "custom") return customColors;
        if (displayMode === "population") return populationColors;
        if (displayMode === "gdp") return gdpColors;
        if (displayMode === "assets") return assetsColors;
        return densityColors;
    }, [displayMode, customColors, populationColors, gdpColors, assetsColors, densityColors]);

    const getStyle = useCallback(
        (feature?: Feature) =>
            featureStyle(feature, displayMode, activeColors, fillOpacity, overlayLevelOk),
        [displayMode, activeColors, fillOpacity, overlayLevelOk],
    );

    const onEachFeature = useCallback(
        (feature: Feature, layer: L.GeoJSON) => {
            const name = feature.properties?.name as string;
            const psgc = feature.properties?.psgc as string;
            const density = feature.properties?.density_2024 as number | null | undefined;
            const pop = feature.properties?.pop_2024 as number | null | undefined;
            const gdp = feature.properties?.gdp_2024 as number | null | undefined;
            const assets = feature.properties?.assets_2024 as number | null | undefined;
            let tooltip = name;
            if (displayMode === "density" && density != null && density > 0) {
                tooltip = `${name} — ${formatDensity(density)}/km²`;
            } else if (displayMode === "population" && pop != null && pop > 0) {
                tooltip = `${name} — ${formatPopulation(pop)}`;
            } else if (displayMode === "gdp" && gdp != null && gdp > 0) {
                tooltip = `${name} — GDP ${formatGdp(gdp)}`;
            } else if (displayMode === "assets" && assets != null && assets > 0) {
                tooltip = `${name} — Assets ${formatAssets(assets)}`;
            } else if (displayMode === "custom" && overlay && overlayLevelOk) {
                const cell = overlay.valuesByPsgc[psgc];
                if (overlay.kind === "series") {
                    const seriesTip = formatSeriesTooltip(overlay, cell, overlayView);
                    if (seriesTip) tooltip = `${name} — ${seriesTip}`;
                } else if (cell?.category) tooltip = `${name} — ${cell.category}`;
                else if (cell?.value != null)
                    tooltip = `${name} — ${formatPopulation(Math.round(cell.value))}${overlay.meta.unit ? ` ${overlay.meta.unit}` : ""}`;
            }
            if (tooltip) {
                layer.bindTooltip(tooltip, { sticky: true, direction: "top" });
            }
            const baseForFeature = () =>
                featureStyle(feature, displayMode, activeColors, fillOpacity, overlayLevelOk);
            layer.on("mouseover", () => {
                layer.setStyle({ ...baseForFeature(), ...HOVER_STYLE });
            });
            layer.on("mouseout", () => layer.setStyle(baseForFeature()));
            layer.on("click", () => {
                if (psgc) onFeatureClick?.(psgc, mode);
            });
        },
        [mode, onFeatureClick, displayMode, activeColors, fillOpacity, overlay, overlayLevelOk, overlayView],
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
                <button
                    type="button"
                    onClick={() => setControlsCollapsed((v) => !v)}
                    aria-expanded={!controlsCollapsed}
                    title={controlsCollapsed ? "Show map controls" : "Hide map controls"}
                    className="flex items-center gap-1.5 rounded-lg border border-border-light bg-white px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted shadow-soft transition-colors hover:bg-surface hover:text-primary"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="4" y1="6" x2="20" y2="6" />
                        <line x1="4" y1="12" x2="20" y2="12" />
                        <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                    <span>Controls</span>
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className={cn("transition-transform", controlsCollapsed ? "" : "rotate-180")}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>

                {!controlsCollapsed && onLevelChange && (
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

                {!controlsCollapsed && (
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border-light bg-white p-1 shadow-soft">
                    <span className="px-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                        Shading
                    </span>
                    {SHADING_OPTIONS.map((opt) => {
                        const disabled = opt.requiresOverlay && !overlay;
                        return (
                            <button
                                key={opt.mode}
                                type="button"
                                disabled={disabled}
                                onClick={() => setUserDisplayMode(opt.mode)}
                                title={disabled ? "Upload a dataset in the Custom tab first" : undefined}
                                className={cn(
                                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                                    displayMode === opt.mode
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

                {!controlsCollapsed && displayMode !== "outline" && (
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

            {overlay && displayMode === "custom" && !overlayLevelOk && (
                <div className="absolute bottom-6 left-3 z-[1000] max-w-xs rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 shadow-soft">
                    Switch view to{" "}
                    {overlay.levels.map((l) => SCALE_LEVEL_LABELS[l as keyof typeof SCALE_LEVEL_LABELS] ?? l).join(", ")}{" "}
                    to see &ldquo;{overlay.meta.title}&rdquo;.
                </div>
            )}

            {displayMode === "custom" && overlay && overlayLevelOk && customLegend.length > 0 && (
                <LegendShell
                    title={overlay.kind === "series" ? customLegendTitle : overlay.meta.title}
                    collapsed={legendCollapsed}
                    onToggle={toggleLegend}
                >
                    <p className="mb-2 text-[10px] text-muted">
                        {overlay.kind === "series"
                            ? (customLegendNote ?? `${SCALE_LEVEL_LABELS[scaleLevel]} scale`)
                            : `${SCALE_LEVEL_LABELS[scaleLevel]} scale${customLegendTitle ? ` ${customLegendTitle}` : ""}`}
                    </p>
                    <div className="flex flex-col gap-0.5">
                        {customLegend.map((item) => (
                            <div key={item.label} className="flex items-center gap-2 text-muted">
                                <span
                                    className="h-3.5 w-5 shrink-0 rounded-sm border border-border-light"
                                    style={{ backgroundColor: item.color }}
                                />
                                <span className="leading-tight">{item.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-muted">
                        <span
                            className="h-3.5 w-5 shrink-0 rounded-sm border border-border-light"
                            style={{ backgroundColor: NO_DATA_COLOR }}
                        />
                        <span>No data</span>
                    </div>
                </LegendShell>
            )}

            {displayMode === "density" && (
                <LegendShell title="Population density [2024]" collapsed={legendCollapsed} onToggle={toggleLegend}>
                    <p className="mb-2 text-[10px] text-muted">
                        inhabitants / km² · {SCALE_LEVEL_LABELS[scaleLevel]} scale
                    </p>
                    <div className="flex">
                        <div className="flex flex-col overflow-hidden rounded-sm border border-border-light">
                            {densityLegend.map((item) => (
                                <span
                                    key={item.label}
                                    className="h-3.5 w-5"
                                    style={{ backgroundColor: item.color }}
                                />
                            ))}
                        </div>
                        <div className="flex flex-col">
                            {densityLegend.map((item) => (
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
                </LegendShell>
            )}

            {displayMode === "population" && !flatCountryPopulation && (
                <LegendShell title="Population [2024]" collapsed={legendCollapsed} onToggle={toggleLegend}>
                    <p className="mb-2 text-[10px] text-muted">
                        inhabitants · {SCALE_LEVEL_LABELS[scaleLevel]} scale
                    </p>
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
                </LegendShell>
            )}

            {displayMode === "gdp" && gdpLegend.length > 0 && (
                <LegendShell title="GDP [2024]" collapsed={legendCollapsed} onToggle={toggleLegend}>
                    <p className="mb-2 text-[10px] text-muted">constant 2018 prices · data-driven scale</p>
                    <div className="flex flex-col gap-0.5">
                        {gdpLegend.map((item) => (
                            <div key={item.label} className="flex items-center gap-2 text-muted">
                                <span
                                    className="h-3.5 w-5 shrink-0 rounded-sm border border-border-light"
                                    style={{ backgroundColor: item.color }}
                                />
                                <span className="leading-tight tabular-nums">{item.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-muted">
                        <span
                            className="h-3.5 w-5 shrink-0 rounded-sm border border-border-light"
                            style={{ backgroundColor: NO_DATA_COLOR }}
                        />
                        <span>No data</span>
                    </div>
                    {mode === "country" && (
                        <p className="mt-2 max-w-[200px] border-t border-border-light pt-2 text-[10px] leading-tight text-muted">
                            PH total is summed from PSA regional GDP (not a separate published figure).
                        </p>
                    )}
                </LegendShell>
            )}

            {displayMode === "assets" && assetsLegend.length > 0 && (
                <LegendShell title="Total assets [2024]" collapsed={legendCollapsed} onToggle={toggleLegend}>
                    <p className="mb-2 text-[10px] text-muted">COA AFR · data-driven scale</p>
                    <div className="flex flex-col gap-0.5">
                        {assetsLegend.map((item) => (
                            <div key={item.label} className="flex items-center gap-2 text-muted">
                                <span
                                    className="h-3.5 w-5 shrink-0 rounded-sm border border-border-light"
                                    style={{ backgroundColor: item.color }}
                                />
                                <span className="leading-tight tabular-nums">{item.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-muted">
                        <span
                            className="h-3.5 w-5 shrink-0 rounded-sm border border-border-light"
                            style={{ backgroundColor: NO_DATA_COLOR }}
                        />
                        <span>No data</span>
                    </div>
                    {scaleLevel === "region" && (
                        <p className="mt-2 max-w-[200px] border-t border-border-light pt-2 text-[10px] leading-tight text-muted">
                            Region totals are summed from their LGUs (COA AFR). PH total is the sum of all LGUs. NIR is not reported separately in the AFR, so it is derived from the LGUs of Negros Occidental, Negros Oriental, and Siquijor.
                        </p>
                    )}
                </LegendShell>
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
                    key={`${mode}-${displayMode}-${fillOpacity}-${currentData.features.length}-${overlay?.meta.title ?? ""}-${overlayView.mode}-${overlayView.shareKey ?? ""}-${overlayView.pairA ?? ""}-${overlayView.pairB ?? ""}`}
                    data={currentData}
                    style={getStyle}
                    onEachFeature={onEachFeature}
                />
            </MapContainer>
        </div>
    );
}
