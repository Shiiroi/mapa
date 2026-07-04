import { useMemo } from "react";
import { cn } from "../../../../lib/cn";
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from "@tanstack/react-table";
import {
    changeToneClass,
    formatPctChange,
    formatPopulation,
    formatDensity,
    formatAreaKm2,
    formatAssets,
    formatGdp,
} from "../../../utils/formatStats";
import type { ResolvedPlace } from "../../../utils/resolvePlace";

interface KeyStatsTableProps {
    displayPlace: ResolvedPlace;
    annualChange: string | null;
}

export function KeyStatsTable({ displayPlace, annualChange }: KeyStatsTableProps) {
    const data = useMemo(() => [
        {
            metric: "POPULATION (2024)",
            value: formatPopulation(displayPlace.pop_2024),
            className: "font-medium text-primary",
        },
        {
            metric: "CHANGE (2020 → 2024)",
            value: (
                <span className={changeToneClass(displayPlace.pct_change_2020_2024)}>
                    {formatPctChange(displayPlace.pct_change_2020_2024)}
                    {displayPlace.pop_2020 != null && annualChange && (
                        <span className="text-[10px] font-normal text-muted ml-1">({annualChange})</span>
                    )}
                </span>
            ),
            className: "font-bold",
        },
        {
            metric: "POPULATION DENSITY",
            value: displayPlace.density_2024 != null ? `${formatDensity(displayPlace.density_2024)}/km²` : "—",
            className: "font-medium text-primary",
        },
        {
            metric: "OFFICIAL LAND AREA",
            value: (
                <>
                    {formatAreaKm2(displayPlace.area_km2)}
                    {displayPlace.area_km2 != null && (
                        <span className="block text-[9px] text-muted font-normal mt-0.5 leading-none text-left">
                            {displayPlace.level === "barangay"
                                ? "Estimated from boundary polygon"
                                : "Official area from PSA Table A"}
                        </span>
                    )}
                </>
            ),
            className: "font-medium text-primary",
        },
        {
            metric: "TOTAL ASSETS (2024)",
            value: formatAssets(displayPlace.assets_2024),
            className: "font-medium text-primary",
        },
        {
            metric: "GROSS REGIONAL GDP (2024)",
            value: (
                <>
                    {displayPlace.gdp_2024 != null ? formatGdp(displayPlace.gdp_2024) : "—"}
                    {displayPlace.gdp_2024 == null && (
                        <span className="block text-[9px] text-muted font-normal mt-0.5 leading-none text-left">Not published at this level</span>
                    )}
                </>
            ),
            className: "font-medium text-primary",
        },
    ], [displayPlace, annualChange]);

    const columns = useMemo(() => [
        {
            accessorKey: "metric",
            header: "Metric",
        },
        {
            accessorKey: "value",
            header: "Value",
        },
    ], []);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="w-full overflow-x-auto border border-border bg-white text-xs tabular-nums text-primary">
            <table className="w-full border-collapse">
                <tbody>
                    {table.getRowModel().rows.map((row, index) => (
                        <tr
                            key={row.id}
                            className={cn(
                                "border-b border-border last:border-b-0",
                                index % 2 === 0 ? "bg-slate-50/30" : ""
                            )}
                        >
                            <td className="py-2 px-3 font-semibold text-muted text-left w-1/3 uppercase">
                                {flexRender(row.getVisibleCells()[0].column.columnDef.cell, row.getVisibleCells()[0].getContext())}
                            </td>
                            <td className={cn("py-2 px-3 text-right w-2/3", row.original.className)}>
                                {flexRender(row.getVisibleCells()[1].column.columnDef.cell, row.getVisibleCells()[1].getContext())}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
