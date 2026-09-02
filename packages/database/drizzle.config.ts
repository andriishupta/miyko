import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    // DDL requires the migration/admin connection. The runtime API connection
    // intentionally uses api_role and must not own or migrate the database.
    url: process.env.MIGRATION_DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
  entities: {
    // Keep role support available for future managed roles. api_role is
    // external-managed by the Postgres init script and is not schema DDL.
    roles: true,
  },
});
