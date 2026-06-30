// Side-by-side comparison of two places (population, economy, households).

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "../../../lib/cn";
import { useDivisionStats } from "../hooks/useDivisionStats";
import { fetchBarangaysByMunicity } from "../services/mapApi";
import type { MapLevel } from "../constants";
import type { BarangayGeoJSON, CountryGeoJSON, CustomOverlay, MunicityGeoJSON, MunicityMeta, ProvinceGeoJSON, Region } from "../types";
import { broadAgeGroups } from "../utils/ageSex";
import {
    formatAreaKm2,
    formatAssets,
    formatDensity,
    formatGdp,
    formatPesoPerCapita,
    formatPopulation,
} from "../utils/formatStats";
import { mergePlaceStats } from "../utils/mergePlaceStats";
import { resolveSelectedPlace, type ResolvedPlace } from "../utils/resolvePlace";

export interface CompareSelection {
    level: MapLevel;
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

interface MapComparePanelProps {
    country: CountryGeoJSON | null;
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municities: MunicityGeoJSON[];
    municityMeta: MunicityMeta[];
    /** Snapshot of the place currently selected on the map (null if none). */
    currentSelection: CompareSelection | null;
    /** Name of the currently selected place, for the button label. */
    currentSelectionName: string | null;
    /** Active custom overlay from the Custom tab (null if none). */
    activeOverlay?: CustomOverlay | null;
}

function emptySelection(level: MapLevel): CompareSelection {
    return { ...DEFAULT_SELECTION, level };
}

function resolveComparePlace(
    sel: CompareSelection,
    ctx: Omit<MapComparePanelProps, "currentSelection" | "currentSelectionName"> & {
        barangays: BarangayGeoJSON[];
    },
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
    const levels: MapLevel[] = ["country", "region", "province", "municipality", "barangay"];
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
                onChange={(e) => onChange(emptySelection(e.target.value as MapLevel))}
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

type RowMode = "higher" | "none";

// Renders one comparison row, subtly highlighting the larger of the two values when mode is "higher".
function MetricRow({
    label,
    a,
    b,
    format,
    mode = "higher",
}: {
    label: string;
    a: number | null;
    b: number | null;
    format: (n: number | null) => string;
    mode?: RowMode;
}) {
    const aWins = mode === "higher" && a != null && b != null && a > b;
    const bWins = mode === "higher" && a != null && b != null && b > a;

    const cellClass = (wins: boolean) =>
        wins ? "text-sm font-semibold text-accent" : "text-sm font-medium text-primary";

    return (
        <tr className="border-b border-border-light last:border-0">
            <td className="py-2 pr-2 text-xs text-muted">{label}</td>
            <td className={cn("py-2 px-2 text-right", cellClass(aWins))}>{format(a)}</td>
            <td className={cn("py-2 pl-2 text-right", cellClass(bWins))}>{format(b)}</td>
        </tr>
    );
}

function CompareSection({
    title,
    nameA,
    nameB,
    children,
}: {
    title: string;
    nameA: string;
    nameB: string;
    children: ReactNode;
}) {
    return (
        <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
            <table className="w-full border-collapse">
                <thead>
                    <tr className="text-xs text-muted">
                        <th className="pb-2 text-left font-medium">Metric</th>
                        <th className="pb-2 text-right font-medium">{nameA}</th>
                        <th className="pb-2 text-right font-medium">{nameB}</th>
                    </tr>
                </thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    );
}

// Computes GDP per capita when both GDP and population are available.
function gdpPerCapita(gdp: number | null, pop: number | null): number | null {
    if (gdp == null || pop == null || pop <= 0) return null;
    return gdp / pop;
}

function formatDensityPerKm2(n: number | null): string {
    if (n == null) return "—";
    return `${formatDensity(n)}/km²`;
}

export function MapComparePanel({
    country,
    regions,
    provinces,
    municities,
    municityMeta,
    currentSelection,
    currentSelectionName,
    activeOverlay = null,
}: MapComparePanelProps) {
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

    const showPopulation =
        displayA &&
        displayB &&
        (displayA.pop_2024 != null ||
            displayB.pop_2024 != null ||
            displayA.area_km2 != null ||
            displayB.area_km2 != null ||
            displayA.density_2024 != null ||
            displayB.density_2024 != null);

    const showEconomy =
        displayA &&
        displayB &&
        (displayA.gdp_2024 != null ||
            displayB.gdp_2024 != null ||
            displayA.assets_2024 != null ||
            displayB.assets_2024 != null);

    const showHouseholds =
        displayA &&
        displayB &&
        ((displayA.age_sex_2020 != null && displayA.age_sex_2020.length > 0) ||
            (displayB.age_sex_2020 != null && displayB.age_sex_2020.length > 0));

    const ageGroupsA = displayA?.age_sex_2020 ? broadAgeGroups(displayA.age_sex_2020) : null;
    const ageGroupsB = displayB?.age_sex_2020 ? broadAgeGroups(displayB.age_sex_2020) : null;

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted">
                Pick two places and compare population, economy, and household stats side by side.
            </p>

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
                <div className="space-y-5">
                    {activeOverlay && (() => {
                        const psgcA = displayA.psgc.padStart(10, "0");
                        const psgcB = displayB.psgc.padStart(10, "0");
                        const cellA = activeOverlay.valuesByPsgc[psgcA];
                        const cellB = activeOverlay.valuesByPsgc[psgcB];
                        if (!cellA && !cellB) return null;
                        const label = activeOverlay.meta.unit
                            ? `${activeOverlay.meta.title} (${activeOverlay.meta.unit})`
                            : activeOverlay.meta.title;

                        if (activeOverlay.kind === "series" && activeOverlay.series?.length) {
                            return (
                                <CompareSection title={activeOverlay.meta.title} nameA={displayA.name} nameB={displayB.name}>
                                    {activeOverlay.series.map((def) => {
                                        const valA = cellA?.series?.[def.key] ?? null;
                                        const valB = cellB?.series?.[def.key] ?? null;
                                        const totalA = cellA?.series
                                            ? Object.values(cellA.series).reduce((s, v) => s + (v > 0 ? v : 0), 0)
                                            : 0;
                                        const totalB = cellB?.series
                                            ? Object.values(cellB.series).reduce((s, v) => s + (v > 0 ? v : 0), 0)
                                            : 0;
                                        const shareA = valA != null && totalA > 0 ? valA / totalA : null;
                                        const shareB = valB != null && totalB > 0 ? valB / totalB : null;
                                        const fmt = (v: number | null, share: number | null) => {
                                            if (v == null) return "—";
                                            const base = formatPopulation(Math.round(v));
                                            return share != null ? `${base} (${(share * 100).toFixed(1)}%)` : base;
                                        };
                                        return (
                                            <tr key={def.key} className="border-b border-border-light last:border-0">
                                                <td className="py-2 pr-2 text-xs text-muted">{def.label}</td>
                                                <td className="py-2 px-2 text-right text-sm font-medium text-primary tabular-nums">
                                                    {fmt(valA, shareA)}
                                                </td>
                                                <td className="py-2 pl-2 text-right text-sm font-medium text-primary tabular-nums">
                                                    {fmt(valB, shareB)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </CompareSection>
                            );
                        }

                        const valA = activeOverlay.kind === "numeric" ? (cellA?.value ?? null) : null;
                        const valB = activeOverlay.kind === "numeric" ? (cellB?.value ?? null) : null;
                        const catA = activeOverlay.kind === "categorical" ? (cellA?.category ?? "—") : null;
                        const catB = activeOverlay.kind === "categorical" ? (cellB?.category ?? "—") : null;
                        return (
                            <CompareSection title={activeOverlay.meta.title} nameA={displayA.name} nameB={displayB.name}>
                                {activeOverlay.kind === "numeric" ? (
                                    <MetricRow
                                        label={label}
                                        a={valA}
                                        b={valB}
                                        format={formatPopulation}
                                    />
                                ) : (
                                    <tr className="border-b border-border-light last:border-0">
                                        <td className="py-2 pr-2 text-xs text-muted">{label}</td>
                                        <td className="py-2 px-2 text-right text-sm font-medium text-primary">{catA}</td>
                                        <td className="py-2 pl-2 text-right text-sm font-medium text-primary">{catB}</td>
                                    </tr>
                                )}
                            </CompareSection>
                        );
                    })()}

                    {showPopulation && (
                        <CompareSection title="Population" nameA={displayA.name} nameB={displayB.name}>
                            <MetricRow
                                label="Population [2024]"
                                a={displayA.pop_2024}
                                b={displayB.pop_2024}
                                format={formatPopulation}
                            />
                            <MetricRow
                                label="Area (km²)"
                                a={displayA.area_km2}
                                b={displayB.area_km2}
                                format={formatAreaKm2}
                            />
                            <MetricRow
                                label="Density [2024]"
                                a={displayA.density_2024}
                                b={displayB.density_2024}
                                format={formatDensityPerKm2}
                            />
                        </CompareSection>
                    )}

                    {showEconomy && (
                        <CompareSection title="Economy" nameA={displayA.name} nameB={displayB.name}>
                            <MetricRow
                                label="GDP [2024]"
                                a={displayA.gdp_2024}
                                b={displayB.gdp_2024}
                                format={formatGdp}
                            />
                            <MetricRow
                                label="GDP per capita [2024]"
                                a={gdpPerCapita(displayA.gdp_2024, displayA.pop_2024)}
                                b={gdpPerCapita(displayB.gdp_2024, displayB.pop_2024)}
                                format={formatPesoPerCapita}
                            />
                            <MetricRow
                                label="Total assets [2024]"
                                a={displayA.assets_2024}
                                b={displayB.assets_2024}
                                format={formatAssets}
                            />
                        </CompareSection>
                    )}

                    {showHouseholds && (
                        <CompareSection title="Households 2020" nameA={displayA.name} nameB={displayB.name}>
                            <MetricRow
                                label="Male"
                                a={displayA.pop_male_2020}
                                b={displayB.pop_male_2020}
                                format={formatPopulation}
                            />
                            <MetricRow
                                label="Female"
                                a={displayA.pop_female_2020}
                                b={displayB.pop_female_2020}
                                format={formatPopulation}
                            />
                            <MetricRow
                                label="Age 0–14"
                                a={ageGroupsA?.young ?? null}
                                b={ageGroupsB?.young ?? null}
                                format={formatPopulation}
                            />
                            <MetricRow
                                label="Age 15–64"
                                a={ageGroupsA?.working ?? null}
                                b={ageGroupsB?.working ?? null}
                                format={formatPopulation}
                            />
                            <MetricRow
                                label="Age 65+"
                                a={ageGroupsA?.senior ?? null}
                                b={ageGroupsB?.senior ?? null}
                                format={formatPopulation}
                            />
                        </CompareSection>
                    )}
                </div>
            ) : (
                <p className={cn("text-sm text-muted")}>Select both places to see the comparison table.</p>
            )}
        </div>
    );
}
