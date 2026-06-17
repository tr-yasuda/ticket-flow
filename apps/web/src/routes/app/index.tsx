import { createFileRoute } from "@tanstack/react-router";

import { AppTopPage } from "@/pages/app-top-page";

export const Route = createFileRoute("/app/")({
  component: AppTopPage,
});
