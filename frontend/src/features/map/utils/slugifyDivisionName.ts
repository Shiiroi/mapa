// Normalizes division names for safe download filenames.

import { slugifyFilename } from "../../../lib/downloadFile";

export function slugifyDivisionName(name: string): string {
    return slugifyFilename(name);
}
