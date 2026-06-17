import type { TransactionRunner } from "../../application/transaction-runner.js";

export const noOpTransactionRunner: TransactionRunner = {
  async run<T>(callback: (tx: unknown) => Promise<T>): Promise<T> {
    return callback(undefined);
  },
};
