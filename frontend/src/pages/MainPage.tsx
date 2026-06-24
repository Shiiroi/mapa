// Split-layout shell: map panel and download sidebar.

import { useCallback } from "react";
import { MpaDownloadPanel } from "../features/map/components/MpaDownloadPanel";
import { MpaMapPanel } from "../features/map/components/MpaMapPanel";
import { useMpaDownload } from "../features/map/hooks/useMpaDownload";
import { useMapLayers } from "../features/map/hooks/useMapLayers";
import type { MpaLevel } from "../features/map/constants";

export default function MainPage() {
    const { provinces, municities, municityMeta, regions, loading, error } = useMapLayers();

    const download = useMpaDownload({ regions, provinces, municities, municityMeta });

    const handleFeatureClick = useCallback(
        (entityId: number, mode: MpaLevel) => {
            download.setSelectionFromMap(mode, entityId);
        },
        [download],
    );

    return (
        <div className="flex h-dvh flex-col lg:grid lg:grid-cols-[7fr_3fr]">
            <div className="min-h-[55dvh] flex-1 lg:min-h-0">
                <MpaMapPanel
                    provinces={provinces}
                    regions={regions}
                    municities={municities}
                    mode={download.level}
                    onFeatureClick={handleFeatureClick}
                    loading={loading}
                    error={error}
                />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden lg:flex-none">
                <MpaDownloadPanel
                    level={download.level}
                    onLevelChange={(l) => {
                        download.setLevel(l);
                        download.setDownloadMode("single");
                    }}
                    regions={regions}
                    provinces={provinces}
                    municityMeta={municityMeta}
                    selectedRegionId={download.selectedRegionId}
                    onRegionChange={download.setSelectedRegionId}
                    selectedProvinceId={download.selectedProvinceId}
                    onProvinceChange={download.setSelectedProvinceId}
                    selectedMunicityId={download.selectedMunicityId}
                    onMunicityChange={download.setSelectedMunicityId}
                    regionFilterId={download.regionFilterId}
                    onRegionFilterChange={download.setRegionFilterId}
                    provinceFilterId={download.provinceFilterId}
                    onProvinceFilterChange={download.setProvinceFilterId}
                    downloadMode={download.downloadMode}
                    onDownloadModeChange={download.setDownloadMode}
                    onDownload={download.download}
                    downloading={download.downloading}
                    error={download.error}
                />
            </div>
        </div>
    );
}
