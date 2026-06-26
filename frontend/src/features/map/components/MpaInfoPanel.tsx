// Place detail panel: population, area, density, and downloadable stats (no geometry).

import { useMemo } from "react";
import { cn } from "../../../lib/cn";
import { downloadJsonFile, downloadTextFile, slugifyFilename } from "../../../lib/downloadFile";
import { useDivisionStats } from "../hooks/useDivisionStats";
import {
    compoundAnnualGrowthRate,
    formatAnnualizedChange,
    formatAreaKm2,
    formatAssets,
    formatDensity,
    formatGrowthRate,
    formatPctChange,
    formatPopulation,
} from "../utils/formatStats";
import { mergePlaceStats } from "../utils/mergePlaceStats";
import type { AgeSexBand } from "../types";
import type { ResolvedPlace } from "../utils/resolvePlace";

interface MpaInfoPanelProps {
    place: ResolvedPlace | null;
}

const PSA_PSGC_URL = "https://psa.gov.ph/classification/psgc/";
const PSA_AGESEX_URL =
    "https://psa.gov.ph/content/age-and-sex-distribution-philippine-population-2020-census-population-and-housing";
const PSA_AGESEX_FILE_URL =
    "https://psa.gov.ph/system/files/phcd/2022-12/4_Household%2520Population%2520by%2520Age%2520Group%2520and%2520Sex_Philippines_2020%2520CPH_rev.xlsx";

const POP_HISTORY: { year: number; key: "pop_2010" | "pop_2015" | "pop_2020" | "pop_2024" }[] = [
    { year: 2010, key: "pop_2010" },
    { year: 2015, key: "pop_2015" },
    { year: 2020, key: "pop_2020" },
    { year: 2024, key: "pop_2024" },
];

// Gives the plain total percent change between two census figures.
function totalPctChange(from: number | null, to: number | null): number | null {
    if (from == null || to == null || from === 0) return null;
    return ((to - from) / from) * 100;
}

// Shortens large counts for chart labels, e.g. 12,600,000 becomes 12.6M.
function formatCompactNumber(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) {
        const m = n / 1_000_000;
        return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
    }
    if (abs >= 1_000) {
        const k = n / 1_000;
        return `${Number.isInteger(k) ? k : k.toFixed(0)}K`;
    }
    return String(Math.round(n));
}

// Reads the lower-bound age from a PSA band label, e.g. "65 - 69" gives 65.
function bandLowerAge(age: string): number {
    const m = age.match(/\d+/);
    return m ? Number(m[0]) : 0;
}

interface BroadAgeGroups {
    young: number;
    working: number;
    senior: number;
    total: number;
}

// Folds the 5-year bands into young (0-14), working-age (15-64), and senior (65+) totals.
function broadAgeGroups(bands: AgeSexBand[]): BroadAgeGroups {
    let young = 0;
    let working = 0;
    let senior = 0;
    for (const b of bands) {
        const lower = bandLowerAge(b.age);
        if (lower < 15) young += b.both;
        else if (lower < 65) working += b.both;
        else senior += b.both;
    }
    return { young, working, senior, total: young + working + senior };
}

// Rounds up to a visually tidy axis maximum (1, 2, 2.5, 5, or 10 times a power of ten).
function niceAxisMax(value: number): number {
    if (value <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(value)));
    const norm = value / pow;
    const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return niceNorm * pow;
}

