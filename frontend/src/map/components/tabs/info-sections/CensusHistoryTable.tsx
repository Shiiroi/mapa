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
    formatGrowthRate,
    formatPopulation,
} from "../../../utils/formatStats";
import type { ResolvedPlace } from "../../../utils/resolvePlace";

// Helper for percent change
function totalPctChange(from: number | null, to: number | null): number | null {
    if (from == null || to == null || from === 0) return null;
    return ((to - from) / from) * 100;
}

interface CensusHistoryTableProps {
    displayPlace: ResolvedPlace;
}

export function CensusHistoryTable({ displayPlace }: CensusHistoryTableProps) {
    const data = useMemo(() => {
        const pop2010 = displayPlace.pop_2010;
        const pop2015 = displayPlace.pop_2015;
        const pop2020 = displayPlace.pop_2020;
        const pop2024 = displayPlace.pop_2024;

        const change2015 = totalPctChange(pop2010, pop2015);
        const change2020 = totalPctChange(pop2015, pop2020);
        const change2024 = totalPctChange(pop2020, pop2024);

        const pgr2015 = pop2010 != null && pop2015 != null ? ((Math.pow(pop2015 / pop2010, 1 / 5) - 1) * 100) : null;
        const pgr2020 = pop2015 != null && pop2020 != null ? ((Math.pow(pop2020 / pop2015, 1 / 5) - 1) * 100) : null;
        const pgr2024 = pop2020 != null && pop2024 != null ? ((Math.pow(pop2024 / pop2020, 1 / 4) - 1) * 100) : null;

        return [
            {
                metric: "Population",
                y2010: formatPopulation(pop2010),
                y2015: formatPopulation(pop2015),
                y2020: formatPopulation(pop2020),
                y2024: formatPopulation(pop2024),
                classes: { y2010: "text-primary font-medium", y2015: "text-primary font-medium", y2020: "text-primary font-medium", y2024: "text-primary font-medium" },
            },
            {
                metric: "Total Change",
                y2010: "—",
                y2015: formatPctChange(change2015),
                y2020: formatPctChange(change2020),
                y2024: formatPctChange(change2024),
                classes: {
                    y2010: "text-muted font-normal",
                    y2015: cn("italic font-medium", changeToneClass(change2015)),
                    y2020: cn("italic font-medium", changeToneClass(change2020)),
                    y2024: cn("italic font-medium", changeToneClass(change2024)),
                },
            },
            {
                metric: "Growth/yr (CAGR)",
                y2010: "—",
                y2015: formatGrowthRate(pgr2015),
                y2020: formatGrowthRate(pgr2020),
                y2024: formatGrowthRate(pgr2024),
                classes: {
                    y2010: "text-muted font-normal",
                    y2015: cn("font-semibold", changeToneClass(pgr2015)),
                    y2020: cn("font-semibold", changeToneClass(pgr2020)),
                    y2024: cn("font-semibold", changeToneClass(pgr2024)),
                },
            },
        ];
    }, [displayPlace]);

    const columns = useMemo(() => [
        { accessorKey: "metric", header: "CENSUS" },
        { accessorKey: "y2010", header: "2010" },
        { accessorKey: "y2015", header: "2015" },
        { accessorKey: "y2020", header: "2020" },
        { accessorKey: "y2024", header: "2024" },
    ], []);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="w-full overflow-x-auto border border-border bg-white text-xs tabular-nums">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="text-[10px] text-muted bg-slate-50/50 border-b border-border font-semibold uppercase">
                        {table.getFlatHeaders().map((header, idx) => (
                            <th
                                key={header.id}
                                className={cn("py-1.5 px-2", idx === 0 ? "text-left" : "text-right")}
                            >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="border-b border-border last:border-b-0">
                            <td className="py-1.5 px-2 text-left text-muted font-medium w-1/3">
                                {row.original.metric}
                            </td>
                            <td className={cn("py-1.5 px-2 text-right w-[16.6%]", row.original.classes.y2010)}>
                                {row.original.y2010}
                            </td>
                            <td className={cn("py-1.5 px-2 text-right w-[16.6%]", row.original.classes.y2015)}>
                                {row.original.y2015}
                            </td>
                            <td className={cn("py-1.5 px-2 text-right w-[16.6%]", row.original.classes.y2020)}>
                                {row.original.y2020}
                            </td>
                            <td className={cn("py-1.5 px-2 text-right w-[16.6%]", row.original.classes.y2024)}>
                                {row.original.y2024}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
