// Place detail panel: population, area, density, and downloadable stats (no geometry).

import { useMemo } from "react";
import { cn } from "../../../lib/cn";
import { downloadJsonFile, downloadTextFile, slugifyFilename } from "../../../lib/downloadFile";
import { useDivisionStats } from "../hooks/useDivisionStats";
import {
    formatAnnualizedChange,
    formatAreaKm2,
    formatAssets,
    formatDensity,
    formatPctChange,
    formatPopulation,
} from "../utils/formatStats";
import { mergePlaceStats } from "../utils/mergePlaceStats";
import type { ResolvedPlace } from "../utils/resolvePlace";

interface MpaInfoPanelProps {
    place: ResolvedPlace | null;
}

const POP_HISTORY: { year: number; key: "pop_2015" | "pop_2020" | "pop_2024" }[] = [
    { year: 2015, key: "pop_2015" },
    { year: 2020, key: "pop_2020" },
    { year: 2024, key: "pop_2024" },
];

function pctChange(from: number | null, to: number | null): number | null {
    if (from == null || to == null || from === 0) return null;
    return ((to - from) / from) * 100;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="rounded-lg border border-border-light bg-white px-3 py-2.5">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-0.5 text-lg font-semibold text-primary">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
        </div>
    );
}

export function MpaInfoPanel({ place }: MpaInfoPanelProps) {
    const statsQuery = useDivisionStats(place?.psgc ?? null);
    const displayPlace = useMemo(
        () => (place ? mergePlaceStats(place, statsQuery.data) : null),
        [place, statsQuery.data],
    );

    if (!place) {
        return (
            <p className="text-sm text-muted">
                Select a place at the current view level to see population, area, and density.
            </p>
        );
    }

    if (!displayPlace) return null;

    const annualChange = formatAnnualizedChange(displayPlace.pct_change_2020_2024);

    function handleDownloadJson() {
        const date = new Date().toISOString().slice(0, 10);
        const payload = {
            psgc: displayPlace!.psgc,
            name: displayPlace!.name,
            level: displayPlace!.level,
            geo_lvl: displayPlace!.geo_lvl,
            breadcrumb: displayPlace!.breadcrumb,
            population_2024: displayPlace!.pop_2024,
            population_2020: displayPlace!.pop_2020,
            population_2015: displayPlace!.pop_2015,
            area_km2: displayPlace!.area_km2,
            density_2024_per_km2: displayPlace!.density_2024,
            pct_change_2020_2024: displayPlace!.pct_change_2020_2024,
            assets_2024: displayPlace!.assets_2024,
            source:
                "Population from the Philippine Statistics Authority (PSA) PSGC; area and derived metrics (density, % change) computed by Mapa from PSA boundaries. Total assets from COA CY2024 Annual Financial Report (Local Government), Part III Financial Profile.",
            source_url: "https://psa.gov.ph/classification/psgc/",
            assets_source: "COA CY2024 AFR",
        };
        downloadJsonFile(payload, `mapa-info-${slugifyFilename(displayPlace!.name)}-${date}.json`);
    }

    function handleDownloadCsv() {
        const date = new Date().toISOString().slice(0, 10);
        const rows = [
            ["field", "value"],
            ["psgc", displayPlace!.psgc],
            ["name", displayPlace!.name],
            ["level", displayPlace!.level],
            ["population_2024", String(displayPlace!.pop_2024 ?? "")],
            ["population_2020", String(displayPlace!.pop_2020 ?? "")],
            ["area_km2", String(displayPlace!.area_km2 ?? "")],
            ["density_2024", String(displayPlace!.density_2024 ?? "")],
            ["pct_change_2020_2024", String(displayPlace!.pct_change_2020_2024 ?? "")],
            ["assets_2024", String(displayPlace!.assets_2024 ?? "")],
            ["source", "Philippine Statistics Authority (PSA) PSGC; area/density/change derived by Mapa; assets from COA CY2024 AFR"],
            ["source_url", "https://psa.gov.ph/classification/psgc/"],
        ];
        const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
        downloadTextFile(csv, `mapa-info-${slugifyFilename(displayPlace!.name)}-${date}.csv`, "text/csv");
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-primary">{displayPlace.name}</h2>
                <p className="text-xs text-muted">{displayPlace.breadcrumb}</p>
                <p className="mt-1 font-mono text-xs text-muted">PSGC {displayPlace.psgc}</p>
                {displayPlace.geo_lvl === "Special" && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Non-residential parcel — not a PSGC census unit; no official population.
                        {displayPlace.note ? ` ${displayPlace.note}` : ""}
                    </p>
                )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <StatCard
                    label="Population [2024]"
                    value={formatPopulation(displayPlace.pop_2024)}
                    sub="PSA PSGC publication"
                />
                <StatCard
                    label="Area (km²)"
                    value={formatAreaKm2(displayPlace.area_km2)}
                    sub={displayPlace.area_km2 != null ? "Estimated from boundary polygon" : "No boundary loaded"}
                />
                <StatCard
                    label="Population density [2024]"
                    value={displayPlace.density_2024 != null ? `${formatDensity(displayPlace.density_2024)}/km²` : "—"}
                />
                <StatCard
                    label="Change [2020 → 2024]"
                    value={formatPctChange(displayPlace.pct_change_2020_2024)}
                    sub={
                        displayPlace.pop_2020 == null
                            ? "No comparable 2020 figure (boundary or code change)"
                            : annualChange ?? undefined
                    }
                />
                <StatCard
                    label="Total assets [2024]"
                    value={formatAssets(displayPlace.assets_2024)}
                    sub="COA Annual Financial Report"
                />
            </div>

            <p className="text-xs text-muted">
                Area is computed from the boundary geometry (geodesic), not an official figure, so
                it is approximate; density is derived from it.
            </p>

            {(displayPlace.pop_2015 != null ||
                displayPlace.pop_2020 != null ||
                displayPlace.pop_2024 != null) && (
                <section>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                        Population history (census)
                    </p>
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="text-xs text-muted">
                                <th className="py-1 pr-2 text-left font-medium">Census</th>
                                <th className="py-1 px-2 text-right font-medium">Population</th>
                                <th className="py-1 pl-2 text-right font-medium">Change</th>
                            </tr>
                        </thead>
                        <tbody>
                            {POP_HISTORY.map((row, i) => {
                                const value = displayPlace[row.key];
                                const prev = i > 0 ? displayPlace[POP_HISTORY[i - 1].key] : null;
                                const change = i > 0 ? pctChange(prev, value) : null;
                                return (
                                    <tr key={row.year} className="border-t border-border-light">
                                        <td className="py-1.5 pr-2 text-left text-muted">{row.year}</td>
                                        <td className="py-1.5 px-2 text-right font-medium text-primary">
                                            {formatPopulation(value)}
                                        </td>
                                        <td className="py-1.5 pl-2 text-right text-muted">
                                            {i === 0 ? "—" : formatPctChange(change)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </section>
            )}

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={handleDownloadJson}
                    className={cn(
                        "flex-1 rounded-lg border border-border-light bg-white px-3 py-2 text-sm font-medium text-primary hover:bg-surface",
                    )}
                >
                    Download info (JSON)
                </button>
                <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className={cn(
                        "flex-1 rounded-lg border border-border-light bg-white px-3 py-2 text-sm font-medium text-primary hover:bg-surface",
                    )}
                >
                    Download info (CSV)
                </button>
            </div>
        </div>
    );
}
