import type { PassportStats } from "../types";

interface ShareCardProps {
    stats: PassportStats | null;
    username?: string;
}

export function ShareCard({ stats, username }: ShareCardProps) {
    if (!stats) return null;

    return (
        <div
            style={{
                padding: 24,
                borderRadius: 12,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                textAlign: "center",
                maxWidth: 400,
            }}
        >
            <h3>{username ?? "Traveler"}'s Passport</h3>
            <div style={{ fontSize: 48, margin: "16px 0" }}>{Math.round(stats.overallCompletion * 100)}%</div>
            <p>Philippines Complete</p>
            <p style={{ fontSize: 14, opacity: 0.8 }}>
                {stats.visitedMunicities} of {stats.totalMunicities} municipalities
            </p>
        </div>
    );
}
