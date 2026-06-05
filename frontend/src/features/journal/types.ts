export interface JournalEntry {
    id: number;
    user_id: string;
    municity_id: number;
    title: string;
    content: string;
    visited_date: string;
    created_at: string;
    updated_at: string;
    image_urls?: string[];
}

export interface JournalMedia {
    id: number;
    entry_id: number;
    storage_path: string;
    public_url: string;
    media_type: "image" | "video";
    created_at: string;
}
