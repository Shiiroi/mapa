// Custom tab: built-in overlay datasets + session-only CSV upload.

import { useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/cn";
import { downloadTextFile } from "../../lib/downloadFile";
import type { MapLevel } from "../constants";
import { SCALE_LEVEL_LABELS } from "../constants";
import { useCustomDatasetValues, useCustomDatasets } from "../hooks/useCustomDatasets";
import type { CustomDataset, CustomOverlay, SeriesViewMode, SeriesViewState } from "../types";
import { buildOverlayFromDataset, overlayActiveAtLevel } from "../utils/customOverlay";
import { formatPopulation } from "../utils/formatStats";
import {
    CUSTOM_CSV_TEMPLATE,
    CUSTOM_SERIES_CSV_TEMPLATE,
    overlayFromParsedCsv,
    parseCustomCsv,
} from "../utils/parseCustomCsv";
import type { ResolvedPlace } from "../utils/resolvePlace";
import {
    dominantSeries,
    leadMargin,
    seriesLabel,
    seriesModeLabel,
    seriesShare,
    seriesTotal,
} from "../utils/seriesScale";

interface CustomPanelProps {
    mapLevel: MapLevel;
    activeOverlay: CustomOverlay | null;
    onOverlayChange: (overlay: CustomOverlay | null) => void;
    overlayView: SeriesViewState;
    onOverlayViewChange: (view: SeriesViewState) => void;
    selectedPlace: ResolvedPlace | null;
    knownPsgcs: Set<string>;
    psgcLevels: ReadonlyMap<string, MapLevel>;
    psgcLevelsByTier: Partial<Record<MapLevel, ReadonlySet<string>>>;
    onOpenNotesModal: () => void;
}

const SERIES_MODES: { mode: SeriesViewMode; label: string; minSeries: number }[] = [
    { mode: "dominant", label: "Dominant", minSeries: 1 },
    { mode: "lead", label: "Lead", minSeries: 2 },
    { mode: "share", label: "Share", minSeries: 1 },
    { mode: "head2head", label: "Head-to-head", minSeries: 2 },
];

function groupByCategory(datasets: CustomDataset[]): Map<string, CustomDataset[]> {
    const map = new Map<string, CustomDataset[]>();
    for (const d of datasets) {
        if (!map.has(d.category)) map.set(d.category, []);
        map.get(d.category)!.push(d);
    }
    return map;
}

function titleFromFilename(filename: string): string {
    return filename.replace(/\.[^.]+$/, "").trim() || "Uploaded dataset";
}

function formatPct(n: number): string {
    return `${(n * 100).toFixed(1)}%`;
}

function DatasetToggle({
    active,
    disabled,
    onChange,
    label,
}: {
    active: boolean;
    disabled?: boolean;
    onChange: (on: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={active}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!active)}
            className={cn(
                "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                active ? "bg-accent" : "bg-border-light",
                disabled && "cursor-not-allowed opacity-50",
            )}
        >
            <span
                className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition",
                    active ? "translate-x-5" : "translate-x-0",
                )}
            />
        </button>
    );
}

