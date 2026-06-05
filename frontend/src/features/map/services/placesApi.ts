import { supabase } from "../../../config/supabase";

export interface VisitedPlace {
    id: number;
    user_id: string;
    municity_id: number;
    visited_at: string;
    notes?: string;
}

export async function fetchVisitedPlaces(userId: string): Promise<VisitedPlace[]> {
    const { data, error } = await supabase.from("visited_places").select("*").eq("user_id", userId).order("visited_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as VisitedPlace[];
}

export async function addVisitedPlace(userId: string, municityId: number, notes?: string) {
    const { data, error } = await supabase.from("visited_places").insert({ user_id: userId, municity_id: municityId, notes }).select().single();

    if (error) throw error;
    return data as VisitedPlace;
}
