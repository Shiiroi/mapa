// Renders top contributor horizontal distribution bar with hover tooltip.
import { useState, useMemo } from "react";
import type { MapLevel } from "../../../constants";
import type { Region, ProvinceGeoJSON, MunicityMeta, BarangayGeoJSON } from "../../../types";
import { formatPopulation, formatAreaKm2, formatDensity, formatGdp, formatAssets } from "../../../utils/formatStats";

interface TopDistributionBarProps {
    level: MapLevel;
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municityMeta: MunicityMeta[];
    barangays: BarangayGeoJSON[];
    selectedRegionPsgc: string | null;
    selectedProvincePsgc: string | null;
    parentName: string;
}

type MetricKey = "pop_2024" | "area_km2" | "density_2024" | "gdp_2024" | "assets_2024";

interface MetricOption {
    label: string;
    key: MetricKey;
    formatter: (n: number) => string;
}

const METRICS: readonly MetricOption[] = [
    { label: "Population (2024)", key: "pop_2024", formatter: formatPopulation },
    { label: "Land Area (km²)", key: "area_km2", formatter: formatAreaKm2 },
    { label: "Density (per km²)", key: "density_2024", formatter: (n) => `${formatDensity(n)}/km²` },
    { label: "Gross Regional GDP (2024)", key: "gdp_2024", formatter: formatGdp },
    { label: "Total Assets (2024)", key: "assets_2024", formatter: formatAssets },
] as const;

const PREFIX_MAP: Record<MetricKey, string> = {
    pop_2024: "Population",
    area_km2: "Land Area",
    density_2024: "Population Density",
    gdp_2024: "GDP",
    assets_2024: "Total Assets",
};

