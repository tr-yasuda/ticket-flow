import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/auth-context";
import { useOrganizationMembership } from "@/contexts/organization-membership-context";
import { useLogout } from "@/hooks/use-logout";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout(): ReactElement {
  const { user, isLoading, isAuthenticated } = useAuth();
  const {
    isLoading: isOrganizationsLoading,
    error,
    hasOrganization,
    refetch,
  } = useOrganizationMembership();
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

  if (isOrganizationsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner message="組織情報を確認しています" />
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <ErrorState
          title="組織情報の取得に失敗しました"
          message="時間をおいて再度お試しください。"
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!hasOrganization) {
    return <Navigate to="/onboarding/organization" replace />;
  }

  return (
    <AppShell user={{ email: user.email }} onLogout={logout}>
      <Outlet />
    </AppShell>
  );
}
