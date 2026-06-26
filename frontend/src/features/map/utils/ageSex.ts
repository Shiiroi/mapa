import type { AgeSexBand } from "../types";

// Reads the lower-bound age from a PSA band label, e.g. "65 - 69" gives 65.
export function bandLowerAge(age: string): number {
    const m = age.match(/\d+/);
    return m ? Number(m[0]) : 0;
}

export interface BroadAgeGroups {
    young: number;
    working: number;
    senior: number;
    total: number;
}

// Folds the 5-year bands into young (0-14), working-age (15-64), and senior (65+) totals.
export function broadAgeGroups(bands: AgeSexBand[]): BroadAgeGroups {
    let young = 0;
    let working = 0;
    let senior = 0;
    for (const b of bands) {
        const lower = bandLowerAge(b.age);
        if (lower < 15) young += b.both;
        else if (lower < 65) working += b.both;
        else senior += b.both;
    }
    return { young, working, senior, total: young + working + senior };
}
