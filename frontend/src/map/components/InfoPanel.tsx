// Place detail panel: population, area, density, and downloadable stats (no geometry).

import { useMemo } from "react";
import { cn } from "../../lib/cn";
import { downloadJsonFile, downloadTextFile, slugifyFilename } from "../../lib/downloadFile";
import { useDivisionStats } from "../hooks/useDivisionStats";
import {
    changeToneClass,
    compoundAnnualGrowthRate,
    formatAnnualizedChange,
    formatAreaKm2,
    formatAssets,
    formatDensity,
    formatGdp,
    formatGrowthRate,
    formatPctChange,
    formatPesoPerCapita,
    formatPopulation,
} from "../utils/formatStats";
import { broadAgeGroups } from "../utils/ageSex";
import { mergePlaceStats } from "../utils/mergePlaceStats";
import type { AgeSexBand } from "../types";
import type { ResolvedPlace } from "../utils/resolvePlace";
import type { Region, ProvinceGeoJSON, MunicityMeta, BarangayGeoJSON } from "../types";
import type { MapLevel } from "../constants";
import { SubLevelDataTable } from "./SubLevelDataTable";
import { TopDistributionBar } from "./TopDistributionBar";

interface InfoPanelProps {
    place: ResolvedPlace | null;
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municityMeta: MunicityMeta[];
    barangays: BarangayGeoJSON[];
    onRegionChange: (psgc: string | null) => void;
    onProvinceChange: (psgc: string | null) => void;
    onMunicityChange: (psgc: string | null) => void;
    onBarangayChange?: (psgc: string | null) => void;
    onLevelChange?: (level: MapLevel) => void;
}

const PSA_PSGC_URL = "https://psa.gov.ph/classification/psgc/";
const PSA_AGESEX_URL =
    "https://psa.gov.ph/content/age-and-sex-distribution-philippine-population-2020-census-population-and-housing";
const PSA_AGESEX_FILE_URL =
    "https://psa.gov.ph/system/files/phcd/2022-12/4_Household%2520Population%2520by%2520Age%2520Group%2520and%2520Sex_Philippines_2020%2520CPH_rev.xlsx";
const PSA_GDP_URL = "https://openstat.psa.gov.ph/Database/Gross-Regional-Domestic-Product";

const POP_HISTORY: { year: number; key: "pop_2010" | "pop_2015" | "pop_2020" | "pop_2024" }[] = [
    { year: 2010, key: "pop_2010" },
    { year: 2015, key: "pop_2015" },
    { year: 2020, key: "pop_2020" },
    { year: 2024, key: "pop_2024" },
];

const GDP_HISTORY: { year: number; key: "gdp_2022" | "gdp_2023" | "gdp_2024" }[] = [
    { year: 2022, key: "gdp_2022" },
    { year: 2023, key: "gdp_2023" },
    { year: 2024, key: "gdp_2024" },
];

function totalPctChange(from: number | null, to: number | null): number | null {
    if (from == null || to == null || from === 0) return null;
    return ((to - from) / from) * 100;
}

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

function formatAgeBand(age: string): string {
    const m = age.match(/(\d+)\s*(?:years\s*and\s*over|and\s*over|\+)/i);
    return m ? `${m[1]}+` : age;
}

function niceAxisStep(maxValue: number, tickCount: number): number {
    if (maxValue <= 0) return 1;
    const rough = maxValue / tickCount;
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / pow;
    const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return niceNorm * pow;
}

