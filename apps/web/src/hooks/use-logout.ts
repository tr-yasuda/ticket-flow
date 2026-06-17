import { useNavigate } from "@tanstack/react-router";

import { useAuth } from "@/contexts/auth-context";

export function useLogout(): () => Promise<void> {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return async () => {
    await logout();
    navigate({ to: "/login", replace: true });
  };
}
