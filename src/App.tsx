import type { ReactNode } from "react";
import { SampleComponent } from "./presentation/components/SampleComponent";

export function App(): ReactNode {
  return (
    <main>
      <SampleComponent title="Welcome to ticket-flow" />
    </main>
  );
}
