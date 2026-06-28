// Postgres tables exported/restored in FK-safe order for db:export and db:restore.

export interface DbTableSpec {
    table: string;
    /** Supabase upsert onConflict target (comma-separated for composite keys). */
    conflict: string;
    /** Columns stored as jsonb; serialized to JSON strings in CSV backup files. */
    jsonColumns: readonly string[];
}

/** FK-safe insert order: regions -> provinces -> municities -> barangays -> stats -> custom. */
export const DB_TABLES: readonly DbTableSpec[] = [
    { table: "regions", conflict: "psgc", jsonColumns: [] },
    { table: "provinces", conflict: "psgc", jsonColumns: [] },
    { table: "municities", conflict: "psgc", jsonColumns: [] },
    { table: "barangays", conflict: "psgc", jsonColumns: [] },
    { table: "division_stats", conflict: "psgc", jsonColumns: ["age_sex_2020"] },
    { table: "custom_datasets", conflict: "id", jsonColumns: ["series"] },
    { table: "custom_dataset_values", conflict: "dataset_id,psgc", jsonColumns: ["detail"] },
];
