/**
 * Slugify converts a name into a URL-safe lowercase hyphenated string.
 * Removes diacritics, special characters, and collapses whitespace.
 */
export function slugify(name: string): string {
    return (
        name
            .normalize("NFKD")
            // remove diacritics
            .replace(/\p{Diacritic}+/gu, "")
            .toLowerCase()
            // replace ampersand with and
            .replace(/&/g, " and ")
            // remove apostrophes
            .replace(/[''`]/g, "")
            // replace non-alphanumeric with hyphens
            .replace(/[^a-z0-9]+/g, "-")
            // collapse multiple hyphens
            .replace(/-+/g, "-")
            // trim hyphens
            .replace(/^-|-$/g, "")
    );
}

export interface CityNameAliases {
    displayTitle: string;
    shortName: string;
    aliases: string[];
    aliasSlugs: string[];
}

export function getCityNameAliases(name: string): CityNameAliases {
    const trimmed = name.trim();
    const match = trimmed.match(/^City of\s+(.+)$/i);
    if (!match) {
        return {
            displayTitle: trimmed,
            shortName: trimmed,
            aliases: [],
            aliasSlugs: [slugify(trimmed)],
        };
    }

    const core = match[1].trim();
    const shortName = `${core} City`;
    const displayTitle = `${shortName} (${trimmed})`;
    const aliases = [shortName, core];
    return {
        displayTitle,
        shortName,
        aliases,
        aliasSlugs: [slugify(trimmed), slugify(shortName), slugify(core)],
    };
}
