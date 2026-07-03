import { useState, useMemo } from "react";
import type { MapLevel } from "../constants";
import type { Region, ProvinceGeoJSON, MunicityMeta, BarangayGeoJSON } from "../types";
import { formatPopulation, formatAreaKm2, formatDensity, formatGdp, formatAssets } from "../utils/formatStats";

interface SubLevelDataTableProps {
    level: MapLevel;
    regions: Region[];
    provinces: ProvinceGeoJSON[];
    municityMeta: MunicityMeta[];
    barangays: BarangayGeoJSON[];
    selectedRegionPsgc: string | null;
    selectedProvincePsgc: string | null;
    selectedMunicityPsgc: string | null;
    onSelectEntity: (psgc: string, level: MapLevel) => void;
}

type SortKey = "name" | "pop_2024" | "area_km2" | "density_2024" | "gdp_2024" | "assets_2024";

const CaretIcon = ({ activeKey, columnKey, direction }: { activeKey: SortKey | null; columnKey: SortKey; direction: "asc" | "desc" | null }) => {
    const isActive = activeKey === columnKey;
    const isAsc = isActive && direction === "asc";
    const isDesc = isActive && direction === "desc";

    return (
        <span className="inline-flex flex-col ml-1.5 align-middle select-none text-[8px] leading-[6px]">
            <span className={isAsc ? "text-primary font-bold" : "text-slate-300"}>▲</span>
            <span className={isDesc ? "text-primary font-bold" : "text-slate-300"}>▼</span>
        </span>
    );
};

