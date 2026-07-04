import { useState, useMemo } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    type SortingState,
    type ColumnDef,
} from "@tanstack/react-table";
import type { MapLevel } from "../../../constants";
import type { Region, ProvinceGeoJSON, MunicityMeta, BarangayGeoJSON } from "../../../types";
import { formatPopulation, formatAreaKm2, formatDensity, formatGdp, formatAssets } from "../../../utils/formatStats";

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

type SubLevelRow = Region | ProvinceGeoJSON | MunicityMeta | BarangayGeoJSON;

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
    const [sorting, setSorting] = useState<SortingState>([]);

    // Resolve which sub-level list we need to show
    const { subLevels, subLevelType, title } = useMemo(() => {
        let subLevels: SubLevelRow[] = [];
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

    const hasGdp = useMemo(() => {
        return subLevels.some((row) => row.gdp_2024 != null && row.gdp_2024 > 0);
    }, [subLevels]);

    const hasAssets = useMemo(() => {
        return subLevels.some((row) => row.assets_2024 != null && row.assets_2024 > 0);
    }, [subLevels]);

    // Define TanStack Table Columns with strict type safety
    const columns = useMemo<ColumnDef<SubLevelRow, unknown>[]>(() => {
        const cols: ColumnDef<SubLevelRow, unknown>[] = [
            {
                accessorKey: "name",
                header: "Name",
                meta: { className: "text-left" },
                cell: (info) => {
                    const name = info.getValue() as string;
                    const psgc = info.row.original.psgc;
                    return (
                        <button
                            type="button"
                            onClick={() => onSelectEntity(psgc, subLevelType)}
                            className="text-accent hover:underline text-left font-bold cursor-pointer"
                        >
                            {name.trim()}
                        </button>
                    );
                },
            },
            {
                accessorKey: "pop_2024",
                header: "Population",
                meta: { className: "text-right" },
                cell: (info) => {
                    const val = info.getValue() as number | null | undefined;
                    return val != null ? formatPopulation(val) : "—";
                },
            },
            {
                accessorKey: "area_km2",
                header: "Area",
                meta: { className: "text-right" },
                cell: (info) => {
                    const val = info.getValue() as number | null | undefined;
                    return val != null ? formatAreaKm2(val) : "—";
                },
            },
            {
                accessorKey: "density_2024",
                header: "Density",
                meta: { className: "text-right" },
                cell: (info) => {
                    const val = info.getValue() as number | null | undefined;
                    return val != null ? `${formatDensity(val)}/km²` : "—";
                },
            },
        ];

        if (hasGdp) {
            cols.push({
                accessorKey: "gdp_2024",
                header: "GDP",
                meta: { className: "text-right" },
                cell: (info) => {
                    const val = info.getValue() as number | null | undefined;
                    return val != null ? formatGdp(val) : "—";
                },
            });
        }

        if (hasAssets) {
            cols.push({
                accessorKey: "assets_2024",
                header: "Assets",
                meta: { className: "text-right" },
                cell: (info) => {
                    const val = info.getValue() as number | null | undefined;
                    return val != null ? formatAssets(val) : "—";
                },
            });
        }

        return cols;
    }, [subLevelType, onSelectEntity, hasGdp, hasAssets]);

    const table = useReactTable({
        data: subLevels,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    if (level === "barangay" || subLevels.length === 0) {
        return null;
    }

    return (
        <section className="space-y-2 border-t border-border pt-4 mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-light pb-1">
                {title} ({subLevels.length})
            </h3>
            <div className="overflow-x-auto border border-border">
                <table className="w-full border-collapse text-left text-xs bg-white table-auto">
                    <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr
                                key={headerGroup.id}
                                className="bg-slate-50 border-b border-border text-[10px] text-muted uppercase tracking-wider select-none"
                            >
                                {headerGroup.headers.map((header) => {
                                    const meta = header.column.columnDef.meta as { className?: string } | undefined;
                                    const isSorted = header.column.getIsSorted();
                                    return (
                                        <th
                                            key={header.id}
                                            onClick={header.column.getToggleSortingHandler()}
                                            className={`py-2 px-3 font-semibold cursor-pointer hover:bg-slate-100 transition-colors ${
                                                meta?.className ?? "text-left"
                                            }`}
                                        >
                                            <div className={`flex items-center ${meta?.className?.includes("text-right") ? "justify-end" : "justify-start"}`}>
                                                <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                                                <span className="inline-flex flex-col ml-1.5 align-middle select-none text-[8px] leading-[6px]">
                                                    <span className={isSorted === "asc" ? "text-primary font-bold" : "text-slate-300"}>▲</span>
                                                    <span className={isSorted === "desc" ? "text-primary font-bold" : "text-slate-300"}>▼</span>
                                                </span>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-border-light tabular-nums">
                        {table.getRowModel().rows.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                {row.getVisibleCells().map((cell) => {
                                    const meta = cell.column.columnDef.meta as { className?: string } | undefined;
                                    return (
                                        <td
                                            key={cell.id}
                                            className={`py-2 px-3 text-slate-700 ${
                                                meta?.className ?? "text-left"
                                            } ${cell.column.id === "name" ? "font-semibold" : ""}`}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
