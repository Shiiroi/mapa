// Line chart of population history points for a place (compact sparkline view).
import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

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

interface PopulationTrendProps {
    points: { year: number; value: number }[];
    formatValue?: (n: number) => string;
    ariaLabel?: string;
}

export const PopulationTrend = React.memo(function PopulationTrend({
    points,
    formatValue = formatCompactNumber,
    ariaLabel = "Population over time",
}: PopulationTrendProps) {
    if (points.length < 2) return null;

    return (
        <div className="h-[140px] w-full text-accent border border-border p-2 bg-slate-50/20 font-sans" role="img" aria-label={ariaLabel}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 12, right: 10, left: -22, bottom: -5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 9, fontWeight: 500 }} stroke="#cbd5e1" tickLine={false} />
                    <YAxis
                        tickFormatter={formatValue}
                        tick={{ fill: "#64748b", fontSize: 8, fontFamily: "monospace" }}
                        stroke="#cbd5e1"
                        tickLine={false}
                    />
                    <Tooltip
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(val: any) => [formatValue(Number(val)), "Value"]}
                        labelStyle={{ fontSize: 10, fontWeight: "bold", color: "#1e293b" }}
                        contentStyle={{ fontSize: 10, padding: "4px 8px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1" }}
                    />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        dot={{ r: 3, fill: "currentColor", strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
});