export function CustomPanel({
    mapLevel,
    activeOverlay,
    onOverlayChange,
    overlayView,
    onOverlayViewChange,
    selectedPlace,
    knownPsgcs,
    psgcLevels,
    psgcLevelsByTier,
    onOpenNotesModal,
}: CustomPanelProps) {
    const datasetsQuery = useCustomDatasets();
    const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadTitle, setUploadTitle] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const valuesQuery = useCustomDatasetValues(selectedDatasetId);

    const hasBuiltinDatasets = (datasetsQuery.data?.length ?? 0) > 0;

    const grouped = useMemo(
        () => groupByCategory(datasetsQuery.data ?? []),
        [datasetsQuery.data],
    );

    const levelMatches = activeOverlay != null && overlayActiveAtLevel(activeOverlay, mapLevel);

    const seriesKeys = activeOverlay?.series?.map((s) => s.key) ?? [];
    const seriesCount = seriesKeys.length;

    useEffect(() => {
        if (!selectedDatasetId || !valuesQuery.data) return;
        const dataset = datasetsQuery.data?.find((d) => d.id === selectedDatasetId);
        if (!dataset) return;
        onOverlayChange(
            buildOverlayFromDataset(dataset, valuesQuery.data, psgcLevels, psgcLevelsByTier),
        );
    }, [selectedDatasetId, valuesQuery.data, datasetsQuery.data, onOverlayChange, psgcLevels, psgcLevelsByTier]);

    const handleToggleBuiltin = (dataset: CustomDataset, on: boolean) => {
        if (on) {
            setSelectedDatasetId(dataset.id);
            setUploadError(null);
            return;
        }
        if (selectedDatasetId === dataset.id) {
            setSelectedDatasetId(null);
            onOverlayChange(null);
        }
    };

    const handleFileUpload = async (file: File | null) => {
        setUploadError(null);
        setSelectedDatasetId(null);
        if (!file) return;
        const text = await file.text();
        const result = parseCustomCsv(text, knownPsgcs, psgcLevels, psgcLevelsByTier);
        if (result.ok === false) {
            setUploadError(result.error);
            return;
        }
        const finalTitle = uploadTitle.trim() || result.data.title?.trim() || titleFromFilename(file.name);
        onOverlayChange(overlayFromParsedCsv(result.data, finalTitle));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0] ?? null;
        void handleFileUpload(file);
    };

    const selectedValue =
        selectedPlace && activeOverlay
            ? activeOverlay.valuesByPsgc[selectedPlace.psgc.padStart(10, "0")]
            : null;

    const setMode = (mode: SeriesViewMode) => {
        onOverlayViewChange({ ...overlayView, mode });
    };

    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <h3 className="text-base font-bold text-primary">
                    Map Your Own Datasets
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                    Upload a custom CSV file to dynamically color and visualize your data across geographic boundaries. All processing happens locally within your web browser—your data is never sent to or stored on an external server.
                </p>
            </div>

            {hasBuiltinDatasets && (
                <section className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Built-in datasets</p>
                    {[...grouped.entries()].map(([category, items]) => (
                        <div key={category} className="space-y-2">
                            <p className="text-xs text-muted">{category}</p>
                            {items.map((dataset) => {
                                const isActive =
                                    selectedDatasetId === dataset.id && activeOverlay?.source === "builtin";
                                const isLoading = selectedDatasetId === dataset.id && valuesQuery.isFetching;
                                return (
                                    <div
                                        key={dataset.id}
                                        className={cn(
                                            "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                                            isActive ? "border-accent bg-accent/5" : "border-border-light bg-surface/50",
                                        )}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-primary">{dataset.title}</p>
                                            {dataset.id === "elections-2022-president" ? (
                                                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                                                    Data Context: National totals match the certified Congressional canvass exactly. Sub-national data is aggregated from the COMELEC transparency server.{" "}
                                                    <button
                                                        type="button"
                                                        onClick={onOpenNotesModal}
                                                        className="text-accent underline hover:text-primary font-medium transition-colors cursor-pointer"
                                                    >
                                                        [Click to view full election dataset audit details]
                                                    </button>
                                                </p>
                                            ) : (
                                                dataset.description && (
                                                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                                                        {dataset.description}
                                                    </p>
                                                )
                                            )}
                                            {dataset.id !== "elections-2022-president" && dataset.source_name && dataset.source_url && (
                                                <p className="mt-1 text-[11px] leading-relaxed">
                                                    <a
                                                        href={dataset.source_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-accent underline"
                                                    >
                                                        {dataset.source_name}
                                                    </a>
                                                </p>
                                            )}
                                            {isLoading && (
                                                <p className="mt-1 text-xs text-muted">Loading values…</p>
                                            )}
                                        </div>
                                        <DatasetToggle
                                            active={isActive}
                                            disabled={isLoading}
                                            label={`Toggle ${dataset.title}`}
                                            onChange={(on) => handleToggleBuiltin(dataset, on)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </section>
            )}

            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    "border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center transition-all cursor-pointer",
                    isDragging
                        ? "border-accent bg-accent/5 scale-[1.01]"
                        : "border-border hover:border-accent hover:bg-surface/50"
                )}
                onClick={() => {
                    document.getElementById("csv-file-input")?.click();
                }}
            >
                <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => void handleFileUpload(e.target.files?.[0] ?? null)}
                />
                
                <div className="text-center space-y-4">
                    <p className="text-sm font-semibold text-primary">
                        Click to upload or drag &amp; drop your CSV file here
                    </p>
                    
                    <div className="text-left max-w-md mx-auto space-y-2 border-t border-border-light pt-3 text-[11px] text-muted">
                        <p className="font-semibold text-primary">
                            Data Format Requirements:
                        </p>
                        <ul className="space-y-1.5 list-none pl-0">
                            <li>
                                • Key Column: Must include an identifier column named exactly "psgc", "province", or "city_mun".
                            </li>
                            <li>
                                • Simple Shading: Include a single value column (e.g., "value" or "total") to shade maps linearly.
                            </li>
                            <li>
                                • Data Breakdowns: Supply multiple series columns to visualize distributions (e.g., election metrics, budgets).
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border-light bg-surface/30 p-3">
                <label className="block space-y-1">
                    <span className="text-xs font-semibold text-primary">Custom Dataset Title</span>
                    <input
                        type="text"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="Defaults to filename if left blank"
                        className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-primary outline-none focus:border-accent"
                    />
                </label>
                
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => downloadTextFile(CUSTOM_CSV_TEMPLATE, "custom-overlay-template.csv", "text/csv")}
                        className="flex-1 rounded-lg border border-border bg-white py-1.5 text-xs font-medium text-primary hover:bg-surface"
                    >
                        Single-value template
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            downloadTextFile(
                                CUSTOM_SERIES_CSV_TEMPLATE,
                                "custom-series-template.csv",
                                "text/csv",
                            )
                        }
                        className="flex-1 rounded-lg border border-border bg-white py-1.5 text-xs font-medium text-primary hover:bg-surface"
                    >
                        Multi-series template
                    </button>
                </div>
                {uploadError && <p className="text-xs text-rose-600 mt-1 font-medium">{uploadError}</p>}
            </div>

            {activeOverlay && (
                <section className="space-y-2 rounded-lg border border-border-light p-3">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="text-sm font-medium text-primary">{activeOverlay.meta.title}</p>
                            {activeOverlay.meta.sourceName && (
                                <p className="text-xs text-muted">
                                    Source:{" "}
                                    {activeOverlay.meta.sourceUrl ? (
                                        <a
                                            href={activeOverlay.meta.sourceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent underline"
                                        >
                                            {activeOverlay.meta.sourceName}
                                        </a>
                                    ) : (
                                        activeOverlay.meta.sourceName
                                    )}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedDatasetId(null);
                                onOverlayChange(null);
                            }}
                            className="shrink-0 text-xs text-muted hover:text-primary"
                        >
                            Clear
                        </button>
                    </div>

                    {!levelMatches && (
                        <p className="text-xs text-amber-700">
                            Covers{" "}
                            {activeOverlay.levels
                                .map((l) => SCALE_LEVEL_LABELS[l as keyof typeof SCALE_LEVEL_LABELS] ?? l)
                                .join(", ")}
                            . Switch map view to one of those levels to see it on the map.
                        </p>
                    )}

                    {activeOverlay.kind === "series" && seriesCount > 0 && (
                        <div className="space-y-2 border-t border-border-light pt-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted">Visualization</p>
                            <div className="flex flex-wrap gap-1">
                                {SERIES_MODES.map(({ mode, label, minSeries }) => {
                                    const disabled = seriesCount < minSeries;
                                    return (
                                        <button
                                            key={mode}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => setMode(mode)}
                                            title={disabled ? `Needs at least ${minSeries} series` : undefined}
                                            className={cn(
                                                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                                                overlayView.mode === mode
                                                    ? "bg-accent text-white"
                                                    : "border border-border-light text-primary hover:bg-surface",
                                                disabled && "cursor-not-allowed opacity-40",
                                            )}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>

                            {overlayView.mode === "share" && (
                                <label className="block space-y-1">
                                    <span className="text-xs text-muted">Series</span>
                                    <select
                                        value={overlayView.shareKey ?? seriesKeys[0]}
                                        onChange={(e) =>
                                            onOverlayViewChange({ ...overlayView, shareKey: e.target.value })
                                        }
                                        className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm text-primary"
                                    >
                                        {activeOverlay.series!.map((s) => (
                                            <option key={s.key} value={s.key}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}

                            {overlayView.mode === "head2head" && seriesCount >= 2 && (
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="block space-y-1">
                                        <span className="text-xs text-muted">Series A</span>
                                        <select
                                            value={overlayView.pairA ?? seriesKeys[0]}
                                            onChange={(e) =>
                                                onOverlayViewChange({ ...overlayView, pairA: e.target.value })
                                            }
                                            className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm text-primary"
                                        >
                                            {activeOverlay.series!.map((s) => (
                                                <option key={s.key} value={s.key}>
                                                    {s.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="block space-y-1">
                                        <span className="text-xs text-muted">Series B</span>
                                        <select
                                            value={overlayView.pairB ?? seriesKeys[1]}
                                            onChange={(e) =>
                                                onOverlayViewChange({ ...overlayView, pairB: e.target.value })
                                            }
                                            className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm text-primary"
                                        >
                                            {activeOverlay.series!.map((s) => (
                                                <option key={s.key} value={s.key}>
                                                    {s.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            )}

                            <p className="text-[10px] text-muted">
                                Viewing: {seriesModeLabel(overlayView.mode)}
                                {activeOverlay.meta.unit ? ` · ${activeOverlay.meta.unit}` : ""}
                            </p>
                        </div>
                    )}

                    {selectedPlace && selectedValue && (
                        <div className="mt-2 border-t border-border-light pt-2">
                            <p className="text-xs text-muted">{selectedPlace.name}</p>
                            {activeOverlay.kind === "numeric" && selectedValue.value != null && (
                                <p className="text-lg font-semibold text-primary">
                                    {formatPopulation(Math.round(selectedValue.value))}
                                    {activeOverlay.meta.unit ? ` ${activeOverlay.meta.unit}` : ""}
                                </p>
                            )}
                            {activeOverlay.kind === "categorical" && selectedValue.category && (
                                <p className="text-lg font-semibold text-primary">{selectedValue.category}</p>
                            )}
                            {activeOverlay.kind === "series" && selectedValue.series && (
                                <div className="mt-1 space-y-1">
                                    {(() => {
                                        const top = dominantSeries(selectedValue);
                                        const total = seriesTotal(selectedValue);
                                        const margin = leadMargin(selectedValue);
                                        return (
                                            <>
                                                {top && (
                                                    <p className="text-sm font-semibold text-primary">
                                                        Dominant: {seriesLabel(activeOverlay, top.key)}
                                                        {total > 0 && ` (${formatPct(top.value / total)})`}
                                                        {margin != null && ` · +${formatPct(margin)} lead`}
                                                    </p>
                                                )}
                                                <ul className="space-y-0.5">
                                                    {activeOverlay.series!.map((def) => {
                                                        const val = selectedValue.series![def.key] ?? 0;
                                                        const share = seriesShare(selectedValue, def.key);
                                                        const isTop = top?.key === def.key;
                                                        return (
                                                            <li
                                                                key={def.key}
                                                                className={cn(
                                                                    "flex justify-between text-xs",
                                                                    isTop ? "font-medium text-primary" : "text-muted",
                                                                )}
                                                            >
                                                                <span>{def.label}</span>
                                                                <span className="tabular-nums">
                                                                    {formatPopulation(Math.round(val))}
                                                                    {share != null && ` (${formatPct(share)})`}
                                                                </span>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
