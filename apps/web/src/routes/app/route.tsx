import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/auth-context";
import { useLogout } from "@/hooks/use-logout";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout(): ReactElement {
  const { user, isLoading, isAuthenticated } = useAuth();
  const logout = useLogout();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner message="認証状態を確認しています" />
      </div>
    );
  }

  if (!isAuthenticated || user === null) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell user={{ email: user.email }} onLogout={logout}>
      <Outlet />
    </AppShell>
  );
}
