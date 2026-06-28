// React Query hooks for built-in custom overlay datasets and their PSGC values.

import { useQuery } from "@tanstack/react-query";
import { fetchCustomDatasetValues, fetchCustomDatasets } from "../services/mapApi";

// Fetches metadata for all built-in custom datasets (title, series, source, etc.).
export function useCustomDatasets() {
    return useQuery({
        queryKey: ["custom-datasets"],
        queryFn: fetchCustomDatasets,
        staleTime: 10 * 60 * 1000,
    });
}

// Fetches all value rows for one built-in dataset (paginated on the API side).
export function useCustomDatasetValues(datasetId: string | null) {
    return useQuery({
        queryKey: ["custom-dataset-values", datasetId],
        queryFn: () => fetchCustomDatasetValues(datasetId!),
        enabled: !!datasetId,
        staleTime: 10 * 60 * 1000,
    });
}
