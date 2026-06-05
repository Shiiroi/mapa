import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJournalEntries, createJournalEntry, updateJournalEntry, deleteJournalEntry } from "../services/journalApi";
import type { JournalEntry } from "../types";

export function useJournalEntries(userId: string | undefined) {
    return useQuery<JournalEntry[]>({
        queryKey: ["journal-entries", userId],
        queryFn: () => fetchJournalEntries(userId!),
        enabled: !!userId,
    });
}

export function useCreateJournalEntry() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (entry: Omit<JournalEntry, "id" | "created_at" | "updated_at">) => createJournalEntry(entry),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
        },
    });
}

export function useUpdateJournalEntry() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: number; updates: Partial<JournalEntry> }) => updateJournalEntry(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
        },
    });
}

export function useDeleteJournalEntry() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => deleteJournalEntry(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
        },
    });
}
