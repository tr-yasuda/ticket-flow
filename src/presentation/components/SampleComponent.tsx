import type { ReactNode } from "react";

type SampleComponentProps = {
  readonly title: string;
};

export function SampleComponent({
  title,
}: SampleComponentProps): ReactNode {
  return (
    <section>
      <h1>{title}</h1>
      <p>ticket-flow のフロントエンド基盤が動作しています。</p>
    </section>
  );
}
