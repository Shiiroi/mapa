export interface ProvinceProgress {
    provinceId: number;
    provinceName: string;
    totalMunicities: number;
    visitedMunicities: number;
    completionFraction: number; // 0–1
}

export interface RegionBadge {
    regionId: number;
    regionName: string;
    totalProvinces: number;
    visitedProvinces: number;
    badgeEarned: boolean;
}

export interface PassportStats {
    totalMunicities: number;
    visitedMunicities: number;
    overallCompletion: number;
    regionBadges: RegionBadge[];
    provinceProgress: ProvinceProgress[];
}
