import type { RegionBadge } from "../types";

interface RegionBadgeGridProps {
    badges: RegionBadge[];
    loading?: boolean;
}

export function RegionBadgeGrid({ badges, loading }: RegionBadgeGridProps) {
    if (loading) return <div>Loading badges…</div>;

    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
            {badges.map((badge) => (
                <div
                    key={badge.regionId}
                    style={{
                        padding: 16,
                        borderRadius: 8,
                        background: badge.badgeEarned ? "#d4edda" : "#f8f9fa",
                        border: `2px solid ${badge.badgeEarned ? "#28a745" : "#dee2e6"}`,
                        textAlign: "center",
                    }}
                >
                    <div>{badge.regionName}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                        {badge.visitedProvinces}/{badge.totalProvinces} provinces
                    </div>
                    {badge.badgeEarned && <div style={{ fontSize: 24 }}>🏆</div>}
                </div>
            ))}
        </div>
    );
}
