export type TransactionRunner = Readonly<{
  run<T>(callback: (tx: unknown) => Promise<T>): Promise<T>;
}>;
