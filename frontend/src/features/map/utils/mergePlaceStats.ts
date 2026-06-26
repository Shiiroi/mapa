// Overlays division_stats from the DB onto a resolved place (DB wins when present).

import type { DivisionStats } from "../types";
import type { ResolvedPlace } from "./resolvePlace";

export function mergePlaceStats(
    place: ResolvedPlace,
    dbStats: DivisionStats | null | undefined,
): ResolvedPlace {
    if (!dbStats) return place;
    return {
        ...place,
        pop_2010: dbStats.pop_2010 ?? place.pop_2010,
        pop_2015: dbStats.pop_2015 ?? place.pop_2015,
        pop_2020: dbStats.pop_2020 ?? place.pop_2020,
        pop_2024: dbStats.pop_2024 ?? place.pop_2024,
        pop_male_2020: dbStats.pop_male_2020 ?? place.pop_male_2020,
        pop_female_2020: dbStats.pop_female_2020 ?? place.pop_female_2020,
        age_sex_2020: dbStats.age_sex_2020 ?? place.age_sex_2020,
        area_km2: dbStats.area_km2 ?? place.area_km2,
        density_2024: dbStats.density_2024 ?? place.density_2024,
        pct_change_2020_2024: dbStats.pct_change_2020_2024 ?? place.pct_change_2020_2024,
        assets_2024: dbStats.assets_2024 ?? place.assets_2024,
        gdp_2022: dbStats.gdp_2022 ?? place.gdp_2022,
        gdp_2023: dbStats.gdp_2023 ?? place.gdp_2023,
        gdp_2024: dbStats.gdp_2024 ?? place.gdp_2024,
    };
}