const BLUE_PALETTE = ["#1e3a8a", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#0284c7", "#0369a1", "#075985", "#0c4a6e"];

const OTHERS_COLOR = "#94a3b8";

interface TooltipData {
    name: string;
    value: string;
    pct: number;
    x: number;
    y: number;
}

export function TopDistributionBar({
    level,
    regions,
    provinces,
    municityMeta,
    barangays,
    selectedRegionPsgc,
    selectedProvincePsgc,
    parentName,
}: TopDistributionBarProps) {
    const [selectedKey, setSelectedKey] = useState<MetricKey>("pop_2024");
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);

    // 1. Resolve child sub-levels
    const { subLevels, title } = useMemo(() => {
        let subLevels: (Region | ProvinceGeoJSON | MunicityMeta | BarangayGeoJSON)[] = [];
        let title = "";

        if (level === "country") {
            subLevels = regions;
            title = "Regional Distribution";
        } else if (level === "region") {
            const isNcr = selectedRegionPsgc?.startsWith("13");
            if (isNcr) {
                subLevels = municityMeta.filter((m) => m.region_psgc === selectedRegionPsgc);
                title = "City & Municipal Distribution (NCR)";
            } else {
                subLevels = provinces.filter((p) => p.region_psgc === selectedRegionPsgc);
                title = "Provincial Distribution";
            }
        } else if (level === "province") {
            subLevels = municityMeta.filter((m) => m.province_psgc === selectedProvincePsgc);
            title = "City & Municipal Distribution";
        } else if (level === "municipality") {
            subLevels = barangays;
            title = "Barangay Distribution";
        }

        return { subLevels, title };
    }, [level, regions, provinces, municityMeta, barangays, selectedRegionPsgc, selectedProvincePsgc]);

    const activeMetric = useMemo(() => {
        return METRICS.find((m) => m.key === selectedKey) || METRICS[0];
    }, [selectedKey]);

    // 2. Prepare items for active metric
    const chartData = useMemo(() => {
        const validItems = subLevels
            .map((item) => ({
                name: item.name.trim(),
                value: (item as Record<string, unknown>)[activeMetric.key] as number | null,
            }))
            .filter((item): item is { name: string; value: number } => item.value != null && item.value > 0);

        if (validItems.length === 0) return null;

        // Sort descending
        validItems.sort((a, b) => b.value - a.value);

        const limit = level === "country" || level === "region" ? 10 : 5;
        const topSlice = validItems.slice(0, limit);
        const othersSlice = validItems.slice(limit);
        const othersSum = othersSlice.reduce((acc, item) => acc + item.value, 0);

        const totalSum = topSlice.reduce((acc, item) => acc + item.value, 0) + othersSum;

        const segments = topSlice.map((item, idx) => ({
            name: item.name,
            value: item.value,
            color: BLUE_PALETTE[idx % BLUE_PALETTE.length],
            pct: totalSum > 0 ? (item.value / totalSum) * 100 : 0,
        }));

        if (othersSlice.length > 0) {
            segments.push({
                name: `Others (${othersSlice.length} entities)`,
                value: othersSum,
                color: OTHERS_COLOR,
                pct: totalSum > 0 ? (othersSum / totalSum) * 100 : 0,
            });
        }

        return { segments, totalSum };
    }, [subLevels, activeMetric, level]);

    // Omit dropdown options dynamically if NO entities in sub-levels contain the metric
    const availableOptions = useMemo(() => {
        return METRICS.filter((opt) => subLevels.some((row) => (row as Record<string, unknown>)[opt.key] != null && (row as Record<string, unknown>)[opt.key] > 0));
    }, [subLevels]);

    if (level === "barangay" || subLevels.length === 0) {
        return null;
    }

    const showTooltip = (name: string, value: number, pct: number, clientX: number, clientY: number) => {
        const formattedValue = `${PREFIX_MAP[activeMetric.key]}: ${activeMetric.formatter(value)}`;
        setTooltip({
            name,
            value: formattedValue,
            pct,
            x: clientX,
            y: clientY,
        });
    };

    const updateTooltipPos = (clientX: number, clientY: number) => {
        setTooltip((prev) => (prev ? { ...prev, x: clientX, y: clientY } : null));
    };

    return (
        <section className="space-y-3 border-t border-border pt-4 mt-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-light pb-1.5">
                <h3 className="font-bold uppercase tracking-wider text-primary">{title} Breakdown</h3>
                <select
                    value={selectedKey}
                    onChange={(e) => setSelectedKey(e.target.value as MetricKey)}
                    className="border border-border bg-white px-2 py-0.5 text-[10px] font-medium tracking-wide text-primary cursor-pointer rounded-none outline-none focus:border-accent"
                >
                    {availableOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>

            {chartData ? (
                <div className="space-y-3">
                    {/* Stacked Horizontal Bar */}
                    <div className="w-full h-5 flex border border-border bg-slate-100 overflow-hidden rounded-none select-none">
                        {chartData.segments.map((seg, idx) => (
                            <div
                                key={idx}
                                style={{
                                    width: `${seg.pct}%`,
                                    backgroundColor: seg.color,
                                }}
                                onMouseEnter={(e) => showTooltip(seg.name, seg.value, seg.pct, e.clientX, e.clientY)}
                                onMouseMove={(e) => updateTooltipPos(e.clientX, e.clientY)}
                                onMouseLeave={() => setTooltip(null)}
                                className="h-full hover:opacity-90 transition-opacity cursor-crosshair"
                            />
                        ))}
                    </div>

                    {/* Breakdown / Legend Table */}
                    <table className="w-full table-fixed border-collapse border border-border text-[11px] bg-white tabular-nums">
                        <colgroup>
                            <col className="w-[8%]" />
                            <col className="w-[52%]" />
                            <col className="w-[25%]" />
                            <col className="w-[15%]" />
                        </colgroup>
                        <thead>
                            <tr className="bg-slate-50 border-b border-border text-[9px] text-muted uppercase tracking-wider">
                                <th className="py-1 px-2 font-semibold text-center">Color</th>
                                <th className="py-1 px-2 font-semibold text-left">Entity</th>
                                <th className="py-1 px-2 font-semibold text-right">Value</th>
                                <th className="py-1 px-2 font-semibold text-right">Share</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light text-slate-700">
                            {chartData.segments.map((seg, idx) => (
                                <tr
                                    key={idx}
                                    onMouseEnter={(e) => showTooltip(seg.name, seg.value, seg.pct, e.clientX, e.clientY)}
                                    onMouseMove={(e) => updateTooltipPos(e.clientX, e.clientY)}
                                    onMouseLeave={() => setTooltip(null)}
                                    className="hover:bg-slate-50/50 cursor-crosshair transition-colors"
                                >
                                    <td className="py-1.5 px-2 text-center align-middle">
                                        <span className="inline-block w-2.5 h-2.5 border border-black/10" style={{ backgroundColor: seg.color }} />
                                    </td>
                                    <td className="py-1.5 px-2 font-medium text-left truncate">{seg.name}</td>
                                    <td className="py-1.5 px-2 text-right">{activeMetric.formatter(seg.value)}</td>
                                    <td className="py-1.5 px-2 text-right font-bold">{seg.pct.toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-[11px] text-muted italic">No metrics data found for this tier.</p>
            )}

            {/* Interactive Tooltip Card */}
            {tooltip && (
                <div
                    style={{
                        position: "fixed",
                        left: `${tooltip.x + 12}px`,
                        top: `${tooltip.y + 12}px`,
                        pointerEvents: "none",
                        zIndex: 9999,
                    }}
                    className="bg-slate-900 border border-slate-700 text-white font-sans text-xs px-3 py-2 shadow-lg select-none rounded-none min-w-[160px]"
                >
                    <div className="font-bold border-b border-slate-700 pb-1 mb-1">{tooltip.name}</div>
                    <div className="font-medium text-slate-200">{tooltip.value}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {tooltip.pct.toFixed(1)}% of {parentName}
                    </div>
                </div>
            )}
        </section>
    );
}
