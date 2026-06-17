import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";

export function NotFoundPage(): ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold">Page Not Found</h1>
      <p className="mt-2 text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link to="/app" className="mt-4 text-primary underline">
        Go to app
      </Link>
    </main>
  );
}
