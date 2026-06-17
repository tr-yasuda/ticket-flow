import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { routeTree } from "@/routeTree.gen";

import "./index.css";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_MSW !== "true") {
    return;
  }

  const { worker } = await import("./mocks/browser.js");
  await worker.start({
    onUnhandledRequest: "bypass",
  });
}

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Root element not found");
}

enableMocking().then(() => {
  createRoot(container).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
});
