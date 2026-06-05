import { useQuery, useMutation } from "@tanstack/react-query";
import { getSession, signIn, signUp, signOut } from "../services/authApi";

export function useAuthSession() {
    return useQuery({
        queryKey: ["auth", "session"],
        queryFn: getSession,
    });
}

export function useSignIn() {
    return useMutation({
        mutationFn: ({ email, password }: { email: string; password: string }) => signIn(email, password),
    });
}

export function useSignUp() {
    return useMutation({
        mutationFn: ({ email, password }: { email: string; password: string }) => signUp(email, password),
    });
}

export function useSignOut() {
    return useMutation({
        mutationFn: signOut,
    });
}
