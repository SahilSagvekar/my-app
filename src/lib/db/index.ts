import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";
import * as relations from "./relations";

neonConfig.webSocketConstructor = ws;

export function getDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle(pool, {
    schema: { ...schema, ...relations },
  });
  return { db, closeDb: () => pool.end() };
}
