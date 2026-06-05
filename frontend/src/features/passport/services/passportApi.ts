import { supabase } from "../../../config/supabase";
import type { PassportStats, ProvinceProgress, RegionBadge } from "../types";

export async function fetchPassportStats(userId: string): Promise<PassportStats> {
    // Fetch total municities count
    const { count: totalMunicities, error: totalError } = await supabase.from("municities").select("*", { count: "exact", head: true });

    if (totalError) throw totalError;

    // Fetch visited municities for user
    const { data: visitedData, error: visitedError } = await supabase
        .from("visited_places")
        .select("municity_id, municities!inner(province_id, regions!inner(id))")
        .eq("user_id", userId);

    if (visitedError) throw visitedError;

    const visitedCount = visitedData?.length ?? 0;

    // Build province progress
    const { data: provinces, error: provError } = await supabase.from("provinces").select("id, name, region_id");

    if (provError) throw provError;

    const provinceProgress: ProvinceProgress[] = (provinces ?? []).map((p) => ({
        provinceId: p.id,
        provinceName: p.name,
        totalMunicities: 0, // would need a count query per province
        visitedMunicities: 0,
        completionFraction: 0,
    }));

    // Build region badges
    const { data: regions, error: regError } = await supabase.from("regions").select("id, name");

    if (regError) throw regError;

    const regionBadges: RegionBadge[] = (regions ?? []).map((r) => ({
        regionId: r.id,
        regionName: r.name,
        totalProvinces: 0,
        visitedProvinces: 0,
        badgeEarned: false,
    }));

    return {
        totalMunicities: totalMunicities ?? 0,
        visitedMunicities: visitedCount,
        overallCompletion: totalMunicities ? visitedCount / totalMunicities : 0,
        regionBadges,
        provinceProgress,
    };
}
