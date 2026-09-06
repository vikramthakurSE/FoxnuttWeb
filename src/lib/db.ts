import postgres from "postgres";

/**
 * Single shared postgres.js client.
 * `prepare: false` keeps it compatible with Supabase's pgbouncer pooler.
 */
declare global {
  // eslint-disable-next-line no-var
  var __nnSql: ReturnType<typeof postgres> | undefined;
}

export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function sql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!global.__nnSql) {
    global.__nnSql = postgres(process.env.DATABASE_URL, {
      ssl: "require",
      prepare: false,
      max: 5,
    });
  }
  return global.__nnSql;
}