// Draws an inline SVG line chart of population across census years, with axes and gridlines.
function PopulationTrendChart({ points }: { points: { year: number; value: number }[] }) {
    if (points.length < 2) return null;
    const W = 340;
    const H = 180;
    const padLeft = 38;
    const padRight = 12;
    const padTop = 16;
    const padBottom = 26;
    const plotW = W - padLeft - padRight;
    const plotH = H - padTop - padBottom;

    const minYear = points[0].year;
    const maxYear = points[points.length - 1].year;
    const maxValue = Math.max(...points.map((p) => p.value));
    const yMax = niceAxisMax(maxValue);
    const tickCount = 4;
    const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => (yMax / tickCount) * i);

    const x = (year: number) =>
        maxYear === minYear ? padLeft + plotW / 2 : padLeft + ((year - minYear) / (maxYear - minYear)) * plotW;
    const y = (value: number) => padTop + (1 - value / yMax) * plotH;
    const baseline = padTop + plotH;

    const line = points.map((p) => `${x(p.year).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");

    return (
        <div className="text-accent">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Population over time">
                {yTicks.map((t) => (
                    <g key={t}>
                        <line
                            x1={padLeft}
                            y1={y(t)}
                            x2={W - padRight}
                            y2={y(t)}
                            stroke="currentColor"
                            strokeOpacity={t === 0 ? 0.25 : 0.1}
                            strokeDasharray={t === 0 ? undefined : "3 3"}
                        />
                        <text x={padLeft - 5} y={y(t) + 3} textAnchor="end" className="fill-muted text-[9px]">
                            {formatCompactNumber(t)}
                        </text>
                    </g>
                ))}

                <polyline points={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />

                {points.map((p) => (
                    <g key={p.year}>
                        <line
                            x1={x(p.year)}
                            y1={baseline}
                            x2={x(p.year)}
                            y2={baseline + 3}
                            stroke="currentColor"
                            strokeOpacity={0.3}
                        />
                        <circle cx={x(p.year)} cy={y(p.value)} r={3.5} fill="currentColor" />
                        <text
                            x={x(p.year)}
                            y={y(p.value) - 6}
                            textAnchor="middle"
                            className="fill-primary text-[9px] font-medium"
                        >
                            {formatCompactNumber(p.value)}
                        </text>
                        <text x={x(p.year)} y={H - 8} textAnchor="middle" className="fill-muted text-[9px]">
                            {p.year}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}

// Shows the male/female share as a single split bar with percentage labels.
function SexSplit({ male, female }: { male: number; female: number }) {
    const total = male + female;
    if (total === 0) return null;
    const malePct = (male / total) * 100;
    const femalePct = 100 - malePct;
    return (
        <div>
            <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-sky-600">Males {malePct.toFixed(1)}%</span>
                <span className="font-medium text-rose-600">Females {femalePct.toFixed(1)}%</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full">
                <div className="bg-sky-500/80" style={{ width: `${malePct}%` }} />
                <div className="bg-rose-500/80" style={{ width: `${femalePct}%` }} />
            </div>
        </div>
    );
}

const AGE_GROUP_META: { key: keyof BroadAgeGroups; label: string; bar: string; text: string }[] = [
    { key: "young", label: "0–14 years", bar: "bg-sky-500/80", text: "text-sky-600" },
    { key: "working", label: "15–64 years", bar: "bg-emerald-500/80", text: "text-emerald-600" },
    { key: "senior", label: "65+ years", bar: "bg-amber-500/80", text: "text-amber-600" },
];

// Renders the broad age groups as a stacked bar plus a labelled count/percentage legend.
function AgeGroupBreakdown({ groups }: { groups: BroadAgeGroups }) {
    if (groups.total === 0) return null;
    return (
        <div className="space-y-2">
            <div className="flex h-3 overflow-hidden rounded-full">
                {AGE_GROUP_META.map((g) => (
                    <div
                        key={g.key}
                        className={g.bar}
                        style={{ width: `${(groups[g.key] / groups.total) * 100}%` }}
                    />
                ))}
            </div>
            <div className="space-y-1">
                {AGE_GROUP_META.map((g) => {
                    const value = groups[g.key];
                    const pct = (value / groups.total) * 100;
                    return (
                        <div key={g.key} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5">
                                <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", g.bar)} />
                                <span className="text-muted">{g.label}</span>
                            </span>
                            <span>
                                <span className="font-medium text-primary">{formatPopulation(value)}</span>
                                <span className={cn("ml-1.5", g.text)}>{pct.toFixed(1)}%</span>
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Lays out a back-to-back age-sex pyramid with male bars left, female right, and counts on the edges.
function AgeSexPyramid({ bands }: { bands: AgeSexBand[] }) {
    const maxCount = Math.max(...bands.map((b) => Math.max(b.male, b.female)), 1);
    return (
        <div className="space-y-0.5">
            <div className="grid grid-cols-[3rem_1fr_4rem_1fr_3rem] items-center gap-1 text-[10px] uppercase tracking-wide text-muted">
                <span className="text-right">Male</span>
                <span />
                <span className="text-center">Age</span>
                <span />
                <span className="text-left">Female</span>
            </div>
            {bands.map((band) => {
                const malePct = (band.male / maxCount) * 100;
                const femalePct = (band.female / maxCount) * 100;
                return (
                    <div
                        key={band.age}
                        className="grid grid-cols-[3rem_1fr_4rem_1fr_3rem] items-center gap-1 text-[10px]"
                    >
                        <span className="text-right tabular-nums text-sky-700">
                            {band.male.toLocaleString()}
                        </span>
                        <div className="flex justify-end">
                            <div
                                className="h-3 rounded-l bg-sky-500/80"
                                style={{ width: `${malePct}%`, minWidth: band.male > 0 ? "2px" : 0 }}
                                title={`Male: ${band.male.toLocaleString()}`}
                            />
                        </div>
                        <span className="shrink-0 text-center text-muted">{band.age}</span>
                        <div className="flex justify-start">
                            <div
                                className="h-3 rounded-r bg-rose-500/80"
                                style={{ width: `${femalePct}%`, minWidth: band.female > 0 ? "2px" : 0 }}
                                title={`Female: ${band.female.toLocaleString()}`}
                            />
                        </div>
                        <span className="text-left tabular-nums text-rose-700">
                            {band.female.toLocaleString()}
                        </span>
                    </div>
                );
            })}
        </div>
    );
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

    const growth2020to2024 = compoundAnnualGrowthRate(
        displayPlace.pop_2020,
        displayPlace.pop_2024,
        2020,
        2024,
    );
    const annualChange = formatAnnualizedChange(growth2020to2024);

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
            population_2010: displayPlace!.pop_2010,
            pop_male_2020: displayPlace!.pop_male_2020,
            pop_female_2020: displayPlace!.pop_female_2020,
            age_sex_2020: displayPlace!.age_sex_2020,
            area_km2: displayPlace!.area_km2,
            density_2024_per_km2: displayPlace!.density_2024,
            pct_change_2020_2024: displayPlace!.pct_change_2020_2024,
            assets_2024: displayPlace!.assets_2024,
            source:
                "Population from the Philippine Statistics Authority (PSA) PSGC and 2010/2015/2020/2024 census tables; 2020 household age/sex from PSA 2020 CPH; area and derived metrics (density, % change) computed by Mapa from PSA boundaries. Total assets from COA CY2024 Annual Financial Report (Local Government), Part III Financial Profile.",
            source_url: PSA_PSGC_URL,
            age_sex_source: "PSA 2020 Census of Population and Housing — Age and Sex Distribution",
            age_sex_source_url: PSA_AGESEX_URL,
            age_sex_file_url: PSA_AGESEX_FILE_URL,
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
            ["population_2015", String(displayPlace!.pop_2015 ?? "")],
            ["population_2010", String(displayPlace!.pop_2010 ?? "")],
            ["pop_male_2020", String(displayPlace!.pop_male_2020 ?? "")],
            ["pop_female_2020", String(displayPlace!.pop_female_2020 ?? "")],
            ["area_km2", String(displayPlace!.area_km2 ?? "")],
            ["density_2024", String(displayPlace!.density_2024 ?? "")],
            ["pct_change_2020_2024", String(displayPlace!.pct_change_2020_2024 ?? "")],
            ["assets_2024", String(displayPlace!.assets_2024 ?? "")],
            ["source", "Philippine Statistics Authority (PSA) PSGC and 2010–2024 censuses; 2020 CPH age/sex; area/density/change derived by Mapa; assets from COA CY2024 AFR"],
            ["source_url", PSA_PSGC_URL],
            ["age_sex_source", "PSA 2020 Census of Population and Housing — Age and Sex Distribution"],
            ["age_sex_source_url", PSA_AGESEX_URL],
            ["age_sex_file_url", PSA_AGESEX_FILE_URL],
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

            {(displayPlace.pop_2010 != null ||
                displayPlace.pop_2015 != null ||
                displayPlace.pop_2020 != null ||
                displayPlace.pop_2024 != null) && (
                <section>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                        Population history (census)
                    </p>
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="text-xs text-muted">
                                <th className="py-1 pr-2 text-left font-medium"></th>
                                {POP_HISTORY.map((row) => (
                                    <th key={row.year} className="py-1 px-2 text-right font-medium">
                                        {row.year}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-t border-border-light">
                                <td className="py-1.5 pr-2 text-left text-muted">Population</td>
                                {POP_HISTORY.map((row) => (
                                    <td
                                        key={row.year}
                                        className="py-1.5 px-2 text-right font-medium text-primary"
                                    >
                                        {formatPopulation(displayPlace[row.key])}
                                    </td>
                                ))}
                            </tr>
                            <tr className="border-t border-border-light">
                                <td className="py-1.5 pr-2 text-left text-muted">Change</td>
                                {POP_HISTORY.map((row, i) => {
                                    const prev = i > 0 ? POP_HISTORY[i - 1] : null;
                                    const change = prev
                                        ? totalPctChange(displayPlace[prev.key], displayPlace[row.key])
                                        : null;
                                    return (
                                        <td key={row.year} className="py-1.5 px-2 text-right text-muted">
                                            {i === 0 ? "—" : formatPctChange(change)}
                                        </td>
                                    );
                                })}
                            </tr>
                            <tr className="border-t border-border-light">
                                <td className="py-1.5 pr-2 text-left text-muted">Growth/yr</td>
                                {POP_HISTORY.map((row, i) => {
                                    const prev = i > 0 ? POP_HISTORY[i - 1] : null;
                                    const pgr = prev
                                        ? compoundAnnualGrowthRate(
                                              displayPlace[prev.key],
                                              displayPlace[row.key],
                                              prev.year,
                                              row.year,
                                          )
                                        : null;
                                    return (
                                        <td key={row.year} className="py-1.5 px-2 text-right text-muted">
                                            {i === 0 ? "—" : formatGrowthRate(pgr)}
                                        </td>
                                    );
                                })}
                            </tr>
                        </tbody>
                    </table>
                    <p className="mt-1.5 text-xs text-muted">
                        Change is the total percent change since the previous census; Growth/yr is the
                        average annual growth rate (compound) over the exact period between census
                        reference dates, matching PSA’s published rate. Source:{" "}
                        <a
                            href={PSA_PSGC_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            PSA — 2010, 2015, 2020 &amp; 2024 censuses
                        </a>
                        .
                    </p>
                    <div className="mt-3">
                        <PopulationTrendChart
                            points={POP_HISTORY.map((row) => ({ year: row.year, value: displayPlace[row.key] }))
                                .filter((p): p is { year: number; value: number } => p.value != null)}
                        />
                    </div>
                </section>
            )}

            {displayPlace.age_sex_2020 != null && displayPlace.age_sex_2020.length > 0 && (
                <section>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                        Household age &amp; sex [2020]
                    </p>
                    <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <StatCard
                            label="Male"
                            value={formatPopulation(displayPlace.pop_male_2020)}
                            sub="2020 CPH household population"
                        />
                        <StatCard
                            label="Female"
                            value={formatPopulation(displayPlace.pop_female_2020)}
                            sub="2020 CPH household population"
                        />
                    </div>

                    {displayPlace.pop_male_2020 != null && displayPlace.pop_female_2020 != null && (
                        <div className="mb-4">
                            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">Sex</p>
                            <SexSplit male={displayPlace.pop_male_2020} female={displayPlace.pop_female_2020} />
                        </div>
                    )}

                    <div className="mb-4">
                        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">Age groups</p>
                        <AgeGroupBreakdown groups={broadAgeGroups(displayPlace.age_sex_2020)} />
                    </div>

                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                        Age distribution
                    </p>
                    <AgeSexPyramid bands={displayPlace.age_sex_2020} />
                    <p className="mt-2 text-xs text-muted">
                        Source:{" "}
                        <a
                            href={PSA_AGESEX_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            PSA — Age and Sex Distribution, 2020 Census of Population and Housing
                        </a>{" "}
                        (
                        <a
                            href={PSA_AGESEX_FILE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline"
                        >
                            household population by age group and sex, .xlsx
                        </a>
                        ).
                    </p>
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
