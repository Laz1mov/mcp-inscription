#!/usr/bin/env node

import { main } from "./index.js";
import logger from "./utils/logger.js";

main().catch((error: unknown) => {
  logger.error({ error }, "Failed to start server");
  process.exit(1);
});
