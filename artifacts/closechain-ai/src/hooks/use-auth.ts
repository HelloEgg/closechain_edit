import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentAuthUser, getGetCurrentAuthUserQueryKey, setAccessToken } from "@workspace/api-client-react";
import { supabase } from "@/lib/supabase";

export function useAuth() {
  const queryClient = useQueryClient();
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAccessToken(session?.access_token ?? null);
      setSessionReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
      queryClient.invalidateQueries({ queryKey: getGetCurrentAuthUserQueryKey() });
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: getGetCurrentAuthUserQueryKey(),
    queryFn: () => getCurrentAuthUser(),
    retry: false,
    enabled: sessionReady,
    staleTime: 5 * 60 * 1000,
  });

  const user = data?.user || null;
  const isAuthenticated = !!user;

  const logout = async () => {
    setAccessToken(null);
    await supabase.auth.signOut();
    queryClient.clear();
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.href = base + "/login";
  };

  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes("confirm") || error.message.toLowerCase().includes("verified")) {
        throw new Error("Please verify your email before signing in. Check your inbox for a verification link.");
      }
      throw new Error(error.message);
    }
  };

  const signUpWithEmail = async (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    role?: string,
  ): Promise<{ needsVerification: true; email: string }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/dashboard`,
        data: { firstName, lastName, role: role ?? "gc" },
      },
    });
    if (error) throw new Error(error.message);
    return { needsVerification: true, email };
  };

  return {
    user,
    isLoading: !sessionReady || isLoading,
    isAuthenticated,
    logout,
    signInWithEmail,
    signUpWithEmail,
  };
}
