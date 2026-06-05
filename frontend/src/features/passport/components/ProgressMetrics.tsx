import type { PassportStats } from "../types";

interface ProgressMetricsProps {
    stats: PassportStats | null;
    loading?: boolean;
}

export function ProgressMetrics({ stats, loading }: ProgressMetricsProps) {
    if (loading) return <div>Loading progress…</div>;
    if (!stats) return <div>No stats available</div>;

    return (
        <div>
            <h3>Travel Progress</h3>
            <p>
                {stats.visitedMunicities} / {stats.totalMunicities} municipalities visited
            </p>
            <p>Overall: {Math.round(stats.overallCompletion * 100)}%</p>
        </div>
    );
}
