import { cn } from "../../../../lib/cn";
import type { CustomOverlay, SeriesViewState, SeriesViewMode } from "../../../types";
import { seriesModeLabel } from "../../../utils/seriesScale";

const SERIES_MODES: { mode: SeriesViewMode; label: string; minSeries: number }[] = [
    { mode: "dominant", label: "Dominant", minSeries: 1 },
    { mode: "lead", label: "Lead", minSeries: 2 },
    { mode: "share", label: "Share", minSeries: 1 },
    { mode: "head2head", label: "Head-to-head", minSeries: 2 },
];

interface SeriesConfigProps {
    activeOverlay: CustomOverlay;
    overlayView: SeriesViewState;
    onOverlayViewChange: (view: SeriesViewState) => void;
}

export function SeriesConfig({
    activeOverlay,
    overlayView,
    onOverlayViewChange,
}: SeriesConfigProps) {
    const seriesKeys = activeOverlay.series?.map((s) => s.key) ?? [];
    const seriesCount = seriesKeys.length;

    if (seriesCount === 0) return null;

    const setMode = (mode: SeriesViewMode) => {
        onOverlayViewChange({ ...overlayView, mode });
    };

    return (
        <div className="space-y-2 border-t border-border-light pt-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Visualization</p>
            <div className="flex flex-wrap gap-1">
                {SERIES_MODES.map(({ mode, label, minSeries }) => {
                    const disabled = seriesCount < minSeries;
                    return (
                        <button
                            key={mode}
                            type="button"
                            disabled={disabled}
                            onClick={() => setMode(mode)}
                            title={disabled ? `Needs at least ${minSeries} series` : undefined}
                            className={cn(
                                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                                overlayView.mode === mode
                                    ? "bg-accent text-white"
                                    : "border border-border-light text-primary hover:bg-surface",
                                disabled && "cursor-not-allowed opacity-40",
                            )}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {overlayView.mode === "share" && (
                <label className="block space-y-1">
                    <span className="text-xs text-muted">Series</span>
                    <select
                        value={overlayView.shareKey ?? seriesKeys[0]}
                        onChange={(e) =>
                            onOverlayViewChange({ ...overlayView, shareKey: e.target.value })
                        }
                        className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm text-primary"
                    >
                        {activeOverlay.series!.map((s) => (
                            <option key={s.key} value={s.key}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                </label>
            )}

            {overlayView.mode === "head2head" && seriesCount >= 2 && (
                <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1">
                        <span className="text-xs text-muted">Series A</span>
                        <select
                            value={overlayView.pairA ?? seriesKeys[0]}
                            onChange={(e) =>
                                onOverlayViewChange({ ...overlayView, pairA: e.target.value })
                            }
                            className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm text-primary"
                        >
                            {activeOverlay.series!.map((s) => (
                                <option key={s.key} value={s.key}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block space-y-1">
                        <span className="text-xs text-muted">Series B</span>
                        <select
                            value={overlayView.pairB ?? seriesKeys[1]}
                            onChange={(e) =>
                                onOverlayViewChange({ ...overlayView, pairB: e.target.value })
                            }
                            className="w-full rounded-md border border-border-light bg-white px-2 py-1.5 text-sm text-primary"
                        >
                            {activeOverlay.series!.map((s) => (
                                <option key={s.key} value={s.key}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            )}

            <p className="text-[10px] text-muted">
                Viewing: {seriesModeLabel(overlayView.mode)}
                {activeOverlay.meta.unit ? ` · ${activeOverlay.meta.unit}` : ""}
            </p>
        </div>
    );
}
