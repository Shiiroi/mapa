// Compact age-structure bar: young / working-age / senior share visualization.
import React, { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { formatPopulation } from "../../../utils/formatStats";

interface AgeStructureProps {
    young: number;
    working: number;
    senior: number;
}

export const AgeStructure = React.memo(function AgeStructure({ young, working, senior }: AgeStructureProps) {
    const total = young + working + senior;
    const yPct = total > 0 ? (young / total) * 100 : 0;
    const wPct = total > 0 ? (working / total) * 100 : 0;
    const sPct = total > 0 ? (senior / total) * 100 : 0;

    const data = useMemo(
        () => [
            { name: "0-14", value: young, percentage: yPct, color: "#0284c7" },
            { name: "15-64", value: working, percentage: wPct, color: "#10b981" },
            { name: "65+", value: senior, percentage: sPct, color: "#f59e0b" },
        ],
        [young, working, senior, yPct, wPct, sPct],
    );

    if (total === 0) return null;

    return (
        <div className="border border-border p-2 bg-slate-50/20 flex items-center justify-center h-[90px] w-full font-sans">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 12, right: 5, left: -25, bottom: -5 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 8 }} stroke="#cbd5e1" tickLine={false} />
                    <YAxis
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fill: "#64748b", fontSize: 7, fontFamily: "monospace" }}
                        stroke="#cbd5e1"
                        tickLine={false}
                    />
                    <Tooltip
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(_value: any, _name: any, props: any) => [
                            `${formatPopulation(props.payload.value)} (${props.payload.percentage.toFixed(0)}%)`,
                            "Share",
                        ]}
                        contentStyle={{ fontSize: 9, padding: "2px 6px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1" }}
                        wrapperStyle={{ pointerEvents: "none" }}
                    />
                    <Bar dataKey="percentage" fill="#0284c7" isAnimationActive={false}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
});