function PopulationTrendChart({
    points,
    formatValue = formatCompactNumber,
    ariaLabel = "Population over time",
}: {
    points: { year: number; value: number }[];
    formatValue?: (n: number) => string;
    ariaLabel?: string;
}) {
    if (points.length < 2) return null;
    const W = 380;
    const H = 140;
    const padLeft = 38;
    const padRight = 12;
    const padTop = 16;
    const padBottom = 26;
    const plotW = W - padLeft - padRight;
    const plotH = H - padTop - padBottom;

    const minYear = points[0].year;
    const maxYear = points[points.length - 1].year;
    const maxValue = Math.max(...points.map((p) => p.value));
    const tickCount = 4;
    const step = niceAxisStep(maxValue, tickCount);
    const yMax = step * tickCount;
    const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => step * i);

    const x = (year: number) =>
        maxYear === minYear ? padLeft + plotW / 2 : padLeft + ((year - minYear) / (maxYear - minYear)) * plotW;
    const y = (value: number) => padTop + (1 - value / yMax) * plotH;
    const baseline = padTop + plotH;

    const line = points.map((p) => `${x(p.year).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");

    return (
        <div className="text-accent border border-border p-2 bg-slate-50/20">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel}>
                {yTicks.map((t) => (
                    <g key={t}>
                        <line
                            x1={padLeft}
                            y1={y(t)}
                            x2={W - padRight}
                            y2={y(t)}
                            stroke="#cbd5e1"
                            strokeWidth={0.5}
                            strokeDasharray="2 2"
                        />
                        <text x={padLeft - 5} y={y(t) + 3} textAnchor="end" className="fill-muted text-[8px] font-mono">
                            {formatValue(t)}
                        </text>
                    </g>
                ))}

                <polyline points={line} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />

                {points.map((p) => (
                    <g key={p.year}>
                        <line
                            x1={x(p.year)}
                            y1={baseline}
                            x2={x(p.year)}
                            y2={baseline + 3}
                            stroke="#cbd5e1"
                            strokeWidth={0.5}
                        />
                        <circle cx={x(p.year)} cy={y(p.value)} r={3} fill="currentColor" />
                        <text x={x(p.year)} y={H - 8} textAnchor="middle" className="fill-muted text-[9px] font-medium font-sans">
                            {p.year}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}

function SexDonutChart({ male, female }: { male: number; female: number }) {
    const total = male + female;
    if (total === 0) return null;
    const malePct = (male / total) * 100;
    const femalePct = 100 - malePct;
    
    const size = 68;
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const maleOffset = circumference - (malePct / 100) * circumference;
    
    return (
        <div className="flex items-center justify-center gap-3 border border-border p-2 bg-slate-50/20">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
                {/* Background circle / Female segment */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth={strokeWidth}
                />
                {/* Male segment overlay */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={maleOffset}
                />
            </svg>
            <div className="text-[9px] space-y-0.5 font-sans text-left">
                <div className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-[#0284c7]" />
                    <span className="font-semibold text-primary">M: {malePct.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-[#f43f5e]" />
                    <span className="font-semibold text-primary">F: {femalePct.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    );
}

function AgeBarChart({ young, working, senior }: { young: number; working: number; senior: number }) {
    const total = young + working + senior;
    if (total === 0) return null;
    const yPct = (young / total) * 100;
    const wPct = (working / total) * 100;
    const sPct = (senior / total) * 100;
    
    const maxPct = Math.max(yPct, wPct, sPct, 1);
    const W = 110;
    const H = 72;
    const padBottom = 14;
    const plotH = H - padBottom;
    
    const barW = 18;
    const gap = 10;
    const startX = (W - (barW * 3 + gap * 2)) / 2;
    
    return (
        <div className="border border-border p-2 bg-slate-50/20 flex items-center justify-center">
            <svg width={W} height={H} className="font-sans text-[8px]">
                {[0.25, 0.5, 0.75, 1.0].map((tick, i) => {
                    const val = maxPct * tick;
                    const y = plotH - (val / maxPct) * (plotH - 8);
                    return (
                         <line key={i} x1={0} y1={y} x2={W} y2={y} stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="2 2" />
                    );
                })}
                {/* 0-14 bar */}
                <rect x={startX} y={plotH - (yPct / maxPct) * (plotH - 8)} width={barW} height={(yPct / maxPct) * (plotH - 8)} fill="#0284c7" />
                <text x={startX + barW / 2} y={plotH - (yPct / maxPct) * (plotH - 8) - 2} textAnchor="middle" className="fill-primary font-bold">{yPct.toFixed(0)}%</text>
                <text x={startX + barW / 2} y={H - 3} textAnchor="middle" className="fill-muted font-medium">0-14</text>

                {/* 15-64 bar */}
                <rect x={startX + barW + gap} y={plotH - (wPct / maxPct) * (plotH - 8)} width={barW} height={(wPct / maxPct) * (plotH - 8)} fill="#10b981" />
                <text x={startX + barW + gap + barW / 2} y={plotH - (wPct / maxPct) * (plotH - 8) - 2} textAnchor="middle" className="fill-primary font-bold">{wPct.toFixed(0)}%</text>
                <text x={startX + barW + gap + barW / 2} y={H - 3} textAnchor="middle" className="fill-muted font-medium">15-64</text>

                {/* 65+ bar */}
                <rect x={startX + (barW + gap) * 2} y={plotH - (sPct / maxPct) * (plotH - 8)} width={barW} height={(sPct / maxPct) * (plotH - 8)} fill="#f59e0b" />
                <text x={startX + (barW + gap) * 2 + barW / 2} y={plotH - (sPct / maxPct) * (plotH - 8) - 2} textAnchor="middle" className="fill-primary font-bold">{sPct.toFixed(0)}%</text>
                <text x={startX + (barW + gap) * 2 + barW / 2} y={H - 3} textAnchor="middle" className="fill-muted font-medium">65+</text>
            </svg>
        </div>
    );
}

function AgeSexPyramid({ bands }: { bands: AgeSexBand[] }) {
    const maxCount = Math.max(...bands.map((b) => Math.max(b.male, b.female)), 1);
    return (
        <div className="space-y-0.5 border border-border p-2 bg-slate-50/10">
            <div className="grid grid-cols-[3rem_1fr_4.5rem_1fr_3rem] items-center gap-1 text-[9px] uppercase tracking-wide text-muted font-semibold">
                <span className="text-right">Male</span>
                <span />
                <span className="text-center">Age Group</span>
                <span />
                <span className="text-left">Female</span>
            </div>
            {bands.map((band) => {
                const malePct = (band.male / maxCount) * 100;
                const femalePct = (band.female / maxCount) * 100;
                return (
                    <div
                        key={band.age}
                        className="grid grid-cols-[3rem_1fr_4.5rem_1fr_3rem] items-center gap-1 text-[10px]"
                    >
                        <span className="text-right tabular-nums font-mono text-sky-700">
                            {band.male.toLocaleString()}
                        </span>
                        <div className="flex justify-end">
                            <div
                                className="h-3 bg-sky-500/80 rounded-none border border-sky-600/20"
                                style={{ width: `${malePct}%`, minWidth: band.male > 0 ? "1px" : 0 }}
                                title={`Male: ${band.male.toLocaleString()}`}
                            />
                        </div>
                        <span className="shrink-0 text-center text-muted font-mono text-[9px]">{formatAgeBand(band.age)}</span>
                        <div className="flex justify-start">
                            <div
                                className="h-3 bg-rose-500/80 rounded-none border border-rose-600/20"
                                style={{ width: `${femalePct}%`, minWidth: band.female > 0 ? "1px" : 0 }}
                                title={`Female: ${band.female.toLocaleString()}`}
                            />
                        </div>
                        <span className="text-left tabular-nums font-mono text-rose-700">
                            {band.female.toLocaleString()}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export function InfoPanel({
    place,
    regions,
    provinces,
    municityMeta,
    barangays,
    onRegionChange,
    onProvinceChange,
    onMunicityChange,
    onBarangayChange,
    onLevelChange,
}: InfoPanelProps) {

    const handleSelectEntity = (psgc: string, subLevel: MapLevel) => {
        if (subLevel === "region") {
            onRegionChange(psgc);
            onProvinceChange(null);
            onMunicityChange(null);
            onBarangayChange?.(null);
            onLevelChange?.("region");
        } else if (subLevel === "province") {
            const province = provinces.find((p) => p.psgc === psgc);
            if (province) {
                onRegionChange(province.region_psgc);
                onProvinceChange(psgc);
                onMunicityChange(null);
                onBarangayChange?.(null);
                onLevelChange?.("province");
            }
        } else if (subLevel === "municipality") {
            const muni = municityMeta.find((m) => m.psgc === psgc);
            if (muni) {
                onRegionChange(muni.region_psgc);
                onProvinceChange(muni.province_psgc);
                onMunicityChange(psgc);
                onBarangayChange?.(null);
                onLevelChange?.("municipality");
            }
        } else if (subLevel === "barangay") {
            const bgy = barangays.find((b) => b.psgc === psgc);
            if (bgy) {
                onRegionChange(bgy.region_psgc);
                onProvinceChange(bgy.province_psgc);
                onMunicityChange(bgy.municity_psgc);
                onBarangayChange?.(psgc);
                onLevelChange?.("barangay");
            }
        }
    };
    const statsQuery = useDivisionStats(place?.psgc ?? null);
    const displayPlace = useMemo(
        () => (place ? mergePlaceStats(place, statsQuery.data) : null),
        [place, statsQuery.data],
    );

    if (!place) {
        return (
            <p className="text-xs text-muted font-medium italic">
                Select a place at the current view level to see population, area, and density details.
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
    const gdpPerCapita =
        displayPlace.gdp_2024 != null && displayPlace.pop_2024 != null && displayPlace.pop_2024 > 0
            ? displayPlace.gdp_2024 / displayPlace.pop_2024
            : null;

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
            gdp_2022: displayPlace!.gdp_2022,
            gdp_2023: displayPlace!.gdp_2023,
            gdp_2024: displayPlace!.gdp_2024,
            gdp_per_capita_2024: gdpPerCapita,
            source:
                "Population from the Philippine Statistics Authority (PSA) PSGC and 2010/2015/2020/2024 census tables; 2020 household age/sex and GDP (constant 2018 prices) from PSA; area and derived metrics (density, % change) computed by Mapa from PSA boundaries. Total assets from COA CY2024 Annual Financial Report (Local Government), Part III Financial Profile.",
            source_url: PSA_PSGC_URL,
            age_sex_source: "PSA 2020 Census of Population and Housing — Age and Sex Distribution",
            age_sex_source_url: PSA_AGESEX_URL,
            age_sex_file_url: PSA_AGESEX_FILE_URL,
            gdp_source: "PSA Gross Domestic Product by Province and HUCs (constant 2018 prices)",
            gdp_source_url: PSA_GDP_URL,
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
            ["gdp_2022", String(displayPlace!.gdp_2022 ?? "")],
            ["gdp_2023", String(displayPlace!.gdp_2023 ?? "")],
            ["gdp_2024", String(displayPlace!.gdp_2024 ?? "")],
            ["gdp_per_capita_2024", String(gdpPerCapita ?? "")],
            ["source", "Philippine Statistics Authority (PSA) PSGC and 2010–2024 censuses; 2020 CPH age/sex; GDP constant 2018 prices; area/density/change derived by Mapa; assets from COA CY2024 AFR"],
            ["source_url", PSA_PSGC_URL],
            ["age_sex_source", "PSA 2020 Census of Population and Housing — Age and Sex Distribution"],
            ["age_sex_source_url", PSA_AGESEX_URL],
            ["age_sex_file_url", PSA_AGESEX_FILE_URL],
            ["gdp_source", "PSA Gross Domestic Product by Province and HUCs (constant 2018 prices)"],
            ["gdp_source_url", PSA_GDP_URL],
        ];
        const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
        downloadTextFile(csv, `mapa-info-${slugifyFilename(displayPlace!.name)}-${date}.csv`, "text/csv");
    }

    const renderInteractiveBreadcrumbs = () => {
        const breadcrumbs: { label: string; action: () => void }[] = [];
        
        breadcrumbs.push({
            label: "Philippines",
            action: () => {
                onRegionChange(null);
                onProvinceChange(null);
                onMunicityChange(null);
                onBarangayChange?.(null);
                onLevelChange?.("country");
            }
        });

        const regPsgc = displayPlace.region_psgc || (displayPlace.level === "region" ? displayPlace.psgc : null);
        if (regPsgc) {
            const regionObj = regions.find((r) => r.psgc === regPsgc);
            if (regionObj) {
                breadcrumbs.push({
                    label: regionObj.name.trim(),
                    action: () => {
                        onRegionChange(regPsgc);
                        onProvinceChange(null);
                        onMunicityChange(null);
                        onBarangayChange?.(null);
                        onLevelChange?.("region");
                    }
                });
            }
        }

        const provPsgc = displayPlace.province_psgc || (displayPlace.level === "province" ? displayPlace.psgc : null);
        if (provPsgc && displayPlace.level !== "region") {
            const provinceObj = provinces.find((p) => p.psgc === provPsgc);
            if (provinceObj) {
                breadcrumbs.push({
                    label: provinceObj.name.trim(),
                    action: () => {
                        onRegionChange(provinceObj.region_psgc);
                        onProvinceChange(provPsgc);
                        onMunicityChange(null);
                        onBarangayChange?.(null);
                        onLevelChange?.("province");
                    }
                });
            }
        }

        const muniPsgc = displayPlace.level === "barangay" ? displayPlace.municity_psgc : (displayPlace.level === "municipality" ? displayPlace.psgc : null);
        if (muniPsgc && (displayPlace.level === "municipality" || displayPlace.level === "barangay")) {
            const muniObj = municityMeta.find((m) => m.psgc === muniPsgc);
            if (muniObj) {
                breadcrumbs.push({
                    label: muniObj.name.trim(),
                    action: () => {
                        onRegionChange(muniObj.region_psgc);
                        onProvinceChange(muniObj.province_psgc);
                        onMunicityChange(muniPsgc);
                        onBarangayChange?.(null);
                        onLevelChange?.("municipality");
                    }
                });
            }
        }

        if (displayPlace.level === "barangay") {
            breadcrumbs.push({
                label: displayPlace.name.trim(),
                action: () => {}
            });
        }

        return (
            <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] font-sans font-bold text-muted uppercase tracking-wider mb-2 border border-border p-2 bg-slate-50/50">
                {breadcrumbs.map((b, i) => {
                    const isLast = i === breadcrumbs.length - 1;
                    return (
                        <span key={i} className="flex items-center gap-x-1.5">
                            {i > 0 && <span className="text-slate-300 font-bold font-mono">›</span>}
                            {isLast ? (
                                <span className="text-primary font-bold">{b.label}</span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={b.action}
                                    className="text-accent hover:underline hover:text-accent-dark transition-colors cursor-pointer"
                                >
                                    {b.label}
                                </button>
                            )}
                        </span>
                    );
                })}
            </nav>
        );
    };

    return (
        <div className="space-y-4">
            <div>
                {renderInteractiveBreadcrumbs()}
                <div className="flex items-baseline justify-between gap-2 mt-2">
                    <h2 className="text-lg font-bold text-primary tracking-tight">{displayPlace.name}</h2>
                    <span className="font-mono text-[10px] text-muted font-medium bg-slate-100 border border-border px-1.5 py-0.5">PSGC {displayPlace.psgc}</span>
                </div>
                {displayPlace.geo_lvl === "Special" && (
                    <div className="mt-2 border border-amber-300 bg-amber-50/50 px-3 py-2 text-xs text-amber-900 rounded-none">
                        Non-residential parcel — not a PSGC census unit; no official population.
                        {displayPlace.note ? ` ${displayPlace.note}` : ""}
                    </div>
                )}
            </div>

            {/* Key Statistics Grid Table */}
            <div>
                <table className="w-full table-fixed border-collapse border border-border text-xs tabular-nums text-primary bg-white">
                    <colgroup>
                        <col className="w-1/3" />
                        <col className="w-2/3" />
                    </colgroup>
                    <tbody>
                        <tr className="border-b border-border bg-slate-50/30">
                            <td className="py-2 px-3 font-semibold text-muted text-left">POPULATION (2024)</td>
                            <td className="py-2 px-3 text-right font-medium text-primary">{formatPopulation(displayPlace.pop_2024)}</td>
                        </tr>
                        <tr className="border-b border-border">
                            <td className="py-2 px-3 font-semibold text-muted text-left">CHANGE (2020 → 2024)</td>
                            <td className={cn("py-2 px-3 text-right font-bold", changeToneClass(displayPlace.pct_change_2020_2024))}>
                                {formatPctChange(displayPlace.pct_change_2020_2024)}
                                {displayPlace.pop_2020 != null && annualChange && (
                                    <span className="text-[10px] font-normal text-muted ml-1">({annualChange})</span>
                                )}
                            </td>
                        </tr>
                        <tr className="border-b border-border bg-slate-50/30">
                            <td className="py-2 px-3 font-semibold text-muted text-left">POPULATION DENSITY</td>
                            <td className="py-2 px-3 text-right font-medium text-primary">
                                {displayPlace.density_2024 != null ? `${formatDensity(displayPlace.density_2024)}/km²` : "—"}
                            </td>
                        </tr>
                        <tr className="border-b border-border">
                            <td className="py-2 px-3 font-semibold text-muted text-left">OFFICIAL LAND AREA</td>
                            <td className="py-2 px-3 text-right font-medium text-primary">
                                {formatAreaKm2(displayPlace.area_km2)}
                                {displayPlace.area_km2 != null && (
                                    <span className="block text-[9px] text-muted font-normal mt-0.5 leading-none text-left">
                                        {displayPlace.level === "barangay"
                                            ? "Estimated from boundary polygon"
                                            : "Official area from PSA Table A"}
                                    </span>
                                )}
                            </td>
                        </tr>
                        <tr className="border-b border-border bg-slate-50/30">
                            <td className="py-2 px-3 font-semibold text-muted text-left">TOTAL ASSETS (2024)</td>
                            <td className="py-2 px-3 text-right font-medium text-primary">{formatAssets(displayPlace.assets_2024)}</td>
                        </tr>
                        <tr>
                            <td className="py-2 px-3 font-semibold text-muted text-left">GROSS REGIONAL GDP (2024)</td>
                            <td className="py-2 px-3 text-right font-medium text-primary">
                                {displayPlace.gdp_2024 != null ? formatGdp(displayPlace.gdp_2024) : "—"}
                                {displayPlace.gdp_2024 == null && (
                                    <span className="block text-[9px] text-muted font-normal mt-0.5 leading-none text-left">Not published at this level</span>
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {displayPlace.level === "barangay" && (
                <div className="text-[10px] text-amber-800 bg-amber-50/50 border border-amber-300 px-3 py-2 leading-normal">
                    <strong>Note:</strong> Barangay land area and population density metrics are computationally derived geographic approximations by Mapa. Official PSA Table A breakdowns are unavailable at this resolution.
                </div>
            )}

            {(displayPlace.pop_2010 != null ||
                displayPlace.pop_2015 != null ||
                displayPlace.pop_2020 != null ||
                displayPlace.pop_2024 != null) && (
                    <section className="space-y-2 border-t border-border pt-3.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-light pb-1">
                            Population Census History
                        </p>
                        <table className="w-full table-fixed border-collapse border border-border text-xs tabular-nums bg-white">
                            <colgroup>
                                <col className="w-1/3" />
                                <col className="w-[16.6%]" />
                                <col className="w-[16.6%]" />
                                <col className="w-[16.6%]" />
                                <col className="w-[16.6%]" />
                            </colgroup>
                            <thead>
                                <tr className="text-[10px] text-muted bg-slate-50/50 border-b border-border">
                                    <th className="py-1.5 px-2 text-left font-semibold">CENSUS</th>
                                    {POP_HISTORY.map((row) => (
                                        <th key={row.year} className="py-1.5 px-2 text-right font-semibold">
                                            {row.year}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-border">
                                    <td className="py-1.5 px-2 text-left text-muted font-medium">Population</td>
                                    {POP_HISTORY.map((row) => (
                                        <td
                                            key={row.year}
                                            className="py-1.5 px-2 text-right font-medium text-primary"
                                        >
                                            {formatPopulation(displayPlace[row.key])}
                                        </td>
                                    ))}
                                </tr>
                                <tr className="border-b border-border">
                                    <td className="py-1.5 px-2 text-left text-muted font-medium">Total Change</td>
                                    {POP_HISTORY.map((row, i) => {
                                        const prev = i > 0 ? POP_HISTORY[i - 1] : null;
                                        const change = prev
                                            ? totalPctChange(displayPlace[prev.key], displayPlace[row.key])
                                            : null;
                                        return (
                                            <td
                                                key={row.year}
                                                className={cn(
                                                    "py-1.5 px-2 text-right italic font-medium",
                                                    i === 0 ? "text-muted font-normal" : changeToneClass(change),
                                                )}
                                            >
                                                {i === 0 ? "—" : formatPctChange(change)}
                                            </td>
                                        );
                                    })}
                                </tr>
                                <tr>
                                    <td className="py-1.5 px-2 text-left text-muted font-medium">Growth/yr (CAGR)</td>
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
                                            <td
                                                key={row.year}
                                                className={cn(
                                                    "py-1.5 px-2 text-right font-semibold",
                                                    i === 0 ? "text-muted font-normal" : changeToneClass(pgr),
                                                )}
                                            >
                                                {i === 0 ? "—" : formatGrowthRate(pgr)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                        
                        <PopulationTrendChart
                            points={POP_HISTORY.map((row) => ({ year: row.year, value: displayPlace[row.key] }))
                                .filter((p): p is { year: number; value: number } => p.value != null)}
                        />
                        <p className="text-[10px] leading-normal text-muted bg-slate-50 p-2 border border-border">
                            Change is the total percent change since the previous census. Growth/yr is the compound annual growth rate over the exact period, matching PSA’s published methodology.
                        </p>
                    </section>
                )}

            {displayPlace.gdp_2024 != null && (
                <section className="space-y-2 border-t border-border pt-3.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-light pb-1">
                        Gross domestic product (gdp)
                    </p>
                    <table className="w-full table-fixed border-collapse border border-border text-xs tabular-nums bg-white mb-2">
                        <colgroup>
                            <col className="w-1/3" />
                            <col className="w-2/3" />
                        </colgroup>
                        <tbody>
                            <tr className="border-b border-border bg-slate-50/50">
                                <td className="py-1.5 px-2 text-left text-muted font-medium">GDP PER CAPITA (2024)</td>
                                <td className="py-1.5 px-2 text-right font-semibold text-primary">{formatPesoPerCapita(gdpPerCapita)}</td>
                            </tr>
                        </tbody>
                    </table>
                    <table className="w-full table-fixed border-collapse border border-border text-xs tabular-nums bg-white">
                        <colgroup>
                            <col className="w-1/3" />
                            <col className="w-[22.2%]" />
                            <col className="w-[22.2%]" />
                            <col className="w-[22.2%]" />
                        </colgroup>
                        <thead>
                            <tr className="text-[10px] text-muted bg-slate-50/50 border-b border-border">
                                <th className="py-1.5 px-2 text-left font-semibold">GDP METRIC</th>
                                {GDP_HISTORY.map((row) => (
                                    <th key={row.year} className="py-1.5 px-2 text-right font-semibold">
                                        {row.year}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-border">
                                <td className="py-1.5 px-2 text-left text-muted font-medium">GDP (Constant 2018 Prices)</td>
                                {GDP_HISTORY.map((row) => (
                                    <td
                                        key={row.year}
                                        className="py-1.5 px-2 text-right font-medium text-primary"
                                    >
                                        {formatGdp(displayPlace[row.key])}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className="py-1.5 px-2 text-left text-muted font-medium">Real GDP Growth</td>
                                {GDP_HISTORY.map((row, i) => {
                                    const prev = i > 0 ? GDP_HISTORY[i - 1] : null;
                                    const change = prev
                                        ? totalPctChange(displayPlace[prev.key], displayPlace[row.key])
                                        : null;
                                    return (
                                        <td
                                            key={row.year}
                                            className={cn(
                                                "py-1.5 px-2 text-right font-semibold",
                                                i === 0 ? "text-muted font-normal" : changeToneClass(change),
                                            )}
                                        >
                                            {i === 0 ? "—" : formatPctChange(change)}
                                        </td>
                                    );
                                })}
                            </tr>
                        </tbody>
                    </table>
                    <PopulationTrendChart
                        points={GDP_HISTORY.map((row) => ({ year: row.year, value: displayPlace[row.key] }))
                            .filter((p): p is { year: number; value: number } => p.value != null)}
                        formatValue={formatGdp}
                        ariaLabel="GDP over time"
                    />
                </section>
            )}

            {displayPlace.age_sex_2020 != null && displayPlace.age_sex_2020.length > 0 && (
                <section className="space-y-4 border-t border-border pt-3.5">
                    {/* Sex distribution with donut chart */}
                    {displayPlace.pop_male_2020 != null && displayPlace.pop_female_2020 != null && (
                        <div className="space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-light pb-1">
                                Sex Distribution (2020 CPH)
                            </p>
                            <div className="grid grid-cols-2 gap-3 items-center">
                                <table className="w-full table-fixed border-collapse border border-border text-xs tabular-nums bg-white">
                                    <colgroup>
                                        <col className="w-1/2" />
                                        <col className="w-1/2" />
                                    </colgroup>
                                    <tbody>
                                        <tr className="border-b border-border bg-slate-50/30">
                                            <td className="py-2 px-2.5 font-semibold text-muted text-left">MALE</td>
                                            <td className="py-2 px-2.5 text-right font-bold text-sky-600">
                                                {formatPopulation(displayPlace.pop_male_2020)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-2.5 font-semibold text-muted text-left">FEMALE</td>
                                            <td className="py-2 px-2.5 text-right font-bold text-rose-600">
                                                {formatPopulation(displayPlace.pop_female_2020)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <SexDonutChart male={displayPlace.pop_male_2020} female={displayPlace.pop_female_2020} />
                            </div>
                        </div>
                    )}

                    {/* Broad Age groups with vertical bar chart */}
                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-light pb-1">
                            Age Structure (2020 CPH)
                        </p>
                        <div className="grid grid-cols-[1.2fr_1fr] gap-3 items-center">
                            <table className="w-full table-fixed border-collapse border border-border text-xs tabular-nums bg-white">
                                 <colgroup>
                                     <col className="w-1/3" />
                                     <col className="w-1/3" />
                                     <col className="w-1/3" />
                                 </colgroup>
                                 <thead>
                                     <tr className="text-[10px] text-muted bg-slate-50/50 border-b border-border">
                                         <th className="py-1 px-1.5 text-left font-semibold">AGE GROUP</th>
                                         <th className="py-1 px-1.5 text-right font-semibold">POP</th>
                                         <th className="py-1 px-1.5 text-right font-semibold">SHARE</th>
                                     </tr>
                                 </thead>
                                <tbody>
                                    {(() => {
                                        const groups = broadAgeGroups(displayPlace.age_sex_2020);
                                        const total = groups.total || 1;
                                        return (
                                            <>
                                                <tr className="border-b border-border">
                                                    <td className="py-1.5 px-1.5 font-medium text-primary">0–14 years</td>
                                                    <td className="py-1.5 px-1.5 text-right text-slate-700">{formatPopulation(groups.young)}</td>
                                                    <td className="py-1.5 px-1.5 text-right font-bold text-sky-600">{((groups.young / total) * 100).toFixed(1)}%</td>
                                                </tr>
                                                <tr className="border-b border-border">
                                                    <td className="py-1.5 px-1.5 font-medium text-primary">15–64 years</td>
                                                    <td className="py-1.5 px-1.5 text-right text-slate-700">{formatPopulation(groups.working)}</td>
                                                    <td className="py-1.5 px-1.5 text-right font-bold text-emerald-600">{((groups.working / total) * 100).toFixed(1)}%</td>
                                                </tr>
                                                <tr>
                                                    <td className="py-1.5 px-1.5 font-medium text-primary">65+ years</td>
                                                    <td className="py-1.5 px-1.5 text-right text-slate-700">{formatPopulation(groups.senior)}</td>
                                                    <td className="py-1.5 px-1.5 text-right font-bold text-amber-600">{((groups.senior / total) * 100).toFixed(1)}%</td>
                                                </tr>
                                            </>
                                        );
                                    })()}
                                </tbody>
                            </table>
                            {(() => {
                                const groups = broadAgeGroups(displayPlace.age_sex_2020);
                                return <AgeBarChart young={groups.young} working={groups.working} senior={groups.senior} />;
                            })()}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-light pb-1">
                            Age &amp; Sex Pyramid
                        </p>
                        <AgeSexPyramid bands={displayPlace.age_sex_2020} />
                    </div>
                </section>
            )}

            <TopDistributionBar
                level={displayPlace.level}
                regions={regions}
                provinces={provinces}
                municityMeta={municityMeta}
                barangays={barangays}
                selectedRegionPsgc={displayPlace.region_psgc || (displayPlace.level === "region" ? displayPlace.psgc : null)}
                selectedProvincePsgc={displayPlace.province_psgc || (displayPlace.level === "province" ? displayPlace.psgc : null)}
                parentName={displayPlace.name}
            />

            <SubLevelDataTable
                level={displayPlace.level}
                regions={regions}
                provinces={provinces}
                municityMeta={municityMeta}
                barangays={barangays}
                selectedRegionPsgc={displayPlace.region_psgc || (displayPlace.level === "region" ? displayPlace.psgc : null)}
                selectedProvincePsgc={displayPlace.province_psgc || (displayPlace.level === "province" ? displayPlace.psgc : null)}
                selectedMunicityPsgc={displayPlace.municity_psgc || (displayPlace.level === "municipality" ? displayPlace.psgc : null)}
                onSelectEntity={handleSelectEntity}
            />

            <div className="flex gap-2 border-t border-border pt-4">
                <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="flex-1 border border-border bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-slate-50 transition-colors cursor-pointer rounded-none"
                >
                    Download info (JSON)
                </button>
                <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="flex-1 border border-border bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-slate-50 transition-colors cursor-pointer rounded-none"
                >
                    Download info (CSV)
                </button>
            </div>
        </div>
    );
}
