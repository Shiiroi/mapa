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