export function SubLevelDataTable({
    level,
    regions,
    provinces,
    municityMeta,
    barangays,
    selectedRegionPsgc,
    selectedProvincePsgc,
    onSelectEntity,
}: SubLevelDataTableProps) {
    const [sortKey, setSortKey] = useState<SortKey | null>(null);
    const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);

    // Resolve which sub-level list we need to show
    const { subLevels, subLevelType, title } = useMemo(() => {
        let subLevels: (Region | ProvinceGeoJSON | MunicityMeta | BarangayGeoJSON)[] = [];
        let subLevelType: MapLevel = "region";
        let title = "";

        if (level === "country") {
            subLevels = regions;
            subLevelType = "region";
            title = "Component Regions";
        } else if (level === "region") {
            const isNcr = selectedRegionPsgc?.startsWith("13");
            if (isNcr) {
                subLevels = municityMeta.filter((m) => m.region_psgc === selectedRegionPsgc);
                subLevelType = "municipality";
                title = "Component Cities & Municipalities (NCR)";
            } else {
                subLevels = provinces.filter((p) => p.region_psgc === selectedRegionPsgc);
                subLevelType = "province";
                title = "Component Provinces";
            }
        } else if (level === "province") {
            subLevels = municityMeta.filter((m) => m.province_psgc === selectedProvincePsgc);
            subLevelType = "municipality";
            title = "Component Cities & Municipalities";
        } else if (level === "municipality") {
            subLevels = barangays;
            subLevelType = "barangay";
            title = "Component Barangays";
        }

        return { subLevels, subLevelType, title };
    }, [level, regions, provinces, municityMeta, barangays, selectedRegionPsgc, selectedProvincePsgc]);

    const sortedSubLevels = useMemo(() => {
        const list = [...subLevels];
        if (!sortKey || !sortDirection) {
            // Default sort: alphabetical by name ascending
            return list.sort((a, b) => a.name.trim().localeCompare(b.name.trim()));
        }

        return list.sort((a, b) => {
            const valA = (a as any)[sortKey];
            const valB = (b as any)[sortKey];

            if (valA == null && valB == null) return 0;
            if (valA == null) return 1;
            if (valB == null) return -1;

            if (typeof valA === "string" && typeof valB === "string") {
                const comp = valA.trim().localeCompare(valB.trim());
                return sortDirection === "asc" ? comp : -comp;
            } else {
                const comp = (valA as number) - (valB as number);
                return sortDirection === "asc" ? comp : -comp;
            }
        });
    }, [subLevels, sortKey, sortDirection]);

    const hasGdp = useMemo(() => {
        return subLevels.some((row) => row.gdp_2024 != null && row.gdp_2024 > 0);
    }, [subLevels]);

    const hasAssets = useMemo(() => {
        return subLevels.some((row) => row.assets_2024 != null && row.assets_2024 > 0);
    }, [subLevels]);

    if (level === "barangay" || sortedSubLevels.length === 0) {
        return null;
    }

    const handleSort = (key: SortKey) => {
        if (sortKey !== key) {
            setSortKey(key);
            setSortDirection("asc");
        } else {
            if (sortDirection === "asc") {
                setSortDirection("desc");
            } else if (sortDirection === "desc") {
                setSortDirection(null);
                setSortKey(null);
            } else {
                setSortDirection("asc");
            }
        }
    };

    return (
        <section className="space-y-2 border-t border-border pt-4 mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-light pb-1">
                {title} ({sortedSubLevels.length})
            </h3>
            <div className="overflow-x-auto border border-border">
                <table className="w-full border-collapse text-left text-xs bg-white table-auto">
                    <thead>
                        <tr className="bg-slate-50 border-b border-border text-[10px] text-muted uppercase tracking-wider select-none">
                            <th
                                onClick={() => handleSort("name")}
                                className="py-2 px-3 font-semibold text-left cursor-pointer hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center">
                                    <span>Name</span>
                                    <CaretIcon activeKey={sortKey} columnKey="name" direction={sortDirection} />
                                </div>
                            </th>
                            <th
                                onClick={() => handleSort("pop_2024")}
                                className="py-2 px-3 font-semibold text-right cursor-pointer hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center justify-end">
                                    <span>Population</span>
                                    <CaretIcon activeKey={sortKey} columnKey="pop_2024" direction={sortDirection} />
                                </div>
                            </th>
                            <th
                                onClick={() => handleSort("area_km2")}
                                className="py-2 px-3 font-semibold text-right cursor-pointer hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center justify-end">
                                    <span>Area</span>
                                    <CaretIcon activeKey={sortKey} columnKey="area_km2" direction={sortDirection} />
                                </div>
                            </th>
                            <th
                                onClick={() => handleSort("density_2024")}
                                className="py-2 px-3 font-semibold text-right cursor-pointer hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center justify-end">
                                    <span>Density</span>
                                    <CaretIcon activeKey={sortKey} columnKey="density_2024" direction={sortDirection} />
                                </div>
                            </th>
                            {hasGdp && (
                                <th
                                    onClick={() => handleSort("gdp_2024")}
                                    className="py-2 px-3 font-semibold text-right cursor-pointer hover:bg-slate-100 transition-colors"
                                >
                                    <div className="flex items-center justify-end">
                                        <span>GDP</span>
                                        <CaretIcon activeKey={sortKey} columnKey="gdp_2024" direction={sortDirection} />
                                    </div>
                                </th>
                            )}
                            {hasAssets && (
                                <th
                                    onClick={() => handleSort("assets_2024")}
                                    className="py-2 px-3 font-semibold text-right cursor-pointer hover:bg-slate-100 transition-colors"
                                >
                                    <div className="flex items-center justify-end">
                                        <span>Assets</span>
                                        <CaretIcon activeKey={sortKey} columnKey="assets_2024" direction={sortDirection} />
                                    </div>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light tabular-nums">
                        {sortedSubLevels.map((row) => (
                            <tr key={row.psgc} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2 px-3 font-semibold text-left">
                                    <button
                                        type="button"
                                        onClick={() => onSelectEntity(row.psgc, subLevelType)}
                                        className="text-accent hover:underline text-left font-bold cursor-pointer"
                                    >
                                        {row.name.trim()}
                                    </button>
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700">
                                    {row.pop_2024 != null ? formatPopulation(row.pop_2024) : "—"}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700">
                                    {row.area_km2 != null ? formatAreaKm2(row.area_km2) : "—"}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700">
                                    {row.density_2024 != null ? `${formatDensity(row.density_2024)}/km²` : "—"}
                                </td>
                                {hasGdp && (
                                    <td className="py-2 px-3 text-right text-slate-700">
                                        {row.gdp_2024 != null ? formatGdp(row.gdp_2024) : "—"}
                                    </td>
                                )}
                                {hasAssets && (
                                    <td className="py-2 px-3 text-right text-slate-700">
                                        {row.assets_2024 != null ? formatAssets(row.assets_2024) : "—"}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
