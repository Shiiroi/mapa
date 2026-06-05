import { supabase } from "../../../config/supabase";
import type { JournalEntry } from "../types";

export async function fetchJournalEntries(userId: string): Promise<JournalEntry[]> {
    const { data, error } = await supabase.from("journal_entries").select("*").eq("user_id", userId).order("visited_date", { ascending: false });

    if (error) throw error;
    return (data ?? []) as JournalEntry[];
}

export async function createJournalEntry(entry: Omit<JournalEntry, "id" | "created_at" | "updated_at">): Promise<JournalEntry> {
    const { data, error } = await supabase.from("journal_entries").insert(entry).select().single();

    if (error) throw error;
    return data as JournalEntry;
}

export async function updateJournalEntry(id: number, updates: Partial<JournalEntry>): Promise<JournalEntry> {
    const { data, error } = await supabase.from("journal_entries").update(updates).eq("id", id).select().single();

    if (error) throw error;
    return data as JournalEntry;
}

export async function deleteJournalEntry(id: number): Promise<void> {
    const { error } = await supabase.from("journal_entries").delete().eq("id", id);
    if (error) throw error;
}

export async function uploadJournalImage(file: File, userId: string, entryId: number): Promise<string> {
    const filePath = `${userId}/${entryId}/${file.name}`;
    const { error: uploadError } = await supabase.storage.from("journal-images").upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("journal-images").getPublicUrl(filePath);
    return urlData.publicUrl;
}
