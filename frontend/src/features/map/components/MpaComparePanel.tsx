// Side-by-side comparison of two places (population, area, density).

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "../../../lib/cn";
import { useDivisionStats } from "../hooks/useDivisionStats";
import { fetchBarangaysByMunicity } from "../services/mapApi";
import type { MpaLevel } from "../constants";
import type { BarangayGeoJSON, CountryGeoJSON, MunicityGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";
import type { DensityBenchmarks } from "../utils/densityInsights";
import { buildDensityInsight } from "../utils/densityInsights";
import { formatAreaKm2, formatDensity, formatPctChange, formatPopulation } from "../utils/formatStats";
import { mergePlaceStats } from "../utils/mergePlaceStats";
import { resolveSelectedPlace, type ResolvedPlace } from "../utils/resolvePlace";

export interface CompareSelection {
    level: MpaLevel;
    regionPsgc: string | null;
    provincePsgc: string | null;
    municityPsgc: string | null;
    barangayPsgc: string | null;
}

const DEFAULT_SELECTION: CompareSelection = {
    level: "municipality",
    regionPsgc: null,
    provincePsgc: null,
    municityPsgc: null,
    barangayPsgc: null,
};

interface MpaComparePanelProps {
    country: CountryGeoJSON | null;
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municities: MunicityGeoJSON[];
    municityMeta: MunicityMeta[];
    benchmarks: DensityBenchmarks;
    /** Snapshot of the place currently selected on the map (null if none). */
    currentSelection: CompareSelection | null;
    /** Name of the currently selected place, for the button label. */
    currentSelectionName: string | null;
}

function emptySelection(level: MpaLevel): CompareSelection {
    return { ...DEFAULT_SELECTION, level };
}

function resolveComparePlace(
    sel: CompareSelection,
    ctx: Omit<MpaComparePanelProps, "benchmarks" | "barangaysByMunicity"> & { barangays: BarangayGeoJSON[] },
): ResolvedPlace | null {
    return resolveSelectedPlace({
        level: sel.level,
        country: ctx.country,
        regions: ctx.regions,
        provinces: ctx.provinces,
        municities: ctx.municities,
        municityMeta: ctx.municityMeta,
        barangays: ctx.barangays,
        selectedRegionPsgc: sel.regionPsgc,
        selectedProvincePsgc: sel.provincePsgc,
        selectedMunicityPsgc: sel.municityPsgc,
        selectedBarangayPsgc: sel.barangayPsgc,
    });
}

function ComparePicker({
    label,
    selection,
    onChange,
    regions,
    provinces,
    municityMeta,
    barangays,
    onUseMapSelection,
    mapSelectionName,
}: {
    label: string;
    selection: CompareSelection;
    onChange: (next: CompareSelection) => void;
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municityMeta: MunicityMeta[];
    barangays: BarangayGeoJSON[];
    onUseMapSelection?: () => void;
    mapSelectionName: string | null;
}) {
    const levels: MpaLevel[] = ["country", "region", "province", "municipality", "barangay"];
    const filteredMunis = selection.provincePsgc
        ? municityMeta.filter((m) => m.province_psgc === selection.provincePsgc)
        : municityMeta;

    return (
        <div className="space-y-2 rounded-lg border border-border-light bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
                {onUseMapSelection && (
                    <button
                        type="button"
                        onClick={onUseMapSelection}
                        disabled={!mapSelectionName}
                        title={mapSelectionName ? `Use ${mapSelectionName}` : "Select a place on the map first"}
                        className="rounded-md border border-accent/40 px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {mapSelectionName ? `Use map: ${mapSelectionName}` : "Use map selection"}
                    </button>
                )}
            </div>
            <select
                value={selection.level}
                onChange={(e) => onChange(emptySelection(e.target.value as MpaLevel))}
                className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm"
            >
                {levels.map((l) => (
                    <option key={l} value={l}>
                        {l.charAt(0).toUpperCase() + l.slice(1)}
                    </option>
                ))}
            </select>
            {selection.level === "region" && (
                <select
                    value={selection.regionPsgc ?? ""}
                    onChange={(e) => onChange({ ...selection, regionPsgc: e.target.value || null })}
                    className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm"
                >
                    <option value="">Select region…</option>
                    {regions.map((r) => (
                        <option key={r.psgc} value={r.psgc}>
                            {r.name.trim()}
                        </option>
                    ))}
                </select>
            )}
            {selection.level === "province" && (
                <select
                    value={selection.provincePsgc ?? ""}
                    onChange={(e) => onChange({ ...selection, provincePsgc: e.target.value || null })}
                    className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm"
                >
                    <option value="">Select province…</option>
                    {provinces.map((p) => (
                        <option key={p.psgc} value={p.psgc}>
                            {p.name.trim()}
                        </option>
                    ))}
                </select>
            )}
            {(selection.level === "municipality" || selection.level === "barangay") && (
                <select
                    value={selection.municityPsgc ?? ""}
                    onChange={(e) =>
                        onChange({ ...selection, municityPsgc: e.target.value || null, barangayPsgc: null })
                    }
                    className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm"
                >
                    <option value="">Select municipality…</option>
                    {filteredMunis.map((m) => (
                        <option key={m.psgc} value={m.psgc}>
                            {m.name.trim()}
                        </option>
                    ))}
                </select>
            )}
            {selection.level === "barangay" && (
                <select
                    value={selection.barangayPsgc ?? ""}
                    onChange={(e) => onChange({ ...selection, barangayPsgc: e.target.value || null })}
                    disabled={!selection.municityPsgc}
                    className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm disabled:opacity-50"
                >
                    <option value="">Select barangay…</option>
                    {barangays.map((b) => (
                        <option key={b.psgc} value={b.psgc}>
                            {b.name.trim()}
                        </option>
                    ))}
                </select>
            )}
        </div>
    );
}

function MetricRow({ label, a, b }: { label: string; a: string; b: string }) {
    return (
        <tr className="border-b border-border-light last:border-0">
            <td className="py-2 pr-2 text-xs text-muted">{label}</td>
            <td className="py-2 px-2 text-right text-sm font-medium text-primary">{a}</td>
            <td className="py-2 pl-2 text-right text-sm font-medium text-primary">{b}</td>
        </tr>
    );
}

export function MpaComparePanel({
    country,
    regions,
    provinces,
    municities,
    municityMeta,
    benchmarks,
    currentSelection,
    currentSelectionName,
}: MpaComparePanelProps) {
    const [selA, setSelA] = useState<CompareSelection>({ ...DEFAULT_SELECTION, level: "municipality" });
    const [selB, setSelB] = useState<CompareSelection>({ ...DEFAULT_SELECTION, level: "municipality" });

    const barangaysAQuery = useQuery({
        queryKey: ["barangays", "compare", selA.municityPsgc],
        queryFn: () => fetchBarangaysByMunicity(selA.municityPsgc!),
        enabled: selA.level === "barangay" && !!selA.municityPsgc,
        staleTime: 10 * 60 * 1000,
    });
    const barangaysBQuery = useQuery({
        queryKey: ["barangays", "compare", selB.municityPsgc],
        queryFn: () => fetchBarangaysByMunicity(selB.municityPsgc!),
        enabled: selB.level === "barangay" && !!selB.municityPsgc,
        staleTime: 10 * 60 * 1000,
    });

    const barangaysA = barangaysAQuery.data ?? [];
    const barangaysB = barangaysBQuery.data ?? [];

    const ctx = { country, regions, provinces, municities, municityMeta };
    const placeA = useMemo(
        () => resolveComparePlace(selA, { ...ctx, barangays: barangaysA }),
        [selA, ctx, barangaysA],
    );
    const placeB = useMemo(
        () => resolveComparePlace(selB, { ...ctx, barangays: barangaysB }),
        [selB, ctx, barangaysB],
    );

    const statsAQuery = useDivisionStats(placeA?.psgc ?? null);
    const statsBQuery = useDivisionStats(placeB?.psgc ?? null);

    const displayA = useMemo(
        () => (placeA ? mergePlaceStats(placeA, statsAQuery.data) : null),
        [placeA, statsAQuery.data],
    );
    const displayB = useMemo(
        () => (placeB ? mergePlaceStats(placeB, statsBQuery.data) : null),
        [placeB, statsBQuery.data],
    );

    const insightA = displayA ? buildDensityInsight(displayA.density_2024, displayA.level, benchmarks) : null;
    const insightB = displayB ? buildDensityInsight(displayB.density_2024, displayB.level, benchmarks) : null;

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted">Pick two places and compare population, area, and density side by side.</p>

            <div className="grid grid-cols-1 gap-3">
                <ComparePicker
                    label="Place A"
                    selection={selA}
                    onChange={setSelA}
                    regions={regions}
                    provinces={provinces}
                    municityMeta={municityMeta}
                    barangays={barangaysA}
                    onUseMapSelection={currentSelection ? () => setSelA(currentSelection) : undefined}
                    mapSelectionName={currentSelectionName}
                />
                <ComparePicker
                    label="Place B"
                    selection={selB}
                    onChange={setSelB}
                    regions={regions}
                    provinces={provinces}
                    municityMeta={municityMeta}
                    barangays={barangaysB}
                    onUseMapSelection={currentSelection ? () => setSelB(currentSelection) : undefined}
                    mapSelectionName={currentSelectionName}
                />
            </div>

            {displayA && displayB ? (
                <>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="text-xs text-muted">
                                <th className="pb-2 text-left font-medium">Metric</th>
                                <th className="pb-2 text-right font-medium">{displayA.name}</th>
                                <th className="pb-2 text-right font-medium">{displayB.name}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <MetricRow label="Population [2024]" a={formatPopulation(displayA.pop_2024)} b={formatPopulation(displayB.pop_2024)} />
                            <MetricRow label="Area (km²)" a={formatAreaKm2(displayA.area_km2)} b={formatAreaKm2(displayB.area_km2)} />
                            <MetricRow
                                label="Density [2024]"
                                a={displayA.density_2024 != null ? `${formatDensity(displayA.density_2024)}/km²` : "—"}
                                b={displayB.density_2024 != null ? `${formatDensity(displayB.density_2024)}/km²` : "—"}
                            />
                            <MetricRow
                                label="Change [2020→2024]"
                                a={formatPctChange(displayA.pct_change_2020_2024)}
                                b={formatPctChange(displayB.pct_change_2020_2024)}
                            />
                        </tbody>
                    </table>

                    {(insightA || insightB) && (
                        <div className="grid grid-cols-1 gap-2">
                            {insightA && (
                                <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-primary">
                                    <span className="font-medium text-accent">{displayA.name}:</span> {insightA}
                                </div>
                            )}
                            {insightB && (
                                <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-primary">
                                    <span className="font-medium text-accent">{displayB.name}:</span> {insightB}
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <p className={cn("text-sm text-muted")}>Select both places to see the comparison table.</p>
            )}
        </div>
    );
}
