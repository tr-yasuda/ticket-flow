import { createFileRoute, Navigate } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { useAuth } from "@/contexts/auth-context";
import { useOrganizationMembership } from "@/contexts/organization-membership-context";
import { OrganizationOnboardingPage } from "@/pages/organization-onboarding-page";

export const Route = createFileRoute("/onboarding/organization")({
  component: OrganizationOnboardingRoute,
});

function OrganizationOnboardingRoute(): ReactElement {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const {
    isLoading: isOrganizationsLoading,
    error,
    hasOrganization,
    refetch,
  } = useOrganizationMembership();

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner message="認証状態を確認しています" />
      </div>
    );
  }

  if (!isAuthenticated) {
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

  if (hasOrganization) {
    return <Navigate to="/app" replace />;
  }

  return <OrganizationOnboardingPage />;
}
