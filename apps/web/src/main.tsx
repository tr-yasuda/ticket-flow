import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { Toaster } from "@/components/ui/sonner";

import { App } from "./App";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Root element not found");
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
      <Toaster
        position="top-right"
        duration={4000}
        visibleToasts={5}
        closeButton
      />
    </ThemeProvider>
  </StrictMode>,
);
