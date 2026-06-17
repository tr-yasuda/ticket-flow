import { createFileRoute, Navigate } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { useAuth } from "@/contexts/auth-context";
import { SignupPage } from "@/pages/signup-page";

export const Route = createFileRoute("/signup")({
  component: SignupRoute,
});

function SignupRoute(): ReactElement {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner message="認証状態を確認しています" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return <SignupPage />;
}
