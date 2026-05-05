import app from "./app.js";
import { closeRedisClient } from "./config/redis.js";

const PORT = process.env.GATEWAY_PORT || 5000;

const startServer = async () => {
  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(`[Gateway] Received ${signal}. Shutting down...`);
    server.close(async () => {
      await closeRedisClient();
      process.exit(0);
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
};

startServer();
