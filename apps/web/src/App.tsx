import type { ReactElement } from "react";

import { SampleComponent } from "./ui/components/SampleComponent";

export function App(): ReactElement | null {
  return (
    <main>
      <SampleComponent title="Welcome to ticket-flow" />
    </main>
  );
}
