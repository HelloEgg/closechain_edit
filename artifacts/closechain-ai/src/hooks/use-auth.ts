import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentAuthUser, getGetCurrentAuthUserQueryKey } from "@workspace/api-client-react";

export class VerificationRequired extends Error {
  email: string;
  constructor(email: string) {
    super("Please verify your email address.");
    this.email = email;
  }
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: getGetCurrentAuthUserQueryKey(),
    queryFn: () => getCurrentAuthUser(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const user = data?.user || null;
  const isAuthenticated = !!user;

  const logout = () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.href = `${base}/api/logout`;
  };

  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 403 && body.needsVerification) {
        throw new VerificationRequired(body.email ?? email);
      }
      throw new Error(body.error || "Sign in failed.");
    }
    await queryClient.invalidateQueries({ queryKey: getGetCurrentAuthUserQueryKey() });
  };

  const signUpWithEmail = async (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    role?: string,
  ): Promise<{ needsVerification: true; email: string }> => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const res = await fetch(`${base}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, email, password, role }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Sign up failed.");
    }
    const body = await res.json();
    return { needsVerification: true, email: body.email ?? email };
  };

  const resendVerification = async (email: string): Promise<void> => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    await fetch(`${base}/api/auth/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
    logout,
    signInWithEmail,
    signUpWithEmail,
    resendVerification,
  };
}
