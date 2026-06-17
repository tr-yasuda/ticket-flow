import type { PrismaClient } from "@prisma/client";

import type { TransactionRunner } from "../../application/transaction-runner.js";

export class PrismaTransactionRunner implements TransactionRunner {
  constructor(private readonly prisma: PrismaClient) {}

  async run<T>(callback: (tx: unknown) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => callback(tx));
  }
}
