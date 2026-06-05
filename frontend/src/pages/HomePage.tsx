import { TravelMap } from "../features/map/components/TravelMap";
import { useMapLayers } from "../features/map/hooks/useMapLayers";

export default function HomePage() {
    const { provinces, municities, regions, loading, error } = useMapLayers();

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
            {loading && (
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: 1000,
                        background: "white",
                        padding: "1rem 2rem",
                        borderRadius: 8,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    }}
                >
                    Loading Philippines map…
                </div>
            )}
            {error && (
                <div
                    style={{
                        position: "absolute",
                        top: "1rem",
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 1000,
                        background: "#fee2e2",
                        color: "#991b1b",
                        padding: "0.75rem 1.5rem",
                        borderRadius: 8,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    }}
                >
                    Failed to load map: {error.message}
                </div>
            )}
            {!loading && !error && (
                <div style={{ width: "100%", height: "100%" }}>
                    <TravelMap provinces={provinces} regions={regions} municities={municities} defaultMode="province" />
                </div>
            )}
        </div>
    );
}
