import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentAuthUser, getGetCurrentAuthUserQueryKey } from "@workspace/api-client-react";

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

  const login = () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.href = `${base}/api/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
  };

  const logout = () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.href = `${base}/api/logout`;
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
    login,
    logout,
  };
}
