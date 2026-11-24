import type { ResolvedPlace } from "../map/utils/resolvePlace";

export interface InitialPlaceSeed {
    routePath: string;
    place: ResolvedPlace;
}

export function normalizeRoutePath(p: string): string {
    const trimmed = p.replace(/\/+$/, "");
    return trimmed || "/";
}

let cachedSeed: InitialPlaceSeed | null | undefined;

export function getInitialPlaceSeed(): InitialPlaceSeed | null {
    if (cachedSeed !== undefined) return cachedSeed;
    if (typeof document === "undefined" || typeof window === "undefined") {
        cachedSeed = null;
        return null;
    }
    const el = document.getElementById("lens-initial-place");
    if (!el || !el.textContent) {
        cachedSeed = null;
        return null;
    }
    try {
        const parsed = JSON.parse(el.textContent) as InitialPlaceSeed;
        if (parsed && parsed.routePath && parsed.place && parsed.place.psgc) {
            cachedSeed = parsed;
            return parsed;
        }
    } catch {
        // Ignore malformed seed script and fall back to async layer resolution.
    }
    cachedSeed = null;
    return null;
}

export function getActiveInitialPlace(): ResolvedPlace | null {
    if (typeof window === "undefined") return null;
    const seed = getInitialPlaceSeed();
    if (!seed) return null;
    return normalizeRoutePath(window.location.pathname) === normalizeRoutePath(seed.routePath)
        ? seed.place
        : null;
}
