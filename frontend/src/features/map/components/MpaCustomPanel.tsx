// Custom tab: built-in overlay datasets + session-only CSV upload.

import { useEffect, useMemo, useState } from "react";
import { cn } from "../../../lib/cn";
import { downloadTextFile } from "../../../lib/downloadFile";
import type { MpaLevel } from "../constants";
import { useCustomDatasetValues, useCustomDatasets } from "../hooks/useCustomDatasets";
import type { CustomDataset, CustomOverlay } from "../types";
import { buildOverlayFromDataset } from "../utils/customOverlay";
import { overlayLevelMatchesMap } from "../utils/customScale";
import { formatPopulation } from "../utils/formatStats";
import { scaleLevelFor } from "../utils/mapScale";
import {
    CUSTOM_CSV_TEMPLATE,
    overlayFromParsedCsv,
    parseCustomCsv,
} from "../utils/parseCustomCsv";
import type { ResolvedPlace } from "../utils/resolvePlace";

interface MpaCustomPanelProps {
    mapLevel: MpaLevel;
    activeOverlay: CustomOverlay | null;
    onOverlayChange: (overlay: CustomOverlay | null) => void;
    selectedPlace: ResolvedPlace | null;
    knownPsgcs: Set<string>;
}

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

export function MpaCustomPanel({
    mapLevel,
    activeOverlay,
    onOverlayChange,
    selectedPlace,
    knownPsgcs,
}: MpaCustomPanelProps) {
    const datasetsQuery = useCustomDatasets();
    const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadTitle, setUploadTitle] = useState("");
    const valuesQuery = useCustomDatasetValues(selectedDatasetId);

    const hasBuiltinDatasets = (datasetsQuery.data?.length ?? 0) > 0;

    const grouped = useMemo(
        () => groupByCategory(datasetsQuery.data ?? []),
        [datasetsQuery.data],
    );

    const mapScaleLevel = scaleLevelFor(mapLevel);
    const levelMatches =
        activeOverlay != null && overlayLevelMatchesMap(activeOverlay.level, mapScaleLevel);

    useEffect(() => {
        if (!selectedDatasetId || !valuesQuery.data) return;
        const dataset = datasetsQuery.data?.find((d) => d.id === selectedDatasetId);
        if (!dataset) return;
        onOverlayChange(buildOverlayFromDataset(dataset, valuesQuery.data));
    }, [selectedDatasetId, valuesQuery.data, datasetsQuery.data, onOverlayChange]);

    const handleSelectBuiltin = (dataset: CustomDataset) => {
        setSelectedDatasetId(dataset.id);
        setUploadError(null);
    };

    const handleFileUpload = async (file: File | null) => {
        setUploadError(null);
        setSelectedDatasetId(null);
        if (!file) return;
        const text = await file.text();
        const result = parseCustomCsv(text, knownPsgcs);
        if (!result.ok) {
            setUploadError(result.error);
            return;
        }
        const title = uploadTitle.trim() || titleFromFilename(file.name);
        onOverlayChange(overlayFromParsedCsv(result.data, title));
    };

    const selectedValue =
        selectedPlace && activeOverlay
            ? activeOverlay.valuesByPsgc[selectedPlace.psgc.padStart(10, "0")]
            : null;

    return (
        <div className="space-y-5">
            <p className="text-sm text-muted">
                Upload a CSV to color the map by your own numbers (session only — not saved).
                {hasBuiltinDatasets ? " Or pick a built-in dataset below." : ""}
            </p>

            {hasBuiltinDatasets && (
                <section className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Built-in datasets</p>
                    {[...grouped.entries()].map(([category, items]) => (
                        <div key={category} className="space-y-1">
                            <p className="text-xs text-muted">{category}</p>
                            {items.map((dataset) => (
                                <button
                                    key={dataset.id}
                                    type="button"
                                    onClick={() => handleSelectBuiltin(dataset)}
                                    className={cn(
                                        "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                                        selectedDatasetId === dataset.id && activeOverlay?.source === "builtin"
                                            ? "border-accent bg-accent/5"
                                            : "border-border-light hover:bg-surface",
                                    )}
                                >
                                    <span className="font-medium text-primary">{dataset.title}</span>
                                    {dataset.description && (
                                        <span className="mt-0.5 block text-xs text-muted">{dataset.description}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    ))}
                    {selectedDatasetId && valuesQuery.isFetching && (
                        <p className="text-xs text-muted">Loading values…</p>
                    )}
                </section>
            )}

            <section className="space-y-2 rounded-lg border border-border-light bg-surface p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Upload CSV</p>
                <p className="text-xs text-muted">
                    Columns: <code className="text-primary">psgc,value</code> (optional{" "}
                    <code className="text-primary">label</code>). All rows must share one administrative level.
                </p>
                <label className="block space-y-1">
                    <span className="text-xs text-muted">Dataset title</span>
                    <input
                        type="text"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="Defaults to filename when you upload"
                        className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm text-primary"
                    />
                </label>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => downloadTextFile(CUSTOM_CSV_TEMPLATE, "custom-overlay-template.csv", "text/csv")}
                        className="rounded-md border border-accent/40 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10"
                    >
                        Download template
                    </button>
                    <label className="cursor-pointer rounded-md border border-border-light bg-white px-2 py-1 text-xs font-medium text-primary hover:bg-white/80">
                        Choose file…
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={(e) => void handleFileUpload(e.target.files?.[0] ?? null)}
                        />
                    </label>
                </div>
                {uploadError && <p className="text-xs text-rose-600">{uploadError}</p>}
            </section>

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
                            Switch map view to <strong>{activeOverlay.level}</strong> level to see this dataset on the
                            map.
                        </p>
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
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
