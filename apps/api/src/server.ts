import { serve } from "@hono/node-server";

import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { createApp } from "./routes/index.js";

const port = env.PORT;

const app = createApp();

const server = serve({
  fetch: app.fetch,
  port,
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down...`);
  server.close(() => {
    prisma
      .$disconnect()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error("Failed to disconnect Prisma:", error);
        process.exit(1);
      });
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log(`Server is running on http://localhost:${port}`);
