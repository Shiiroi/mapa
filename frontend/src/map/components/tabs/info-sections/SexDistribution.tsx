// Donut chart showing male/female population share for a place.
import React, { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatPopulation } from "../../../utils/formatStats";

interface SexDistributionProps {
    male: number;
    female: number;
}

export const SexDistribution = React.memo(function SexDistribution({ male, female }: SexDistributionProps) {
    const total = male + female;
    const malePct = total > 0 ? (male / total) * 100 : 0;
    const femalePct = total > 0 ? 100 - malePct : 0;

    const data = useMemo(
        () => [
            { name: "Male", value: male, percentage: malePct, color: "#0284c7" },
            { name: "Female", value: female, percentage: femalePct, color: "#f43f5e" },
        ],
        [male, female, malePct, femalePct],
    );

    if (total === 0) return null;

    return (
        <div className="flex items-center justify-center gap-3 border border-border p-2 bg-slate-50/20 h-[80px] font-sans">
            <div className="w-[68px] h-[68px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={20} outerRadius={28} paddingAngle={2}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={(val: any, name: any, props: any) => [
                                `${formatPopulation(Number(val))} (${props.payload.percentage.toFixed(1)}%)`,
                                String(name),
                            ]}
                            contentStyle={{ fontSize: 9, padding: "2px 6px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1" }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
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
});
