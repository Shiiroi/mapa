import { useMemo } from "react";
import { cn } from "../../../../lib/cn";
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from "@tanstack/react-table";
import { formatPopulation } from "../../../utils/formatStats";
import { broadAgeGroups } from "../../../utils/ageSex";
import type { AgeSexBand } from "../../../types";

interface AgeStructureTableProps {
    ageSexBands: AgeSexBand[];
}

export function AgeStructureTable({ ageSexBands }: AgeStructureTableProps) {
    const groups = useMemo(() => broadAgeGroups(ageSexBands), [ageSexBands]);
    const total = groups.total || 1;

    const data = useMemo(() => [
        {
            group: "0–14 years",
            pop: formatPopulation(groups.young),
            share: `${((groups.young / total) * 100).toFixed(1)}%`,
            className: "text-sky-600",
        },
        {
            group: "15–64 years",
            pop: formatPopulation(groups.working),
            share: `${((groups.working / total) * 100).toFixed(1)}%`,
            className: "text-emerald-600",
        },
        {
            group: "65+ years",
            pop: formatPopulation(groups.senior),
            share: `${((groups.senior / total) * 100).toFixed(1)}%`,
            className: "text-amber-600",
        },
    ], [groups, total]);

    const columns = useMemo(() => [
        { accessorKey: "group", header: "AGE GROUP" },
        { accessorKey: "pop", header: "POP" },
        { accessorKey: "share", header: "SHARE" },
    ], []);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <table className="w-full table-fixed border-collapse border border-border text-xs tabular-nums bg-white">
            <colgroup>
                <col className="w-1/3" />
                <col className="w-1/3" />
                <col className="w-1/3" />
            </colgroup>
            <thead>
                <tr className="text-[10px] text-muted bg-slate-50/50 border-b border-border">
                    {table.getFlatHeaders().map((header, idx) => (
                        <th
                            key={header.id}
                            className={cn("py-1 px-1.5 font-semibold", idx === 0 ? "text-left" : "text-right")}
                        >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-b-0">
                        <td className="py-1.5 px-1.5 font-medium text-primary text-left">
                            {row.original.group}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-slate-700">
                            {row.original.pop}
                        </td>
                        <td className={cn("py-1.5 px-1.5 text-right font-bold", row.original.className)}>
                            {row.original.share}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
