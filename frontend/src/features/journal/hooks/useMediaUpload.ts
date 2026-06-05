import { useMutation } from "@tanstack/react-query";
import { uploadJournalImage } from "../services/journalApi";

export function useMediaUpload() {
    return useMutation({
        mutationFn: ({ file, userId, entryId }: { file: File; userId: string; entryId: number }) => uploadJournalImage(file, userId, entryId),
    });
}
