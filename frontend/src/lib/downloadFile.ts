// Triggers browser download of JSON blobs.

export function downloadJsonFile(data: unknown, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

export function downloadTextFile(content: string, filename: string, mime = "text/plain"): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

export function slugifyFilename(value: string): string {
    return value.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase() || "export";
}
