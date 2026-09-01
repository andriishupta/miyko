import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "./schema.js";

export type Database = ReturnType<typeof createClient>;

export type DatabaseClientOptions = {
  connectionString?: string;
  maxConnections?: number;
};

/**
 * Creates a server-only database client. No connection is opened until the returned
 * client is used, which keeps schema tooling and API startup independently usable.
 */
export const createClient = (options: DatabaseClientOptions = {}) => {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create a database client");
  }

  const sqlClient: Sql = postgres(connectionString, {
    max: options.maxConnections ?? 10,
    prepare: false,
  });

  const db = drizzle(sqlClient, { schema });

  return {
    db,
    sql: sqlClient,
    close: () => sqlClient.end({ timeout: 5 }),
  };
};
